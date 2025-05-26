# Local imports
from app.database.connectors.postgres import async_session

async def get_db():
    async with async_session() as session:
        yield session

