"""
Sync API endpoints (`backend/app/api/routes/sync/sync_controller.py`).

Purpose:
- Exposes sync status, configuration, manual sync trigger,
  conflict listing, and conflict resolution to the frontend.
"""

import logging
import shutil
from pathlib import Path

from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import repoint_default_sqlite_if_needed
from app.dtos.sync_dtos import (
    ConflictResolution,
    GitStatus,
    SyncConfig,
    SyncConfigUpdate,
    SyncConflict,
    SyncMode,
    SyncState,
    SyncStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["sync"])


def _get_sync_state(request: Request):
    """Retrieve sync services from app.state (set during startup)."""
    return getattr(request.app.state, "sync", None)


# ─── Status ─────────────────────────────────────────────────────────────────

@router.get("/status", response_model=SyncStatus)
async def get_sync_status(request: Request):
    sync = _get_sync_state(request)
    if sync is None:
        return SyncStatus(
            mode=SyncMode.OFF,
            state=SyncState.IDLE,
            pending_changes=0,
            conflicts_count=0,
        )

    watcher = sync.get("watcher")
    manifest = sync.get("manifest")
    conflict_store = sync.get("conflict_store")
    config = sync.get("config")

    mode = SyncMode(config.SYNC_MODE) if config else SyncMode.OFF

    if mode == SyncMode.OFF:
        state = SyncState.IDLE
    elif watcher and watcher.is_running:
        state = SyncState.WATCHING
    else:
        state = SyncState.IDLE

    pending = 0
    if manifest:
        diff = manifest.compute_diff()
        pending = len(diff.added) + len(diff.modified) + len(diff.deleted)

    conflicts_count = conflict_store.count if conflict_store else 0

    # Git status
    git_status = None
    git_sync = sync.get("git_sync")
    if git_sync and mode == SyncMode.GIT:
        gs = git_sync.get_status()
        git_status = GitStatus(
            initialized=gs.get("initialized", False),
            configured=gs.get("configured", False),
            syncing=gs.get("syncing", False),
            last_sync_at=gs.get("last_sync_at"),
            last_error=gs.get("last_error"),
            remote_url=gs.get("remote_url"),
            branch=gs.get("branch", "main"),
            last_commit=gs.get("last_commit"),
            has_uncommitted=gs.get("has_uncommitted", False),
        )
        if git_sync.is_syncing:
            state = SyncState.SYNCING

    return SyncStatus(
        mode=mode,
        state=state,
        last_sync_at=manifest.last_sync if manifest and manifest.last_sync else None,
        pending_changes=pending,
        conflicts_count=conflicts_count,
        git=git_status,
    )


# ─── Configuration ──────────────────────────────────────────────────────────

@router.get("/config", response_model=SyncConfig)
async def get_sync_config(request: Request):
    sync = _get_sync_state(request)
    config = sync["config"] if sync else None

    if config is None:
        return SyncConfig()

    return SyncConfig(
        mode=SyncMode(config.SYNC_MODE),
        data_dir=config.DATA_DIR,
        watch_enabled=config.SYNC_WATCH_ENABLED,
        git_remote_url=config.GIT_REMOTE_URL or None,
        git_sync_interval=config.GIT_SYNC_INTERVAL,
    )


@router.put("/config", response_model=SyncConfig)
async def update_sync_config(body: SyncConfigUpdate, request: Request):
    """
    Update sync config at runtime. Persists to ``DATA_DIR/.sync-config.json``
    (and mirrors to the env bootstrap ``DATA_DIR`` when it differs).
    Changing ``data_dir`` rebuilds the sync subsystem and, when using the default
    SQLite layout, repoints ``DATABASE_URL`` to the new ``.leaf.db`` path.
    """
    sync = _get_sync_state(request)
    if sync is None:
        raise HTTPException(status_code=503, detail="Sync service not initialized")

    config = sync["config"]
    data_dir_changed = False

    if body.mode is not None:
        config.SYNC_MODE = body.mode.value
    if body.data_dir is not None:
        raw = body.data_dir.strip()
        if raw:
            try:
                new_dir = str(Path(raw).expanduser().resolve())
            except OSError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid data directory: {exc}") from exc
            old_resolved = str(Path(config.DATA_DIR).resolve())
            if new_dir != old_resolved:
                Path(new_dir).mkdir(parents=True, exist_ok=True)
                repoint_default_sqlite_if_needed(config, config.DATA_DIR, new_dir)
                config.DATA_DIR = new_dir
                data_dir_changed = True
    if body.watch_enabled is not None:
        config.SYNC_WATCH_ENABLED = body.watch_enabled
    if body.git_remote_url is not None:
        # Strip any embedded credentials from the URL — token goes in GIT_AUTH_TOKEN
        import re
        clean_url = re.sub(r"^https://[^@]+@", "https://", body.git_remote_url)
        config.GIT_REMOTE_URL = clean_url
    if body.git_auth_token is not None:
        config.GIT_AUTH_TOKEN = body.git_auth_token
    if body.git_sync_interval is not None:
        config.GIT_SYNC_INTERVAL = body.git_sync_interval

    _persist_sync_config(config)

    if data_dir_changed:
        from app.sync.app_state import rebuild_sync_subsystem

        await rebuild_sync_subsystem(request.app, config)
    else:
        watcher = sync.get("watcher")
        if config.SYNC_MODE == "off" or not config.SYNC_WATCH_ENABLED:
            if watcher and watcher.is_running:
                watcher.stop()
        else:
            if watcher and not watcher.is_running:
                watcher.start()

        git_sync = sync.get("git_sync")
        if git_sync:
            git_sync.update_config(
                remote_url=config.GIT_REMOTE_URL,
                auth_token=config.GIT_AUTH_TOKEN if hasattr(config, "GIT_AUTH_TOKEN") else "",
            )

    return SyncConfig(
        mode=SyncMode(config.SYNC_MODE),
        data_dir=config.DATA_DIR,
        watch_enabled=config.SYNC_WATCH_ENABLED,
        git_remote_url=config.GIT_REMOTE_URL or None,
        git_sync_interval=config.GIT_SYNC_INTERVAL,
    )


# ─── Manual sync ────────────────────────────────────────────────────────────

@router.post("/trigger")
async def trigger_sync(request: Request):
    """Trigger a full sync cycle. In git mode: commit + pull + push + DB reconciliation."""
    sync = _get_sync_state(request)
    if sync is None:
        raise HTTPException(status_code=503, detail="Sync service not initialized")

    config = sync["config"]
    syncer = sync["syncer"]
    manifest = sync["manifest"]

    result = {"message": "Sync complete", "stats": {}}

    # If in git mode, run git sync first (push local changes, pull remote)
    git_sync = sync.get("git_sync")
    if config.SYNC_MODE == "git" and git_sync:
        git_stats = git_sync.sync_now()
        result["git"] = git_stats

    # Then reconcile files → DB
    file_stats = syncer.sync_all()
    manifest.update()
    result["stats"] = file_stats

    return result


@router.post("/rebuild-index")
async def rebuild_index(request: Request):
    """Full rebuild: pull from git (if configured), then scan all .md files and recreate the SQLite index."""
    sync = _get_sync_state(request)
    if sync is None:
        raise HTTPException(status_code=503, detail="Sync service not initialized")

    config = sync["config"]
    syncer = sync["syncer"]
    manifest = sync["manifest"]

    result = {"message": "Index rebuilt from files", "stats": {}}

    # Pull from git first so we rebuild from the latest remote state
    git_sync = sync.get("git_sync")
    if config.SYNC_MODE == "git" and git_sync:
        git_stats = git_sync.sync_now()
        result["git"] = git_stats

    stats = syncer.sync_all()
    manifest.update()
    result["stats"] = stats

    return result


# ─── Git ────────────────────────────────────────────────────────────────

class GitTestRequest(BaseModel):
    """Optional body for test-connection so the frontend can test a draft URL/token before saving."""
    git_remote_url: Optional[str] = None
    git_auth_token: Optional[str] = None


@router.post("/git/test-connection")
async def test_git_connection(request: Request, body: GitTestRequest = GitTestRequest()):
    """Test the git remote connection. Accepts optional URL/token to test before saving."""
    sync = _get_sync_state(request)
    if sync is None:
        raise HTTPException(status_code=503, detail="Sync service not initialized")

    git_sync = sync.get("git_sync")
    if git_sync is None:
        raise HTTPException(status_code=400, detail="Git sync not available")

    return await git_sync.test_connection(url_override=body.git_remote_url, token_override=body.git_auth_token)


@router.get("/git/status")
async def get_git_status(request: Request):
    """Get detailed git sync status."""
    sync = _get_sync_state(request)
    if sync is None:
        raise HTTPException(status_code=503, detail="Sync service not initialized")

    git_sync = sync.get("git_sync")
    if git_sync is None:
        return {"initialized": False, "configured": False}

    return git_sync.get_status()


# ─── Conflicts ──────────────────────────────────────────────────────────────

@router.get("/conflicts", response_model=list[SyncConflict])
async def list_conflicts(request: Request):
    sync = _get_sync_state(request)
    if sync is None:
        return []

    conflict_store = sync["conflict_store"]
    return conflict_store.list_all()


@router.post("/conflicts/{conflict_id}/resolve")
async def resolve_conflict(conflict_id: str, body: ConflictResolution, request: Request):
    sync = _get_sync_state(request)
    if sync is None:
        raise HTTPException(status_code=503, detail="Sync service not initialized")

    conflict_store = sync["conflict_store"]
    conflict = conflict_store.get(conflict_id)
    if conflict is None:
        raise HTTPException(status_code=404, detail="Conflict not found")

    data_dir = Path(sync["config"].DATA_DIR)
    conflict_path = data_dir / conflict.file_path

    if body.keep == "local":
        # Remove the conflict copy file
        if conflict_path.exists():
            conflict_path.unlink()
    elif body.keep == "remote":
        # Replace original with conflict copy, then remove copy
        original_stem = _extract_original_stem(conflict_path)
        if original_stem:
            original_path = conflict_path.parent / f"{original_stem}.md"
            if conflict_path.exists():
                shutil.copy2(str(conflict_path), str(original_path))
                conflict_path.unlink()
                # Re-sync the original file into DB
                sync["syncer"].sync_file(original_path)
    elif body.keep == "both":
        # Keep both — the conflict copy becomes its own page
        # (sync_file will create a new leaf if the ID doesn't exist)
        if conflict_path.exists():
            sync["syncer"].sync_file(conflict_path)

    conflict_store.resolve(conflict_id)
    return {"message": "Conflict resolved", "resolution": body.keep}


# ─── Helpers ────────────────────────────────────────────────────────────────

def _extract_original_stem(conflict_path: Path) -> str | None:
    """Try to extract the original filename stem from a conflict copy name."""
    import re
    stem = conflict_path.stem
    # Try patterns: "name (1)", "name (conflicted copy ...)"
    for pattern in [
        r"^(.+?)\s*\(\d+\)$",
        r"^(.+?)\s*\(.*conflicted copy.*\)$",
    ]:
        m = re.match(pattern, stem, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def _persist_sync_config(config) -> None:
    """Write sync-specific config to effective ``DATA_DIR/.sync-config.json`` and mirror to bootstrap dir if needed."""
    import json

    from app.runtime_config import get_sync_config_bootstrap_dir

    data = {
        "DATA_DIR": config.DATA_DIR,
        "SYNC_MODE": config.SYNC_MODE,
        "SYNC_WATCH_ENABLED": config.SYNC_WATCH_ENABLED,
        "GIT_REMOTE_URL": config.GIT_REMOTE_URL,
        "GIT_AUTH_TOKEN": config.GIT_AUTH_TOKEN,
        "GIT_SYNC_INTERVAL": config.GIT_SYNC_INTERVAL,
    }
    text = json.dumps(data, indent=2)
    eff = Path(config.DATA_DIR) / ".sync-config.json"
    eff.parent.mkdir(parents=True, exist_ok=True)
    eff.write_text(text, encoding="utf-8")
    boot = get_sync_config_bootstrap_dir()
    if boot and Path(boot).resolve() != Path(config.DATA_DIR).resolve():
        bp = Path(boot) / ".sync-config.json"
        bp.parent.mkdir(parents=True, exist_ok=True)
        bp.write_text(text, encoding="utf-8")
