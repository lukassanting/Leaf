"""
Leaf API configuration (`backend/app/config.py`).

Purpose:
- Provides `ConfigSettings` which loads environment variables (via `.env`) and exposes:
  - CORS allowlist (`ALLOWED_ORIGINS`)
  - data directory (`DATA_DIR`)
  - database connection URL (`DATABASE_URL`)

How to read:
- `ConfigSettings.__init__` calls `load_dotenv()` then reads values from `starlette.config.Config`.
- `ALLOWED_ORIGINS` is parsed as JSON list of strings.

Update:
- Add new config fields by:
  1) adding a typed class attribute
  2) reading it in `__init__` via `self.config(...)`
  3) wiring it where needed (e.g. `backend/app/main.py`).

Debug:
- If CORS is wrong, check `ALLOWED_ORIGINS` parsing and confirm `.env` is present in the container/runtime.
- If DB URL changes aren’t taking effect, verify `DATA_DIR` and the computed default sqlite path.
"""

from dotenv import load_dotenv
from starlette.config import Config
from pathlib import Path
import json
from pydantic import TypeAdapter


class ConfigSettings():
    ENVIRONMENT: str
    DEBUG: bool
    ALLOWED_ORIGINS: list[str] = []
    DATA_DIR: str
    DATABASE_URL: str

    # Sync settings
    SYNC_MODE: str  # "off", "folder", "git"
    SYNC_WATCH_ENABLED: bool
    GIT_REMOTE_URL: str
    GIT_AUTH_TOKEN: str
    GIT_SYNC_INTERVAL: int  # seconds between git push/pull cycles

    def __init__(self):
        load_dotenv()
        self.config = Config(".env")

        self.ENVIRONMENT = self.config("ENVIRONMENT", default="development")
        self.DEBUG = self.config("DEBUG", cast=bool, default=False)

        self.ALLOWED_ORIGINS = TypeAdapter(list[str]).validate_python(
            json.loads(self.config("ALLOWED_ORIGINS", default='["http://localhost:3000", "http://127.0.0.1:3000"]'))
        )

        self.DATA_DIR = self.config("DATA_DIR", cast=str, default="./data")

        # DATABASE_URL defaults to SQLite in DATA_DIR; override for custom paths.
        default_db = f"sqlite:///{Path(self.DATA_DIR) / '.leaf.db'}"
        self.DATABASE_URL = self.config("DATABASE_URL", cast=str, default=default_db)

        # Sync configuration
        self.SYNC_MODE = self.config("SYNC_MODE", cast=str, default="off")
        self.SYNC_WATCH_ENABLED = self.config("SYNC_WATCH_ENABLED", cast=bool, default=True)
        self.GIT_REMOTE_URL = self.config("GIT_REMOTE_URL", cast=str, default="")
        self.GIT_AUTH_TOKEN = self.config("GIT_AUTH_TOKEN", cast=str, default="")
        self.GIT_SYNC_INTERVAL = self.config("GIT_SYNC_INTERVAL", cast=int, default=300)

        # Trash: soft-deleted pages/databases are purged after this many days
        self.TRASH_RETENTION_DAYS = self.config("TRASH_RETENTION_DAYS", cast=int, default=7)


def default_sqlite_url_for_data_dir(data_dir: str) -> str:
    """SQLite URL for ``<data_dir>/.leaf.db`` (resolved paths)."""
    p = Path(data_dir).expanduser().resolve()
    return f"sqlite:///{(p / '.leaf.db').as_posix()}"


def sqlite_url_database_path(url: str) -> Path | None:
    """Return resolved path to the SQLite file, or None if not a sqlite URL."""
    if not url.startswith("sqlite"):
        return None
    # Four-slash form is used for absolute paths on Unix; check it first.
    if url.startswith("sqlite:////"):
        return Path(url[len("sqlite:////") :]).resolve()
    if url.startswith("sqlite:///"):
        return Path(url[len("sqlite:///") :]).resolve()
    return None


def repoint_default_sqlite_if_needed(cfg: ConfigSettings, old_data_dir: str, new_data_dir: str) -> None:
    """
    If DATABASE_URL points at the default ``.leaf.db`` under old_data_dir,
    repoint it to the default file under new_data_dir. Custom DATABASE_URL unchanged.
    """
    cur = sqlite_url_database_path(cfg.DATABASE_URL)
    if cur is None:
        return
    old_default = (Path(old_data_dir).expanduser().resolve() / ".leaf.db").resolve()
    if cur == old_default:
        cfg.DATABASE_URL = default_sqlite_url_for_data_dir(new_data_dir)
