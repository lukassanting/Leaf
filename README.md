# Leaf

A fast personal knowledge workspace with rich pages, inline databases, a local-first cache, and a schema-first editor model. **FastAPI** backend, **Next.js 15** frontend, and default **SQLite** runtime storage (with Alembic/MySQL migration tooling still present for legacy workflows).

## Quick start

**Prerequisites:** Python 3.11+, Node.js 20+, npm (for local dev), or **Docker** with Compose. For the Makefile: `make` (on Windows: [Chocolatey](https://chocolatey.org/) `choco install make`, or use WSL / Git Bash).

All commands below are from the **repo root** (`Leaf/`).

### Option A — Docker (one terminal)

```bash
make docker     # build + start API (:8000) and frontend (:3000); Ctrl+C to stop
make down       # stop containers (docker compose down)
```

### Option B — Local (two terminals)

1. **Install dependencies** (first time only):

   ```bash
   make install
   ```

2. **Start the app**:

   ```bash
   make api        # Terminal 1 — backend on http://localhost:8000
   make frontend   # Terminal 2 — frontend on http://localhost:3000
   ```

3. **Open** http://localhost:3000

4. **Stop**: Ctrl+C in each terminal (or `make down-api` / `make down-frontend` on Windows-friendly port cleanup).

## Debugging workflow

- Use `docs/DEBUGGING_PLAYBOOK.md` for a repeatable cross-stack workflow (route -> hook -> API client -> backend controller -> operations).

## Codebase map

- **`docs/CODEBASE.md`** — directory-by-directory and file-by-file purpose guide, documentation conventions (Purpose blocks), and three beginner practice tickets (backend → frontend → full stack).

## Makefile targets

| Target | Description |
|---|---|
| `make docker` / `make up` | Build + start full stack via Docker Compose (attached logs) |
| `make down` | Stop Docker Compose services |
| `make down-volumes` | Stop Compose and remove the `leaf_data` volume |
| `make logs` | Follow all container logs |
| `make shell-api` / `make shell-frontend` | Shell into a running container |
| `make api` | Start backend locally (FastAPI on :8000) |
| `make frontend` | Start frontend locally (Next.js on :3000) |
| `make down-api` / `make down-frontend` | Kill local processes on :8000 / :3000 |
| `make install` | Install all dependencies |
| `make test` | Frontend lint + backend checks |

## Cross-device sync

Leaf stores your pages as `.md` files with YAML frontmatter in a **data directory**. The SQLite database is a rebuildable index, not the source of truth — your Markdown files are. This means syncing is just about keeping that folder in sync across devices.

Sync is **off** by default. Everything is configured from the **Settings** page in the app — no command-line setup required.

### How it works

Leaf's data directory looks like this on disk:

```
~/Documents/Leaf/           # or wherever you choose
├── My first page.md        # each page is a .md file with YAML frontmatter
├── Meeting notes.md
├── projects/
│   └── Roadmap.md
├── .leaf.db                # SQLite index (auto-rebuilt, not synced)
└── .sync-config.json       # your sync preferences (auto-created)
```

Only the `.md` files matter. The database is rebuilt automatically from the files whenever needed.

### Setting up sync

1. Open **Settings** (gear icon in the sidebar, or go to `/settings`).
2. Under **Sync Mode**, choose:
   - **Folder sync** — for Google Drive, Dropbox, iCloud, or OneDrive.
   - **Git sync** — for GitHub, GitLab, or any Git remote.
3. Click **Save**. Changes take effect immediately and persist across restarts.

### Folder sync (Google Drive / Dropbox / OneDrive)

Best for most users. Your data directory just needs to live inside a cloud-synced folder.

- **Desktop:** Place your Leaf data folder inside your cloud client's sync folder (e.g. `~/Google Drive/Leaf/`, `~/OneDrive/Leaf/`, `~/Dropbox/Leaf/`). The cloud client handles upload/download; Leaf watches for incoming changes and updates the index.
- **How it works:** When another device edits a `.md` file and the cloud client downloads it, Leaf's file watcher detects the change and updates the local database. When you edit in Leaf, the file is written to disk and the cloud client uploads it.
- **Conflict handling:** If the cloud service creates conflict copies (e.g. `page (1).md`, `page (conflicted copy).md`), Leaf detects them automatically. A badge appears on the sync indicator in the sidebar, and the **Conflicts** section on the Settings page lets you choose: keep local, keep remote, or keep both.

### Git sync (GitHub / GitLab / any Git remote)

Best for users who want version history, or who prefer Git over a cloud drive.

1. Select **Git sync** in Settings.
2. Enter the **Remote URL** (HTTPS, e.g. `https://github.com/you/leaf-notes.git`).
3. If the repo is private, paste a **Personal Access Token** (PAT). For GitHub: create one at GitHub > Settings > Developer settings > Fine-grained tokens with **Contents** read/write permission.
4. Click **Test Connection** to verify.
5. Choose a **Sync interval** (default: every 5 minutes).
6. Click **Save**.

Leaf initializes a git repo in your data directory, creates a `.gitignore` (excludes the SQLite DB and metadata files), and starts a background loop: stage changes, commit, pull (rebase), push. The **Git Status** panel on Settings shows branch, remote, last commit, and any errors.

### Sync status indicator

The sidebar shows a sync indicator at the bottom:

- **Green dot** + "Watching" or "Synced Xm ago" — everything is healthy.
- **Yellow dot** + "Syncing..." — a sync cycle is in progress.
- **Red dot** + "Sync error" — something went wrong (click to see details in Settings).
- **Badge** — number of unresolved conflicts.

Click the indicator to jump to Settings.

### Sync dashboard (Settings page)

The Settings page shows:

- **Sync status**: current state, last synced time, pending file changes.
- **Sync Now**: triggers an immediate sync cycle.
- **Rebuild Index**: re-scans all `.md` files and rebuilds the SQLite database from scratch. Use this if the DB gets out of sync or after manually adding files.
- **Conflicts**: detected file conflicts with resolution options.

### For developers: enabling sync via environment variables

During development, you can also pre-set sync mode with env vars before starting the backend:

**macOS / Linux:**
```bash
SYNC_MODE=folder python -m uvicorn app.main:app --reload
```

**Windows (PowerShell):**
```powershell
$env:SYNC_MODE="folder"; python -m uvicorn app.main:app --reload
```

**Docker (dev only):** `make docker` (or `make up`) works without changes (sync defaults to off). Add `SYNC_MODE: folder` to the `api` environment block in `docker-compose.yml`, or just configure from the Settings page after the app starts. Note: for folder sync in Docker, you'd need to bind-mount a host directory instead of using the Docker volume so cloud clients can see the files.

## Data storage

Leaf uses SQLite as a fast index and stores all page content as `.md` files in the data directory (`backend/data/` by default). The SQLite database is auto-created on first startup — no migrations needed.

- **Data directory:** `backend/data/` (configurable via `DATA_DIR` in `backend/.env`)
- **Database:** `backend/data/.leaf.db` (auto-created, rebuildable from `.md` files via Settings > Rebuild Index)
- **Reset:** delete `backend/data/.leaf.db` and restart — the app creates a fresh database. Your `.md` files are preserved.

Alembic migration tooling is still present in `backend/migrations/` for legacy workflows but is not needed for normal use.

## Current status

Leaf is now on the v3 shell and editor architecture:

- **Schema-first content:** page bodies use structured `LeafDocument` JSON, with a migration path for legacy HTML content.
- **Stable editor core:** custom TipTap-based editor with slash commands and block menu (no static toolbar), selection bubble for text colour and alignment, campaign-style story tags and stat strips (2–4 cards via gutter menu), page embeds, inline database embeds, Markdown import/export, and rich/Markdown mode switching.
- **Workspace shell:** centered identity header, icon picker, content width modes, focus mode, bottom status bar, and a live right sidebar for metadata, tree navigation, and backlinks.
- **Design themes:** classic (emerald / light) and optional **Campaign** (D&D-inspired dark palette, gold accent, Cinzel / Crimson Pro typography, starfield). Choose **Appearance** under the top bar **Settings** (⋯); choice persists in `localStorage` (`leaf-design`).
- **Database parity:** standalone and inline databases share the same table, board, gallery, and list surfaces plus shared metadata handling.
- **Column layouts:** real nested column architecture (2–5 columns) with drag-to-create, resizable widths, minimal chrome (invisible gutters), and responsive stacking on mobile. Available via `/columns` slash commands or by dragging blocks side by side.
- **Local-first sync:** IndexedDB cache, offline queueing, debounced autosave, and conflict-aware content patching.
- **Cross-device sync:** Bidirectional `.md` file sync with watchdog-based file watcher, cloud conflict detection (Google Drive, Dropbox, OneDrive), and optional git-based sync (auto-commit/pull/push with PAT auth). Configurable from the Settings page.

## Features

- **Pages & tree:** Nested hierarchy (projects/pages), shared sidebar with search, collapse-all, expand/collapse per node, inline rename, delete, drag-and-drop reorder, and inline child-page creation.
- **Editor:** TipTap rich text with slash `/` and gutter **+** / grip menu for structure and marks (no top toolbar)—atom blocks such as **stat strip** use the same gutter for insert, drag, **delete**, colour, and column count (2–4 cards). **Selection bubble** for alignment and text colours when text is highlighted, inline **story flags** (variant pills; type `/flag` in slash menu), **callout** blocks (classic theme uses colored panels; campaign theme maps green/red/flavor to D&D-style panels), **stat strip** blocks (2–4 kicker/value cards), page/database embeds, resizable column layouts (2–5), drag-to-create columns, **Toggle Cards** (collapsible blocks; eyebrow/title/subtitle use a **filtered slash menu** for text style and flags—full block slash remains in the card body), optional Markdown source mode, and Markdown import/export. **Page outline** in the right sidebar jumps the cursor to headings when clicked.
- **Autosave:** Debounced PATCH to `/leaves/{id}/content` (~800 ms idle); Ctrl+S / Cmd+S to save immediately; optional conflict detection via `updated_at`.
- **Leaf metadata diagnostics:** Leaf responses now include `content_text_length` so frontend surfaces can display/search-index text-size context.
- **Local-first cache:** IndexedDB (with localStorage fallback) for instant page load and offline edits; pending saves sync when back online.
- **Databases:** Collections of pages as structured databases. Each entry is a real page. Views: Table, Board, Gallery, List. Schema-driven columns (text, number, date, tags, select). Edit column label/type from the table header (✎ or double-click the header); **delete** a property from the same “Edit property” dialog (removes the column and its values from every row). Embedded databases use the same editor as the full-page view. Deleting a database (sidebar or embed) moves it to **Trash** (data kept until purged). Gallery cards show each row’s **cover image** when the linked page has `properties.headerBanner`. "Name" always links to the entry page. Inline cell editing and add-column flows are shared between standalone and embedded databases.
- **Trash:** Deleted **pages** and **databases** go to Trash for **7 days** (configurable via `TRASH_RETENTION_DAYS` on the API), then are **permanently deleted**. Restore from **Settings → Trash**; opening that screen (and API startup) runs expiry cleanup.
- **Metadata parity:** Pages and databases both support title, description, tags, and icons. Pages can add an optional **cover image** (fixed frame, drag to set focal point); it is stored in `leaf.properties.headerBanner` and surfaces on database gallery cards.
- **Cross-device sync:** Folder sync watches for external file changes (Google Drive, Dropbox, OneDrive). Git sync auto-commits and pushes/pulls to a remote repo on a schedule. Cloud conflict detection and resolution UI. All configurable from the Settings page — no env vars or restarts needed.
- **Testing:** Backend integration coverage for leaves/databases and Playwright coverage for editor persistence, slash embeds, todo interaction, inline databases, and column layouts.
- **Stack:** Next.js 15 (App Router), FastAPI, SQLite, Tailwind CSS v4, TipTap.
- **Themes:** CSS variables in `globals.css`; `html[data-leaf-design="campaign"]` remaps tokens. Root layout loads Geist plus Cinzel / Cinzel Decorative / Crimson Pro for the campaign look.

## Next steps

The next recommended phase is:

1. Build search and a quick switcher (`Cmd+K`) on top of the structured content model.
2. Expand database capabilities with sort/filter/group configuration and richer property types.
3. CI workflow and production deployment hardening.

## Framework direction

Leaf should stay on React/Next for the web app.

- A full React/Next to Vue/Nuxt rewrite is not recommended at the current stage.
- The current product complexity is concentrated in editor/database behavior, not in the framework choice itself.
- Desktop should be evaluated as packaging the current web experience.
- Mobile should be treated as a separate client against the shared API and `LeafDocument` model.

See `docs/FRAMEWORK_DIRECTION.md` for the full decision and cross-platform guidance.

## Docker (optional)

Docker Compose runs the same API + frontend as local dev, with data in the named volume `leaf_data` (see `docker-compose.yml`).

```bash
make docker        # Build + start (attached; Ctrl+C stops containers)
make down          # docker compose down
make down-volumes  # down + remove volume (wipes container DB / data dir)
make logs          # Follow logs
```

Note: Docker uses its own data volume, separate from your local `backend/data/`. For production packaging, Leaf will be distributed as a desktop app (Electron/Tauri) — not as a Docker container.

## Project layout

```
Leaf/
├── CLAUDE.md                    # AI code editor instructions
├── README.md                    # ← this file
├── Makefile                     # make docker, down, api, frontend, test, install, …
├── docs/
│   ├── PLANS_AND_ROADMAP.md
│   ├── CODEBASE.md
│   ├── DEBUGGING_PLAYBOOK.md
│   ├── FRAMEWORK_DIRECTION.md
│   └── EDITOR_DESIGN.md
├── backend/                     # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── api/routes/          # leaf, database, sync controllers
│   │   ├── database/            # models, operations, connectors
│   │   ├── sync/                # file watcher, git sync, conflict detection
│   │   ├── dtos/                # request/response schemas
│   │   ├── main.py
│   │   └── config.py
│   ├── data/                    # .md files + .leaf.db (your data, not committed)
│   └── .env.example
├── frontend/                    # Next.js 15, Tailwind v4, TipTap
│   └── src/
│       ├── app/(workspace)/     # Editor, databases, settings routes
│       ├── components/          # Editor, sidebar, database surfaces, sync indicator
│       └── lib/                 # API clients, cache, document model
└── docker-compose.yml           # Optional Docker setup
```
