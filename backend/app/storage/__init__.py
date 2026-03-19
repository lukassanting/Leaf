"""
Storage package (`backend/app/storage`).

Purpose:
- Exposes `get_file_storage()` which returns a cached `FileStorage` instance.
- Centralizes creation of the snapshot storage adapter backed by `DATA_DIR`.

How to read:
- `get_file_storage()` uses `ConfigSettings` and passes `config.DATA_DIR` to `FileStorage(...)`.

Update:
- If you add additional storage backends, create new getters here (or in a sibling module) and keep them cached if they are heavyweight.

Debug:
- If file writes don’t appear on disk, check that `FileStorage` receives the expected `DATA_DIR` and that operations call `get_file_storage().write_*`.
"""

from functools import lru_cache
from app.config import ConfigSettings
from app.storage.file_storage import FileStorage


@lru_cache()
def get_file_storage() -> FileStorage:
    config = ConfigSettings()
    return FileStorage(config.DATA_DIR)
