from contextlib import asynccontextmanager
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.api import router as api_router
from app.config import ConfigSettings
from app.database.connectors.mysql import get_db_connector
from app.exceptions.exception_handler import leaf_exception_handler
from app.exceptions.exceptions import LeafException
from app.logger import init_logging

config = ConfigSettings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await on_startup()
    yield
    await on_cleanup()


async def on_startup():
    started_at = time.perf_counter()
    logging.info("Starting up…")
    # Tables are created in MySQLDatabaseConnector.__init__ via create_all.
    # Calling get_db_connector() here ensures they exist before the first request.
    get_db_connector()
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logging.info("Startup complete in %.1fms", elapsed_ms)


async def on_cleanup():
    logging.info("Shutting down…")


app = FastAPI(
    title="Leaf API",
    description="Leaf API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    path = request.url.path
    if path.startswith("/leaves") or path.startswith("/databases"):
        logging.info(
            "REQUEST %s %s -> %s in %.1fms",
            request.method, path, response.status_code, elapsed_ms,
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
