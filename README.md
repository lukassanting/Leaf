# Leaf

A personal knowledge workspace with rich pages, inline databases, and cross-device sync. **FastAPI** backend, **Next.js 15** frontend, **SQLite** storage.

## Quick start

**Prerequisites:** Docker + Compose, or Python 3.11+ and Node.js 20+ for local dev. On Windows, get `make` via [Chocolatey](https://chocolatey.org/) (`choco install make`) or use WSL / Git Bash.

All commands from the **repo root** (`Leaf/`).

### Docker

```bash
make docker     # build + start API (:8000) and frontend (:3000)
make down       # stop containers
```

### Local (two terminals)

```bash
make install            # first time only
make api                # Terminal 1 — backend on :8000
make frontend           # Terminal 2 — frontend on :3000
```

## Makefile targets

| Target | Description |
|---|---|
| `make docker` / `make up` | Build + start full stack (attached logs) |
| `make down` | Stop Docker Compose services |
| `make down-volumes` | Stop + remove `leaf_data` volume |
| `make logs` | Follow all container logs |
| `make shell-api` / `make shell-frontend` | Shell into a running container |
| `make api` / `make frontend` | Start backend / frontend locally |
| `make down-api` / `make down-frontend` | Kill local processes on :8000 / :3000 |
| `make install` | Install all dependencies |
| `make test` | Frontend lint + backend checks |

## Features

- **Pages & tree:** Nested hierarchy, sidebar with search, drag-and-drop reorder, inline rename/delete, child-page creation.
- **Editor:** TipTap rich text. Slash `/` and gutter `+` menu for blocks (no top toolbar). Selection bubble for alignment, text colour, clear colour, and link panel (search pages, web link, bookmark card, remove link). **Ctrl+K** / **⌘K** opens the link panel when there is no text selection. Callouts, stat strips, story flags, toggle cards, column layouts (2–5), page/database embeds, Markdown tables (GFM), optional Markdown source mode, import/export.
- **Autosave:** Debounced PATCH (~800 ms idle); Ctrl+S / Cmd+S to save immediately.
- **Databases:** Collections where each row is a real page. Views: Table, Board, Gallery, List. Schema columns (text, number, date, tags, select). Resizable column headers. Standalone and inline (embedded) modes.
- **Trash:** Deleted pages and databases kept for 7 days (configurable via `TRASH_RETENTION_DAYS`), then permanently purged. Restore from **Settings → Trash**.
- **Local-first cache:** IndexedDB for instant load and offline edits; pending saves queue and sync when back online.
- **Cross-device sync:** Folder sync (Google Drive, Dropbox, OneDrive) and Git sync (auto-commit/pull/push). Conflict detection and resolution UI. Configured from **Settings** — no restarts needed.
- **Themes:** Classic (emerald/light) and **Campaign** (D&D dark palette, gold accent, Cinzel typography). Toggle via the top-bar `⋯` menu.

## Cross-device sync

Pages are stored as `.md` files with YAML frontmatter. The SQLite DB is a rebuildable index — your Markdown files are the source of truth.

Sync is **off** by default. Configure it from **Settings** in the app.

### Folder sync (Google Drive / Dropbox / OneDrive)

Place your data directory inside a cloud-synced folder. Leaf's file watcher picks up external changes and updates the index. Conflict copies (e.g. `page (conflicted copy).md`) are detected automatically and shown in **Settings → Conflicts**.

### Git sync

1. Select **Git sync** in Settings and enter the remote URL (HTTPS).
2. For private repos, paste a **Personal Access Token** (PAT) with `Contents` read/write.
3. Click **Test Connection**, set a sync interval, and **Save**.

Leaf initializes a git repo in your data directory and runs: stage → commit → pull (rebase) → push on the configured interval. `.gitignore` excludes the SQLite DB and metadata files.

### Sync status

The **status bar** (bottom of every workspace page) shows sync state when enabled. Click it to trigger an immediate sync. The **Settings** page shows last sync time, pending changes, conflicts, and a **Rebuild Index** option.

## Data storage

- **Data directory:** `backend/data/` (set via `DATA_DIR` in `backend/.env`)
- **Database:** `backend/data/.leaf.db` — auto-created on first start, rebuildable via **Settings → Rebuild Index**
- **Reset:** delete `.leaf.db` and restart; your `.md` files are preserved

## Project layout

```
Leaf/
├── Makefile
├── docker-compose.yml
├── docs/                        # PLANS_AND_ROADMAP, CODEBASE, DEBUGGING_PLAYBOOK, …
├── backend/                     # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── api/routes/          # leaf, database, sync controllers
│   │   ├── database/            # models, operations, connectors
│   │   ├── sync/                # file watcher, git sync, conflict detection
│   │   └── dtos/
│   └── data/                    # .md files + .leaf.db (your data, not committed)
└── frontend/                    # Next.js 15, Tailwind v4, TipTap
    └── src/
        ├── app/(workspace)/     # editor, databases, settings routes
        ├── components/          # Editor, Sidebar, database surfaces, StatusBar
        └── lib/                 # API clients, cache, document model
```

Further reading: **`docs/CODEBASE.md`** (file-by-file map), **`docs/DEBUGGING_PLAYBOOK.md`** (cross-stack workflow), **`docs/PLANS_AND_ROADMAP.md`** (roadmap), **`docs/FRAMEWORK_DIRECTION.md`** (desktop/mobile strategy).

## Roadmap

- **Fixes:** gutter positioning, initial render speed, page outline accuracy
- **Editor:** coloured text highlighting, page templates, better icons, styled link cards & link elements, image banners
- **Databases:** filtering, search, row templates
- **Apps:** Windows desktop, Android, macOS, iOS, Linux
- **AI:** semantic search, AI generation, auto-tagging
- **Infra:** command palette (`Ctrl+K`, `⌘+K` on macOS), CI + production deployment

## Known issues

**"Failed to load chunk" (Turbopack):** Clear `.next` and restart.

```bash
# macOS / Linux / Git Bash
rm -rf .next && npm run dev

# Windows PowerShell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue; npm run dev
```

Then hard-refresh the browser (Ctrl+Shift+R).

**Low memory / `ENOMEM` on `scandir` (Docker Desktop / Windows):** Give Docker Desktop more RAM (4 GiB+). The API runs without `--reload` to keep file watching lighter; use `make api` + `make frontend` locally if you need hot reload.
