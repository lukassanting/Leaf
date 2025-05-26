from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class DatabaseSettings(BaseSettings):
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "postgres"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "allow"
    }


@lru_cache()
def get_database_settings() -> DatabaseSettings:
    """
    Get database settings from environment variables.
    Uses .env for both development and production.
    """
    return DatabaseSettings()


def get_database_url() -> str:
    """
    Get the database URL from environment variables.
    Falls back to local database if DATABASE_URL is not set.
    """
    settings = get_database_settings()
    return settings.DATABASE_URL 