"""
Runtime application settings singleton (`backend/app/runtime_config.py`).

Purpose:
- Expose the single `ConfigSettings` instance used after `main` constructs it so
  `get_db_connector`, `get_file_storage`, and sync share the same DATA_DIR /
  DATABASE_URL (including values overridden from `.sync-config.json` or the API).

Debug:
- If settings are unset, `get_app_settings()` raises — ensure `main` calls
  `set_app_settings` during import.
"""

from app.config import ConfigSettings

_settings: ConfigSettings | None = None
_sync_config_bootstrap_dir: str | None = None


def set_app_settings(cfg: ConfigSettings) -> None:
    global _settings
    _settings = cfg


def get_app_settings() -> ConfigSettings:
    if _settings is None:
        raise RuntimeError("Application settings not initialized (set_app_settings not called)")
    return _settings


def set_sync_config_bootstrap_dir(path: str) -> None:
    """Directory from env `DATA_DIR` before `.sync-config.json` overrides (for mirror persistence)."""
    global _sync_config_bootstrap_dir
    _sync_config_bootstrap_dir = path


def get_sync_config_bootstrap_dir() -> str | None:
    return _sync_config_bootstrap_dir


def inject_app_settings() -> ConfigSettings:
    """FastAPI `Depends(inject_app_settings)` — same instance as sync / runtime updates."""
    return get_app_settings()
