# Leaf

An ongoing project for a simple Markdown text editor, with page storage and generative AI integration. A FastAPI-based service with MySQL database support.

## Development Setup

1. Install and set up Poetry (if not already installed)

2. Install project dependencies

   ```bash
   poetry install
   ```

In order to the docker you will have to have Docker running on your device.

3. Start the development environment:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

   Down the docker with
   ```
   docker compose down -v
   ```

4. The API will be available at http://localhost:8000
   - API documentation: http://localhost:8000/docs
   - ReDoc documentation: http://localhost:8000/redoc

## Production Setup (NOTE: Placeholder, Untested)

1. Start the production environment:
   ```bash
   docker compose up --build
   ```
   Make sure your `.env` file is configured with the correct production settings.

## Database Migrations

The project uses Alembic for database migrations. Migrations are automatically applied when the application starts.

### Async vs Sync Database URLs
- **App runtime:** Uses the async driver (`mysql+aiomysql://...`).
- **Alembic migrations:** Must use the sync driver (`mysql+pymysql://...`).

> **Troubleshooting:**
> If you see an error like `MissingGreenlet: greenlet_spawn has not been called; can't call await_only() here`, it means Alembic is trying to use the async driver. Make sure your Alembic config uses the sync driver (`pymysql`).

### Running Alembic inside Docker (Recommended)

**It is recommended to enter the API container and run Alembic commands from inside.** This ensures the correct environment and network settings (e.g., the `db` hostname) are used.

#### Enter the container:

```bash
docker exec -it leafapi sh
```

#### Then, inside the container, cd into the right directory and  run Alembic commands:

```sh
cd /app
alembic revision --autogenerate -m "Description of update"
alembic upgrade head
```

### Inspecting the persistent database

Inspect the MySQL volume

```sh
docker volume inspect backend_mysql_data
```

This should reveal something like:
```sh
[
    {
        "CreatedAt": "2025-06-14T11:06:32Z",
        "Driver": "local",
        "Labels": {
            "com.docker.compose.config-hash": "567e60c16fe07cb5369dbae37739c19ead97ec4cf900ed9031152476c2c08e69",
            "com.docker.compose.project": "backend",
            "com.docker.compose.version": "2.34.0",
            "com.docker.compose.volume": "mysql_data"
        },
        "Mountpoint": "/var/lib/docker/volumes/backend_mysql_data/_data",
        "Name": "backend_mysql_data",
        "Options": null,
        "Scope": "local"
    }
]
```


When the volume is not in use, the MySQL db can be intentionally deleted with:

```sh
docker volume rm backend_mysql_data
```

## Development Features

- Hot-reloading enabled in development
- Local MySQL database with persistent storage
- Poetry for dependency management
- Alembic for database migrations
- Docker Compose for easy setup
- Automatic environment file creation

## Production Features (Placeholder, Untested)

- Optimized Docker image
- Environment variable configuration
- Health checks for database
- Production-ready MySQL setup

```bash
poetry run alembic init alembic 
```

In `alembic.ini`, set `sqlalchemy.url = mysql+pymysql://user:pass@host:3306/db`

In `alembic/env.py`, update

```python
from app.database.models.leaf_model import Leaf, Base

target_metadata = Base.metadata
```

This makes sure that alembic takes any changes to your models into account when running the migrations

Then create and run the migrations:

```bash
poetry run alembic revision --autogenerate -m "create leaves table"
poetry run alembic upgrade head
```
