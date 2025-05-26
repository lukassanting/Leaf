import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.connectors.postgres import Base
from app.database.models.leaf_model import Leaf
from app.config import Settings
import asyncio
from typing import AsyncGenerator, Generator

# Test database URL
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/test_db"

# Create test settings
test_settings = Settings(
    POSTGRES_DB="test_db",
    ENVIRONMENT="test",
    DEBUG=True
)

# Create async engine for tests
test_engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestingSessionLocal = sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_db_setup():
    """Create test database tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db_session(test_db_setup) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()

@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI application."""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
async def test_leaf(db_session: AsyncSession) -> Leaf:
    """Create a test leaf for use in tests."""
    test_leaf = Leaf(
        title="Test Leaf",
        content="Test Content"
    )
    db_session.add(test_leaf)
    await db_session.commit()
    await db_session.refresh(test_leaf)
    return test_leaf 