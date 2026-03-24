# Leaf — Claude Code instructions

## Role

You are helping build **Leaf**, a Notion-inspired personal knowledge manager. Stack: **Next.js 15** (App Router) + **FastAPI** + default **SQLite** runtime storage (with legacy MySQL/Alembic files still in-repo), run via Docker Compose from the repo root.

## Key rules

- **Always update docs after a meaningful change.** When you add a feature, fix a bug, or refactor something significant, update:
  - `README.md` — quick-start, features list, project layout
  - `docs/PLANS_AND_ROADMAP.md` — move items between "Implemented" and "Future"; update the key-files table; add new decisions
  - `docs/CODEBASE.md` — when you add/remove major modules or change where features live (file-purpose map + beginner tickets)
  - This file (`CLAUDE.md`) if the instructions themselves need updating

- **No perf-measurement hacks.** React Strict Mode double-invokes effects. Do not use `performance.mark` / `performance.measure` inside `useEffect`; it causes errors.

- **Route ordering in FastAPI matters.** Static paths (e.g. `/leaves/tree`) must be registered *before* parameterised paths (`/leaves/{leaf_id}`).

- **Tailwind v4 + PostCSS.** `postcss.config.mjs` must use ESM only — no `module.exports`. Tailwind plugins are declared with `@plugin` in `globals.css` or via the `postcss.config.mjs` plugins array. The old `tailwind.config.ts` `plugins:` array does **not** apply them in v4.

- **TipTap headings need explicit CSS.** Tailwind resets all heading styles. Add `.ProseMirror h1/h2/h3` rules in `globals.css` — do not rely on `@tailwindcss/typography`.
- **Rich text extensions:** `TextStyle` + `Color` + `TextAlign` on `paragraph`, `heading`, `blockquote`; inline `storyTag` (variant pill) and block `statStrip` (three kicker/title fields). Shared presets/swatches: `frontend/src/lib/editorRichText.ts`. No static formatting bar — use slash `/` and the gutter **+** menu for blocks/marks; alignment + colours use TipTap `BubbleMenu` (`EditorSelectionBubble.tsx`) when text is selected. Wire new slash actions in `SlashCommands.tsx` + `LeafEditor` `applyAction`.

- **Database rows ARE pages.** Each `database_rows` row has a `leaf_id` FK auto-created on insert. The linked leaf is the full page (title + content). `leaves.database_id` marks a leaf as a database entry — these are filtered out of the sidebar tree. The "Name" column in the database view is always the leaf title, edited via `leavesApi.update`, not `databasesApi.updateRow`.

- **Tags on leaves.** `leaves.tags` is a JSON array. The editor page exposes a chip input below the title. Always include `tags` in `leavesApi.update` calls to avoid clearing them.

- **Custom event bridge for cross-component updates.** Use `window.dispatchEvent(new CustomEvent('leaf-title-changed', { detail }))` to notify the sidebar when a page title changes. Listen in `SidebarTree` with `window.addEventListener`.

- **MySQL JSON columns can't have `server_default`.** Set `nullable=True` and handle `None` in Python. Use Python-side `default=dict` / `default=list` on the model column instead.

- **Alembic migrations must be idempotent.** Check `inspector.get_table_names()` / `inspector.get_columns()` before creating tables or adding columns.

- **`src/lib/api.ts` vs `src/lib/api/index.ts`.** TypeScript prefers the file over the directory. Keep only the directory (`src/lib/api/`) with an `index.ts`; delete any top-level `api.ts` that might shadow it.

- **Column layout is nested nodes, not atom blobs.** Columns use two TipTap node types: `columnList` (container, `content: 'column{2,6}'`) and `column` (child, `content: 'block+'`). Column content is real ProseMirror content — no nested `useEditor` instances. The old `columnLayout` atom node with `columns` JSON attribute is auto-migrated in `normalizeLeafDocument`. Do not nest `columnList` inside `column` (slash commands prevent this at runtime). Resize handles are overlay elements positioned via DOM measurement in `ColumnListView`.

- **TipTap `NodeViewContent` inserts an intermediate wrapper div.** When using `ReactNodeViewRenderer`, TipTap creates a `<div data-node-view-content-react>` inside `<div data-node-view-content>`. CSS targeting children of `NodeViewContent` must account for this extra nesting level. Use `querySelectorAll` instead of `.children` to find column elements. Column flex CSS targets both the outer and inner wrapper.

- **Windows CRLF in shell scripts.** Add `RUN sed -i 's/\r//' wait-for-it.sh && chmod +x wait-for-it.sh` in `backend/Dockerfile.dev`.

- **Sync subsystem architecture.** Bidirectional file sync lives in `backend/app/sync/`. The file watcher uses `watchdog` to detect external changes to `.md` files and reverse-syncs into SQLite via `FileToDbSyncer`. Self-write suppression (`FileStorage._recently_written`) prevents the watcher from re-ingesting API writes. Sync config is persisted to `DATA_DIR/.sync-config.json` and loaded at startup. The frontend settings page is at `/settings`. The `SyncStatusIndicator` in the sidebar polls `GET /sync/status` every 10s. Git sync (`git_sync.py`) initializes a git repo in DATA_DIR, auto-commits, pulls with rebase, and pushes on a configurable interval via `SyncScheduler`. The `.gitignore` excludes `.leaf.db*`, `.sync-manifest.json`, `.sync-conflicts.json`, and `.sync-config.json`. PAT auth is embedded in the remote URL. `git` must be installed on the host.

## Project layout (top-level)

```
Leaf/
├── CLAUDE.md                   # ← this file
├── README.md                   # quick start, features, layout
├── docs/PLANS_AND_ROADMAP.md   # vision, implemented, future
├── docker-compose.yml          # full stack
├── Makefile
├── backend/                    # FastAPI + Alembic + SQLAlchemy runtime
│   ├── app/
│   │   ├── api/routes/         # leaf_crud_controller, database_controller, sync_controller
│   │   ├── database/
│   │   │   ├── models/         # mysql_models.py
│   │   │   ├── operations/     # leaf_operations, database_operations
│   │   │   └── connectors/
│   │   ├── dtos/               # leaf_dtos, database_dtos, sync_dtos
│   │   ├── sync/               # bidirectional file sync subsystem
│   │   │   ├── file_to_db.py   # reverse sync: .md → SQLite
│   │   │   ├── file_watcher.py # watchdog-based live change detection
│   │   │   ├── manifest.py     # SHA-256 file manifest for diff detection
│   │   │   ├── conflict_store.py # persisted conflict tracking
│   │   │   ├── cloud_detector.py # Google Drive/Dropbox/OneDrive conflict copies
│   │   │   ├── git_sync.py     # git auto-commit/pull/push engine
│   │   │   └── scheduler.py    # periodic background sync loop
│   │   ├── main.py
│   │   └── config.py
│   └── migrations/versions/
└── frontend/                   # Next.js 15 App Router
    └── src/
        ├── app/
        │   ├── layout.tsx                          # root: fonts + DesignThemeProvider + theme script
        │   ├── (workspace)/
        │   │   ├── layout.tsx                      # shared sidebar
        │   │   ├── page.tsx                        # home / empty state
        │   │   ├── editor/[id]/page.tsx            # page editor
        │   │   ├── settings/page.tsx               # sync config + status + conflicts
        │   │   └── databases/
        │   │       ├── page.tsx                    # database list
        │   │       └── [id]/page.tsx               # database table view
        │   └── globals.css         # design tokens; `data-leaf-design="campaign"` for D&D-style theme
        ├── components/
        │   ├── Editor.tsx          # TipTap rich/markdown editor
        │   ├── TopStrip.tsx        # breadcrumbs + classic/campaign design toggle
        │   ├── DesignThemeProvider.tsx
        │   ├── Sidebar.tsx         # sidebar with new-page / new-db buttons
        │   ├── SidebarTree.tsx     # leaf tree, search, drag-drop, rename
        │   └── SyncStatusIndicator.tsx # sidebar sync status dot + badge
        └── lib/
            ├── api/                # typed API clients (leaves, databases, sync)
            │   ├── index.ts
            │   ├── types.ts
            │   ├── leaves.ts
            │   ├── databases.ts
            │   ├── sync.ts         # sync API client
            │   └── syncTypes.ts    # sync TypeScript interfaces
            ├── designTheme.ts      # leaf-design localStorage + html data attribute
            ├── apiBase.ts          # API_BASE_URL env resolution
            └── leafCache.ts        # IndexedDB cache + offline queue
```

## Common commands

```bash
make up              # build + start full stack
make down            # stop
make down-volumes    # stop + wipe DB
make logs            # follow all logs
make shell-api       # sh into API container
make shell-frontend  # sh into frontend container
```

Run Alembic inside the API container:

```sh
alembic revision --autogenerate -m "description"
alembic upgrade head
```
