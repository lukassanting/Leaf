# Leaf

A FastAPI-based service with PostgreSQL database support.

## Development Setup

1. Start the development environment:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```
   The environment file (.env) will be automatically created from .env.example if it doesn't exist.

2. The API will be available at http://localhost:8000
   - API documentation: http://localhost:8000/docs
   - ReDoc documentation: http://localhost:8000/redoc

## Production Setup

1. Start the production environment:
   ```bash
   docker compose up --build
   ```
   Make sure your `.env` file is configured with the correct production settings.

## Database Migrations

The project uses Alembic for database migrations. Migrations are automatically applied when the application starts.

To manually run migrations:

```bash
# Development
docker compose -f docker-compose.dev.yml exec api poetry run alembic upgrade head

# Production
docker compose exec api poetry run alembic upgrade head
```

To create a new migration:

```bash
# Development
docker compose -f docker-compose.dev.yml exec api poetry run alembic revision --autogenerate -m "description of changes"

# Production
docker compose exec api poetry run alembic revision --autogenerate -m "description of changes"
```

## Development Features

- Hot-reloading enabled in development
- Local PostgreSQL database with persistent storage
- Poetry for dependency management
- Alembic for database migrations
- Docker Compose for easy setup
- Automatic environment file creation

## Production Features

- Optimized Docker image
- Environment variable configuration
- Health checks for database
- Production-ready PostgreSQL setup

```bash
poetry run alembic init alembic 
```

In `alembic.ini`, set `sqlalchemy.url = postgresql+asyncpg://postgres:postgres@db:5432/postgres`

In `alembic/env.py`, update

```python
from app.database.models.leaf_model import Leaf
from app.database.connectors.postgres import Base

target_metadata = Base.metadata
```

Then create and run the migrations:

```bash
poetry run alembic revision --autogenerate -m "create leaves table"
poetry run alembic upgrade head
```

## Running

```bash
docker compose up --build
```

```bash
docker compose down -f  
```
