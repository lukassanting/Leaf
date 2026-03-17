from contextlib import asynccontextmanager
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Local imports
from app.api.routes.api import router as api_router
from app.config import ConfigSettings
from app.database.connectors.mysql import migrate_database
from app.exceptions.exception_handler import leaf_exception_handler
from app.exceptions.exceptions import LeafException
from app.logger import init_logging

config = ConfigSettings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await on_startup()
    yield
    await on_cleanup()


async def on_startup():
    started_at = time.perf_counter()
    logging.info("Starting up...")
    if getattr(config, "RUN_MIGRATIONS_ON_STARTUP", True):
        logging.info("Migrating database on startup...")
        migrate_database()
    else:
        logging.info("Skipping migrations (RUN_MIGRATIONS_ON_STARTUP=false)")
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logging.info("Startup complete in %.1fms", elapsed_ms)


async def on_cleanup():
    logging.info("Shutting down...")


app = FastAPI(
    title="Leaf API",
    description="Leaf API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """DEV: log request latency for key endpoints."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    path = request.url.path
    if path.startswith("/leaves"):
        logging.info(
            "REQUEST %s %s -> %s in %.1fms",
            request.method,
            path,
            response.status_code,
            elapsed_ms,
        )

    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

app.add_exception_handler(LeafException, leaf_exception_handler)

init_logging()