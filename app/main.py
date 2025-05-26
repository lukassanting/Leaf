from contextlib import asynccontextmanager
import logging
from starlette.concurrency import run_in_threadpool
from fastapi import FastAPI
import alembic.config
import alembic.command


from app.api.routes.api import router as api_router
from app.config import ConfigSettings
from app.database.connectors.postgres import migrate_database
from app.exceptions.exception_handler import leaf_exception_handler
from app.exceptions.exceptions import LeafException

config = ConfigSettings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await on_startup()
    yield
    await on_cleanup()

async def on_startup():
    logging.info("Starting up...")
    await migrate_database()

async def on_cleanup():
    logging.info("Shutting down...")

app = FastAPI(
    title="Leaf API",
    description="Leaf API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(api_router)

app.add_exception_handler(LeafException, leaf_exception_handler)




