from functools import lru_cache
from os import path
from fastapi import Depends
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from alembic.config import Config
from alembic import command

# Local imports
from app.config import ConfigSettings

# Migration command, is called from the main app on startup
def migrate_database():
    config_path = path.join(path.dirname(__file__), '..', '..', '..', 'alembic.ini')
    alembic_cfg = Config(config_path)
    # If you have a custom script location, set it here:
    # alembic_cfg.set_main_option("script_location", settings.ALEMBIC_SCRIPT_LOCATION)
    try:
        command.upgrade(alembic_cfg, "head")
    except Exception as e:
        print(f"Failed to do migration upgrades: {e}")
        raise e

class PostgresDatabaseConnector:
    def __init__(self, config: ConfigSettings = Depends(ConfigSettings)):
        self.config = config
        self.engine = self._get_engine()
        self.SessionLocal = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    def get_db_session(self) -> AsyncSession:
        return self.SessionLocal()

    # Private methods
    def _get_engine(self):
        return create_async_engine(
            self.config.DATABASE_URL,
            echo=self.config.DEBUG
        )

@lru_cache()
def get_db_connector() -> PostgresDatabaseConnector:
    config = ConfigSettings()
    return PostgresDatabaseConnector(config)
