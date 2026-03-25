"""
Leaf API Service (FastAPI) entrypoint (`backend/app/main.py`).

Purpose:
- Creates the FastAPI app instance and wires:
  - CORS settings
  - router mounting (`app.api.routes.api`)
  - exception handler (`leaf_exception_handler`)
  - startup/shutdown lifespan hooks
  - request timing middleware for `/leaves` and `/databases`
  - logging initialization

How to read:
- `lifespan()` is the main lifecycle entrypoint (calls `on_startup` and `on_cleanup`).
- Middleware is registered via `@app.middleware("http")` and logs per-request timings.
- `app.include_router(api_router)` mounts all leaf + database endpoints.

Update:
- To add a new top-level route group, modify `app/api/routes/api.py` (not this file).
- To change what gets timed/logged, update `timing_middleware` path checks.
- To adjust startup behavior (e.g., migrations), update `on_startup`.

Debug:
- If endpoints don’t work, check CORS + router mounting (`include_router`) and URL paths.
- If startup is slow or DB-dependent, instrument `on_startup()` and confirm the DB connector initialization.
"""

from contextlib import asynccontextmanager
import json
import logging
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.api import router as api_router
from app.config import ConfigSettings
from app.database.connectors.mysql import get_db_connector
from app.exceptions.exception_handler import leaf_exception_handler
from app.exceptions.exceptions import LeafException
from app.logger import init_logging

config = ConfigSettings()


def _load_persisted_sync_config(cfg: ConfigSettings) -> None:
    """Override sync config from DATA_DIR/.sync-config.json if it exists."""
    config_path = Path(cfg.DATA_DIR) / ".sync-config.json"
    if not config_path.exists():
        return
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
        if "SYNC_MODE" in data:
            cfg.SYNC_MODE = data["SYNC_MODE"]
        if "SYNC_WATCH_ENABLED" in data:
            cfg.SYNC_WATCH_ENABLED = data["SYNC_WATCH_ENABLED"]
        if "GIT_REMOTE_URL" in data:
            cfg.GIT_REMOTE_URL = data["GIT_REMOTE_URL"]
        if "GIT_SYNC_INTERVAL" in data:
            cfg.GIT_SYNC_INTERVAL = data["GIT_SYNC_INTERVAL"]
    except Exception:
        logging.warning("Could not load .sync-config.json, using defaults")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await on_startup(_app)
    yield
    await on_cleanup(_app)


async def on_startup(_app: FastAPI):
    started_at = time.perf_counter()
    logging.info("Starting up…")
    # Tables are created in MySQLDatabaseConnector.__init__ via create_all.
    # Calling get_db_connector() here ensures they exist before the first request.
    connector = get_db_connector()
    from app.database.operations.trash_operations import TrashOperations

    TrashOperations(connector).purge_expired(config.TRASH_RETENTION_DAYS)

    # ── Sync subsystem ──────────────────────────────────────────────────────
    _load_persisted_sync_config(config)

    from app.database.models.mysql_models import LeafModel
    from app.sync.file_to_db import FileToDbSyncer
    from app.sync.manifest import SyncManifest
    from app.sync.conflict_store import ConflictStore
    from app.sync.cloud_detector import CloudConflictDetector
    from app.sync.file_watcher import FileWatcherService
    from app.sync.git_sync import GitSyncService
    from app.sync.scheduler import SyncScheduler

    syncer = FileToDbSyncer(config.DATA_DIR)
    manifest = SyncManifest(config.DATA_DIR)
    manifest.load()
    conflict_store = ConflictStore(config.DATA_DIR)
    cloud_detector = CloudConflictDetector(config.DATA_DIR)

    watcher = FileWatcherService(
        data_dir=config.DATA_DIR,
        syncer=syncer,
        conflict_store=conflict_store,
        cloud_detector=cloud_detector,
    )

    git_sync = GitSyncService(
        data_dir=config.DATA_DIR,
        remote_url=config.GIT_REMOTE_URL,
        auth_token=config.GIT_AUTH_TOKEN,
    )

    scheduler = SyncScheduler(
        sync_fn=git_sync.sync_now,
        interval_fn=lambda: config.GIT_SYNC_INTERVAL,
        file_syncer=syncer,
        manifest=manifest,
    )

    # Store references for the sync API endpoints
    _app.state.sync = {
        "config": config,
        "syncer": syncer,
        "manifest": manifest,
        "conflict_store": conflict_store,
        "cloud_detector": cloud_detector,
        "watcher": watcher,
        "git_sync": git_sync,
        "scheduler": scheduler,
    }

    # Always import .md files into a fresh/empty DB — the files are the source of truth.
    connector = get_db_connector()
    with connector.get_db_session() as session:
        leaf_count = session.query(LeafModel).count()
    if leaf_count == 0:
        pages_dir = Path(config.DATA_DIR) / "pages"
        if pages_dir.exists() and any(pages_dir.glob("*.md")):
            logging.info("Empty database but .md files exist — rebuilding index from files")
            syncer.sync_all()
            manifest.update()

    # Start watcher if sync mode is enabled
    if config.SYNC_MODE != "off" and config.SYNC_WATCH_ENABLED:
        watcher.start()
        # Reconciliation: pick up any changes that happened while offline
        if manifest.is_empty:
            logging.info("First run with sync enabled — building manifest")
            manifest.update()
        else:
            diff = manifest.compute_diff()
            changes = len(diff.added) + len(diff.modified) + len(diff.deleted)
            if changes > 0:
                logging.info("Detected %d file changes since last run, syncing…", changes)
                syncer.sync_all()
                manifest.update()

    # Start git scheduler if in git mode
    if config.SYNC_MODE == "git" and git_sync.is_configured:
        git_sync.initialize()
        await scheduler.start()

    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logging.info("Startup complete in %.1fms", elapsed_ms)


async def on_cleanup(_app: FastAPI):
    logging.info("Shutting down…")
    sync = getattr(_app.state, "sync", None)
    if sync:
        scheduler = sync.get("scheduler")
        if scheduler and scheduler.is_running:
            await scheduler.stop()
        watcher = sync.get("watcher")
        if watcher:
            watcher.stop()
        manifest = sync.get("manifest")
        if manifest:
            manifest.save()


app = FastAPI(
    title="Leaf API",
    description="Leaf API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    path = request.url.path
    if path.startswith("/leaves") or path.startswith("/databases"):
        logging.info(
            "REQUEST %s %s -> %s in %.1fms",
            request.method, path, response.status_code, elapsed_ms,
        )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.add_exception_handler(LeafException, leaf_exception_handler)

init_logging()
