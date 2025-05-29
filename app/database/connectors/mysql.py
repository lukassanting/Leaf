from functools import lru_cache
from os import path
from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from alembic import command
from alembic.config import Config

# Local imports
from app.config import ConfigSettings

def migrate_database():
    config_path = path.join(path.dirname(__file__), '..', '..', '..', 'alembic.ini')
    alembic_cfg = Config(config_path)

    config = ConfigSettings()

    alembic_cfg.set_main_option("script_location", config.ALEMBIC_SCRIPT_LOCATION)
    try:
        command.upgrade(alembic_cfg, "head")
    except Exception as e:
        print(f"Failed to do migration upgrades: {e}")
        raise e

class MySQLDatabaseConnector:
    def __init__(self, config: ConfigSettings = Depends(ConfigSettings)):
        self.config = config
        self.engine = self._get_engine()
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def get_db_session(self) -> Session:
        return self.SessionLocal()

    # Private methods
    def _get_engine(self):

        print(self.config.MYSQL_USER)
        print(self.config.MYSQL_PASSWORD)
        print(self.config.MYSQL_HOST)
        print(self.config.MYSQL_PORT)
        print(self.config.MYSQL_DATABASE)

        return create_engine(
            "mysql+pymysql://{}:{}@{}:{}/{}".format(
                self.config.MYSQL_USER,
                self.config.MYSQL_PASSWORD,
                self.config.MYSQL_HOST,
                self.config.MYSQL_PORT,
                self.config.MYSQL_DATABASE
            ), pool_recycle=3600
        )

@lru_cache()
def get_db_connector() -> MySQLDatabaseConnector:
    config = ConfigSettings()
    return MySQLDatabaseConnector(config)
