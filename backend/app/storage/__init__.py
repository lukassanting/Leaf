from functools import lru_cache
from app.config import ConfigSettings
from app.storage.file_storage import FileStorage


@lru_cache()
def get_file_storage() -> FileStorage:
    config = ConfigSettings()
    return FileStorage(config.DATA_DIR)
