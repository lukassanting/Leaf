"""
Construct and rebuild the sync subsystem (`backend/app/sync/app_state.py`).

Purpose:
- Shared helpers for `main.on_startup` and `PUT /sync/config` when `DATA_DIR` changes,
  so `main` does not import the sync HTTP router (avoids circular imports).

Debug:
- If the watcher does not pick up a new folder, confirm `rebuild_sync_subsystem` ran and
  `watcher.start()` was called for non-off modes.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import FastAPI

    from app.config import ConfigSettings

logger = logging.getLogger(__name__)


def build_sync_state_dict(cfg: ConfigSettings) -> dict[str, Any]:
    from app.sync.cloud_detector import CloudConflictDetector
    from app.sync.conflict_store import ConflictStore
    from app.sync.file_to_db import FileToDbSyncer
    from app.sync.file_watcher import FileWatcherService
    from app.sync.git_sync import GitSyncService
    from app.sync.manifest import SyncManifest
    from app.sync.scheduler import SyncScheduler

    syncer = FileToDbSyncer(cfg.DATA_DIR)
    manifest = SyncManifest(cfg.DATA_DIR)
    manifest.load()
    conflict_store = ConflictStore(cfg.DATA_DIR)
    cloud_detector = CloudConflictDetector(cfg.DATA_DIR)

    watcher = FileWatcherService(
        data_dir=cfg.DATA_DIR,
        syncer=syncer,
        conflict_store=conflict_store,
        cloud_detector=cloud_detector,
    )

    git_sync = GitSyncService(
        data_dir=cfg.DATA_DIR,
        remote_url=cfg.GIT_REMOTE_URL,
        auth_token=cfg.GIT_AUTH_TOKEN,
    )

    scheduler = SyncScheduler(
        sync_fn=git_sync.sync_now,
        interval_fn=lambda: cfg.GIT_SYNC_INTERVAL,
        file_syncer=syncer,
        manifest=manifest,
    )

    return {
        "config": cfg,
        "syncer": syncer,
        "manifest": manifest,
        "conflict_store": conflict_store,
        "cloud_detector": cloud_detector,
        "watcher": watcher,
        "git_sync": git_sync,
        "scheduler": scheduler,
    }


async def teardown_sync_state(sync: dict[str, Any] | None) -> None:
    if not sync:
        return
    scheduler = sync.get("scheduler")
    if scheduler and scheduler.is_running:
        await scheduler.stop()
    watcher = sync.get("watcher")
    if watcher and watcher.is_running:
        watcher.stop()
    manifest = sync.get("manifest")
    if manifest:
        manifest.save()


async def run_sync_startup_tail(cfg: ConfigSettings, sync: dict[str, Any]) -> None:
    """Empty-DB file ingest, watcher, optional git scheduler — matches legacy `main.on_startup` tail."""
    from app.database.connectors.mysql import get_db_connector
    from app.database.models.mysql_models import LeafModel

    connector = get_db_connector()
    syncer = sync["syncer"]
    manifest = sync["manifest"]
    watcher = sync["watcher"]
    git_sync = sync["git_sync"]
    scheduler = sync["scheduler"]

    with connector.get_db_session() as session:
        leaf_count = session.query(LeafModel).count()
    if leaf_count == 0:
        pages_dir = Path(cfg.DATA_DIR) / "pages"
        if pages_dir.exists() and any(pages_dir.glob("*.md")):
            logger.info("Empty database but .md files exist — rebuilding index from files")
            syncer.sync_all()
            manifest.update()

    if cfg.SYNC_MODE != "off" and cfg.SYNC_WATCH_ENABLED:
        watcher.start()
        if manifest.is_empty:
            logger.info("First run with sync enabled — building manifest")
            manifest.update()
        else:
            diff = manifest.compute_diff()
            changes = len(diff.added) + len(diff.modified) + len(diff.deleted)
            if changes > 0:
                logger.info("Detected %d file changes since last run, syncing…", changes)
                syncer.sync_all()
                manifest.update()

    if cfg.SYNC_MODE == "git" and git_sync.is_configured:
        git_sync.initialize()
        await scheduler.start()


async def rebuild_sync_subsystem(app: FastAPI, cfg: ConfigSettings) -> None:
    """Stop current sync services, clear DB/file storage caches, attach a new sync bundle."""
    from app.database.connectors.mysql import get_db_connector
    from app.storage import get_file_storage

    prev = getattr(app.state, "sync", None)
    await teardown_sync_state(prev)

    get_db_connector.cache_clear()
    get_file_storage.cache_clear()

    app.state.sync = build_sync_state_dict(cfg)
    await run_sync_startup_tail(cfg, app.state.sync)
