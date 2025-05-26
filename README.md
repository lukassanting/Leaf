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

### Async vs Sync Database URLs
- **App runtime:** Uses the async driver (`postgresql+asyncpg://...`).
- **Alembic migrations:** Must use the sync driver (`postgresql+psycopg2://...`).

> **Troubleshooting:**
> If you see an error like `MissingGreenlet: greenlet_spawn has not been called; can't call await_only() here`, it means Alembic is trying to use the async driver. Make sure your Alembic config uses the sync driver (`psycopg2`).

### Running Alembic inside Docker (Recommended)

**It is recommended to enter the API container and run Alembic commands from inside.** This ensures the correct environment and network settings (e.g., the `db` hostname) are used.

#### Enter the container:

```bash
docker exec -it leaf-api-1 sh
```

#### Then, inside the container, run Alembic commands:

```sh
# Create a new migration
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head
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

In `alembic.ini`, set `sqlalchemy.url = postgresql+psycopg2://user:pass@host:5432/db`

In `alembic/env.py`, update

```python
from app.database.models.leaf_model import Leaf
from app.database.connectors.base import Base

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
docker compose down -v
```
