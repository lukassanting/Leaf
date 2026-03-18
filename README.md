# Leaf

A fast, Notion-inspired workspace with rich pages, inline databases, a local-first cache, and a schema-first editor model. **FastAPI** backend, **Next.js 15** frontend, **MySQL**.

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

   Runs the frontend linter and backend checks. To run tests inside Docker:

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

## Current status

Leaf is now on the v3 shell and editor architecture:

- **Schema-first content:** page bodies use structured `LeafDocument` JSON, with a migration path for legacy HTML content.
- **Stable editor core:** custom TipTap-based editor with slash commands, block insertion, page embeds, inline database embeds, Markdown import/export, and rich/Markdown mode switching.
- **Workspace shell:** centered identity header, icon picker, content width modes, focus mode, bottom status bar, and a live right sidebar for metadata, tree navigation, and backlinks.
- **Database parity:** standalone and inline databases share the same table, board, and gallery surfaces plus shared metadata handling.
- **Column layouts:** persisted 2-column and 3-column layout blocks with inline editing and in-block drag reordering.
- **Local-first sync:** IndexedDB cache, offline queueing, debounced autosave, and conflict-aware content patching.

## Features

- **Pages & tree:** Notion-like hierarchy (projects/pages), shared sidebar with search, collapse-all, expand/collapse per node, inline rename, delete, drag-and-drop reorder, and inline child-page creation.
- **Editor:** TipTap rich text with slash insertion, block menu, page/database embeds, 2-column and 3-column layout blocks, optional Markdown source mode, and Markdown import/export.
- **Autosave:** Debounced PATCH to `/leaves/{id}/content` (~800 ms idle); Ctrl+S / Cmd+S to save immediately; optional conflict detection via `updated_at`.
- **Local-first cache:** IndexedDB (with localStorage fallback) for instant page load and offline edits; pending saves sync when back online.
- **Databases:** Notion-style collections of pages. Each entry is a real page. Views: Table, Board, Gallery. Schema-driven columns (text, number, tags, select). "Name" always links to the entry page. Inline cell editing and add-column flows are shared between standalone and embedded databases.
- **Metadata parity:** Pages and databases both support title, description, tags, and icons.
- **Testing:** Backend integration coverage for leaves/databases and Playwright coverage for editor persistence, slash embeds, todo interaction, inline databases, and column layouts.
- **Stack:** Next.js 15 (App Router), FastAPI, MySQL, Tailwind CSS v4, TipTap, Docker Compose.

## Next steps

The next recommended phase is:

1. Upgrade column layouts from lightweight text columns to true nested block columns.
2. Add a real block drag handle for document-level reordering, not just column-internal drag.
3. Build search and a quick switcher (`Cmd+K`) on top of the structured content model.
4. Expand database capabilities with sort/filter/group configuration and richer property types.
5. Add conflict-resolution UI and broader CI/production hardening.

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
├── LEAF_DESIGN_GUIDE.md  # visual design source of truth
├── docs/
│   ├── EDITOR_DESIGN.md
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
        ├── app/(workspace)/     # Shared layout with sidebar and editor/database routes
        ├── components/          # Editor, database surfaces, headers, sidebar
        └── lib/                 # API clients, cache, document model, types
```
