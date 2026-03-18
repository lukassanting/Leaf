from functools import lru_cache
from pathlib import Path
from fastapi import Depends
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, Session

from app.config import ConfigSettings


def _configure_sqlite(engine):
    """Enable SQLite performance pragmas on every new connection."""
    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA journal_mode = WAL")      # concurrent reads + writes
        cursor.execute("PRAGMA synchronous = NORMAL")    # fast writes, safe enough
        cursor.execute("PRAGMA cache_size = -32000")     # 32 MB page cache
        cursor.execute("PRAGMA temp_store = MEMORY")
        cursor.close()


class MySQLDatabaseConnector:
    """Database connector — SQLite-backed despite the legacy class name."""

    def __init__(self, config: ConfigSettings = Depends(ConfigSettings)):
        self.config = config
        self.engine = self._get_engine()
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        self._ensure_tables()

    def get_db_session(self) -> Session:
        return self.SessionLocal()

    def _get_engine(self):
        url = self.config.DATABASE_URL
        connect_args = {}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
            # Ensure the directory exists
            db_path = url.replace("sqlite:///", "")
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        engine = create_engine(url, connect_args=connect_args)

        if url.startswith("sqlite"):
            _configure_sqlite(engine)

        return engine

    def _ensure_tables(self):
        from app.database.models.mysql_models import Base
        Base.metadata.create_all(bind=self.engine)
        self._migrate_missing_columns()

    def _migrate_missing_columns(self):
        """Add columns that create_all won't add to existing tables."""
        insp = inspect(self.engine)
        migrations: list[tuple[str, str, str]] = [
            # (table, column, SQL type + default)
            ("leaves", "icon", "TEXT DEFAULT NULL"),
            ("leaves", "properties", "TEXT DEFAULT NULL"),
        ]
        with self.engine.connect() as conn:
            for table, column, col_type in migrations:
                if table not in insp.get_table_names():
                    continue
                existing = [c["name"] for c in insp.get_columns(table)]
                if column not in existing:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {col_type}'))
                    conn.commit()


@lru_cache()
def get_db_connector() -> MySQLDatabaseConnector:
    config = ConfigSettings()
    return MySQLDatabaseConnector(config)
