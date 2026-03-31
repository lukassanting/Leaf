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
from app.config import ConfigSettings, repoint_default_sqlite_if_needed
from app.database.connectors.mysql import get_db_connector
from app.exceptions.exception_handler import leaf_exception_handler
from app.exceptions.exceptions import LeafException
from app.logger import init_logging
from app.runtime_config import set_app_settings, set_sync_config_bootstrap_dir

config = ConfigSettings()
set_app_settings(config)
set_sync_config_bootstrap_dir(str(Path(config.DATA_DIR).expanduser().resolve()))


def _load_persisted_sync_config(cfg: ConfigSettings) -> None:
    """Override sync config from DATA_DIR/.sync-config.json if it exists."""
    config_path = Path(cfg.DATA_DIR) / ".sync-config.json"
    if not config_path.exists():
        return
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
        if "DATA_DIR" in data and data["DATA_DIR"]:
            nd = str(Path(data["DATA_DIR"]).expanduser().resolve())
            od = str(Path(cfg.DATA_DIR).expanduser().resolve())
            if nd != od:
                repoint_default_sqlite_if_needed(cfg, cfg.DATA_DIR, nd)
                cfg.DATA_DIR = nd
        if "SYNC_MODE" in data:
            cfg.SYNC_MODE = data["SYNC_MODE"]
        if "SYNC_WATCH_ENABLED" in data:
            cfg.SYNC_WATCH_ENABLED = data["SYNC_WATCH_ENABLED"]
        if "GIT_REMOTE_URL" in data:
            cfg.GIT_REMOTE_URL = data["GIT_REMOTE_URL"]
        if "GIT_AUTH_TOKEN" in data:
            cfg.GIT_AUTH_TOKEN = data["GIT_AUTH_TOKEN"]
        if "GIT_SYNC_INTERVAL" in data:
            cfg.GIT_SYNC_INTERVAL = data["GIT_SYNC_INTERVAL"]
    except Exception:
        logging.warning("Could not load .sync-config.json, using defaults")


_load_persisted_sync_config(config)


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
    from app.sync.app_state import build_sync_state_dict, run_sync_startup_tail

    _app.state.sync = build_sync_state_dict(config)
    await run_sync_startup_tail(config, _app.state.sync)

    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logging.info("Startup complete in %.1fms", elapsed_ms)


async def on_cleanup(_app: FastAPI):
    logging.info("Shutting down…")
    from app.sync.app_state import teardown_sync_state

    await teardown_sync_state(getattr(_app.state, "sync", None))


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
