# Leaf

A fast, Notion-inspired markdown editor with page trees, local-first cache, and database (table) views. **FastAPI** backend, **Next.js 15** frontend, **MySQL**.

## Quick start (Docker + Make)

**Prerequisites:** Docker and Docker Compose. For the Makefile: `make` (on Windows: WSL, Git Bash, or [Chocolatey](https://chocolatey.org/) `choco install make`). The `make up` and `make build` targets also require **Python** (used to create `backend/.env` from `.env.example` if missing).

All commands below are from the **repo root** (`Leaf/`).

1. **Start the full stack** (MySQL + API + frontend):

   ```bash
   make up
   ```

   This creates `backend/.env` from `backend/.env.example` when needed, then runs `docker compose up --build`.
   **Windows:** If `make up` fails on the `env` step (e.g. "Python not found"), create the env file manually:

   ```cmd
   copy backend\.env.example backend\.env
   docker compose up --build
   ```

   **Without Make:**

   ```bash
   cp backend/.env.example backend/.env   # macOS/Linux
   # or: copy backend\.env.example backend\.env   # Windows
   docker compose up --build
   ```

2. **Open the app**

   - **Frontend:** http://localhost:3000
   - **API:** http://localhost:8000
   - **API docs:** http://localhost:8000/docs

3. **Run tests**

   ```bash
   make test
   ```

   Runs the frontend linter (and lightweight backend checks). To run tests inside Docker:

   ```bash
   make test-in-docker
   ```

4. **Stop**

   ```bash
   make down
   ```

   To also remove the database volume: `make down-volumes`.

## Makefile targets

| Target              | Description                          |
|---------------------|--------------------------------------|
| `make up`           | Start all services (builds if needed) |
| `make up-d`         | Start in background                  |
| `make down`         | Stop containers                      |
| `make down-volumes` | Stop and remove DB volume            |
| `make build`        | Build images only                    |
| `make test`         | Frontend lint + backend checks       |
| `make logs`         | Follow logs                          |
| `make shell-api`    | Shell into API container              |
| `make shell-frontend` | Shell into frontend container      |

## Development without Docker

1. **Backend:** In `backend/` run `poetry install`. Copy `backend/.env.example` to `backend/.env` and set `MYSQL_HOST=127.0.0.1`, `MYSQL_PORT=3306` (or `3307` if MySQL is only in Docker). Start the API:

   ```bash
   cd backend && poetry run uvicorn app.main:app --reload
   ```

2. **Frontend:** In `frontend/` run `npm install`. Set `NEXT_PUBLIC_API_URL=http://localhost:8000`, then:

   ```bash
   cd frontend && npm run dev
   ```

3. **MySQL only in Docker:** From repo root, `docker compose up mysqldb -d` to run just the database.

## Database migrations

The project uses **Alembic**. Migrations run automatically on API startup unless `RUN_MIGRATIONS_ON_STARTUP=false` is set in `backend/.env` (useful for production where you run migrations separately).

- **App runtime:** Sync driver `mysql+pymysql`.
- **Alembic:** Use the sync driver in `alembic.ini` / `env.py` (`pymysql`). If you see `MissingGreenlet` or async-related errors, ensure Alembic is not using an async URL.

### Running Alembic inside Docker

From repo root, enter the API container (name used by root `docker-compose.yml` is `leaf-api`):

```bash
docker exec -it leaf-api sh
```

Inside the container:

```sh
cd /app
alembic revision --autogenerate -m "Description of update"
alembic upgrade head
```

### Inspecting or removing the DB volume

With the root `docker-compose.yml`, the MySQL volume is named `leaf_mysql_data`:

```bash
docker volume inspect leaf_mysql_data
# remove when containers are stopped:
docker volume rm leaf_mysql_data
```

## Features

- **Pages & tree:** Notion-like hierarchy (projects/pages), shared sidebar with search, collapse-all, expand/collapse per node, inline rename, delete, drag-and-drop reorder, and inline child-page creation.
- **Editor:** TipTap rich text with formatting toolbar (H1–H3, bold, italic, strikethrough, lists, code, blockquote); optional Markdown source mode with round-trip (turndown + markdown-it); Import/Export `.md`. Inline editable title with debounced sidebar refresh.
- **Autosave:** Debounced PATCH to `/leaves/{id}/content` (~800 ms idle); Ctrl+S / Cmd+S to save immediately; optional conflict detection via `updated_at`.
- **Local-first cache:** IndexedDB (with localStorage fallback) for instant page load and offline edits; pending saves sync when back online.
- **Databases:** Notion-style collections of pages. Each entry is a real page (openable as a full editor page). Views: Table, List, Gallery. Schema-driven columns (text, number, tags). "Name" column always links to the page. Inline cell editing (double-click to edit).
- **Tags:** Pages have editable tags (chip input below the title). Tags column type available in database schemas, rendered as colored chips in all views.
- **Typography:** Explicit heading sizes (H1 > H2 > H3 > body) via `.ProseMirror` CSS; no reliance on `@tailwindcss/typography`.
- **Stack:** Next.js 15 (App Router), FastAPI, MySQL, Tailwind CSS v4, TipTap, Docker Compose.

## Production (placeholder)

The root `docker-compose.yml` is aimed at development. For production you would typically:

- Use a separate `docker-compose.prod.yml` or CI step that builds production images (e.g. multi-stage backend, `next build` + `next start` for frontend).
- Set `RUN_MIGRATIONS_ON_STARTUP=false` and run `alembic upgrade head` in a dedicated step or init job.
- Configure env (secrets, `ALLOWED_ORIGINS`, DB URL) for production.

## Project layout

```
Leaf/
├── CLAUDE.md             # AI code editor instructions and project context
├── README.md             # ← this file
├── docs/
│   └── PLANS_AND_ROADMAP.md
├── docker-compose.yml    # Full stack: mysqldb, api, frontend (run from root)
├── Makefile              # up, down, test, logs, etc.
├── backend/              # FastAPI, Poetry, Alembic
│   ├── app/
│   ├── migrations/
│   ├── Dockerfile.dev
│   ├── docker-compose.dev.yml   # Backend + MySQL only
│   └── .env.example
└── frontend/             # Next.js 15 App Router, Tailwind v4, TipTap
    └── src/
        ├── app/(workspace)/     # Shared layout with sidebar
        ├── components/          # Editor, Toolbar, Sidebar, SidebarTree
        └── lib/                 # API clients, cache, types
```
