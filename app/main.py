from fastapi import FastAPI
from app.api.routes.api import router as api_router
from app.config import get_settings
import alembic.config
import alembic.command
import os

app = FastAPI(
    title="Leaf API",
    description="Leaf API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(api_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """
    Run database migrations on startup
    """
    settings = get_settings()
    if settings.ENVIRONMENT == "development":
        # In development, we want to see the migrations
        alembic_cfg = alembic.config.Config("alembic.ini")
        alembic.command.upgrade(alembic_cfg, "head")
    else:
        # In production, we want to run migrations silently
        alembic_cfg = alembic.config.Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
        alembic.command.upgrade(alembic_cfg, "head")



