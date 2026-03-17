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
