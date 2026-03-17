# Leaf — Plans and Roadmap

A single reference for product vision, what's done, and what's next. Use this with a code editor and planner to keep work aligned.

---

## 1. Vision and goals

- **Product:** A fast, Notion-inspired markdown editor for personal knowledge management ("second brain"), with a focus on performance and a clear page/database structure.
- **Performance:** Instant feel — fast startup, snappy navigation, lag-free typing even on large documents.
- **Editor:** Markdown-first mental model while keeping a rich editor (TipTap/ProseMirror); optional markdown source mode and export/import.
- **Structure:** Hierarchical project/page tree (Notion-like), plus database (table) views with flexible properties and relations to pages.
- **Architecture:** Next.js + FastAPI + MySQL; local-first behavior, debounced sync, optional offline support.
- **Platform:** Desktop and web first; mobile considered later.

---

## 2. High-level architecture

- **Frontend:** Next.js 15 (App Router), React 19, TipTap, Tailwind CSS v4. Reads/writes via REST; uses local cache (IndexedDB / localStorage) for instant load and offline queue.
- **Backend:** FastAPI, SQLAlchemy, MySQL. REST API for leaves (CRUD, tree, PATCH content, reorder children), databases, and rows.
- **Data flow:** Editor state is local-first; changes sync with debounced autosave (PATCH content). Sidebar and pages load from cache first, then revalidate from API. Pending saves when offline flush when back online.

```
User → Next.js frontend (editor + sidebar) ⇄ Local cache (IndexedDB)
                ↓
         FastAPI backend ⇄ MySQL (leaves, databases, database_rows)
```

---

## 3. Implemented (current state)

### Editor and autosave

- [x] Debounced autosave (~800 ms idle) in `(workspace)/editor/[id]/page.tsx`; typing stays local.
- [x] Save status indicator: "Saving… / Saved / Error / Saved locally (offline)".
- [x] Keyboard shortcut: Ctrl+S / Cmd+S to save immediately.
- [x] PATCH `/leaves/{id}/content` for content-only updates; optional `updated_at` for conflict detection.
- [x] Editor loads from local cache first, then revalidates from API; writes update cache and sync to API (or queue when offline).
- [x] Inline editable title in the editor header; dispatches `leaf-title-changed` window event to refresh the sidebar without a full re-fetch.

### Markdown and formatting

- [x] Rich / Markdown toggle in the editor.
- [x] Formatting toolbar: H1–H3, Bold, Italic, Strikethrough, Inline Code, Bullet list, Ordered list, Code block, Blockquote.
- [x] Round-trip: HTML ↔ Markdown via **turndown** (HTML→MD) and **markdown-it** (MD→HTML).
- [x] Import .md (file picker) and Export .md (download).
- [x] Explicit heading sizes (H1 > H2 > H3 > body) via `.ProseMirror` rules in `globals.css`.

### Navigation and sidebar

- [x] Persistent Notion-like sidebar with tree of projects/pages; shared across all workspace routes via `(workspace)/layout.tsx`.
- [x] Sidebar: search (filter by title), collapse all, expand/collapse per node; state persisted to `localStorage`.
- [x] Context menu: Rename (inline), Delete (with confirm).
- [x] Inline `+` button on hover to create a child page directly in the tree.
- [x] Drag-and-drop reorder of siblings; `PUT /leaves/{parent_id}/reorder-children` with `{ child_ids }`.
- [x] Sidebar title updates reactively when a page title is saved in the editor (`leaf-title-changed` event).
- [x] Sidebar: single "New page" button; databases listed for navigation; refreshes via `leaf-database-created` event.
- [x] Databases created from within the editor page ("⊞ New database" button), dispatching `leaf-database-created` to refresh the sidebar.

### Backend API and data

- [x] `GET /leaves/tree` — lightweight tree items (id, title, type, parent_id, children_ids, order).
- [x] `PATCH /leaves/{id}/content` — body: `{ content, updated_at? }`.
- [x] `PUT /leaves/{id}/reorder-children` — body: `{ child_ids }`.
- [x] Full CRUD for leaves; tree and reorder keep `children_ids` and `order` consistent.
- [x] `RUN_MIGRATIONS_ON_STARTUP` config (default true).
- [x] Typed API client in `frontend/src/lib/api/` (leaves, databases, shared types).

### Local-first and offline

- [x] `frontend/src/lib/leafCache.ts`: IndexedDB (with localStorage fallback) for leaves and tree.
- [x] Editor: load from cache → show immediately → fetch API → merge; save → write cache + PATCH (or enqueue when offline).
- [x] Sidebar: show cached tree first, then fetch and update cache.
- [x] Pending-saves queue when offline; flush on `online` event and on mount when online.

### Databases (Notion-like collections of pages)

- [x] Backend: `databases` and `database_rows` tables; each row auto-creates a linked `leaves` page (`leaf_id` FK).
- [x] `leaves.database_id` — database-linked leaves are hidden from the sidebar tree.
- [x] `databases.view_type` — persisted per database: `table | list | gallery`.
- [x] API: CRUD for `/databases` and `/databases/{id}/rows`; row create/delete cascades to linked leaf.
- [x] Frontend: `/databases` (list + create), `/databases/[id]` (page-like layout, editable title).
- [x] View switcher tabs: Table | List | Gallery (Board planned).
- [x] **Name column** always shown first — displays the linked leaf title, double-click to rename, hover `↗` to open as full page.
- [x] Schema-driven extra columns; `tags` column type renders comma-separated chips.
- [x] Inline cell editing (double-click); add column modal (text / number / tags).
- [x] Add/delete entries; each entry is a real page that can hold content.

### Tags

- [x] `leaves.tags` JSON array — editable chip input below the title in the editor page.
- [x] Tags column type in database schemas — chips display in all view types.
- [x] Tags preserved across title saves.

### Design and UX

- [x] Tailwind v4; leaf/earth palette; explicit typography rules in `globals.css`.
- [x] Editor and database view share the same page layout: `max-w-3xl mx-auto px-12 py-12`, large editable title.
- [x] Sidebar: "New page" and "New database" labeled buttons, databases section, active page highlight.
- [x] `postcss.config.mjs` uses ESM only (no conflicting `module.exports`).

### DevOps and DX

- [x] Root `docker-compose.yml`: mysqldb + api + frontend; single `make up` / `docker compose up --build`.
- [x] Makefile: `up`, `up-d`, `down`, `down-volumes`, `build`, `test`, `logs`, `shell-api`, `shell-frontend`.
- [x] Docker healthcheck on API; frontend `depends_on` uses `condition: service_healthy`.
- [x] CRLF fix for `wait-for-it.sh` in `backend/Dockerfile.dev`.
- [x] `CLAUDE.md` at repo root with project instructions, key rules, and layout.

---

## 4. Future / optional next steps

### Performance and scale

- Add pagination (or cursor) to `GET /leaves` for large workspaces.
- Lazy-load sidebar children on expand instead of loading the full tree every time.
- Preload adjacent or recent pages on navigation to make it feel instant.

### Editor

- Richer markdown support: full CommonMark/GFM in the Markdown view with faithful round-trip.
- Slash commands (e.g. `/heading`, `/code`) like Notion.
- Optional block-based schema while keeping export/import to plain markdown.

### Sidebar and navigation

- "Favorites" or "Recent" section in the sidebar.
- Move page to another parent (drag to a different folder / drag into a node).
- Quick open (Cmd+K) modal to jump to any page.

### Databases

- Board (kanban) view — group entries by a select/status column.
- Relation columns that link entries across databases.
- Sorting and filtering entries by column value.
- Calendar view for date columns.

### Local-first and sync

- Conflict UI when `updated_at` conflict is detected (e.g. "Someone else edited this; merge or overwrite?").
- **CRDT-based multi-device sync** — see architecture note below.

### CRDT upgrade path (planned — no migration required)

The storage architecture was designed so that adding CRDT-based sync later is a file addition, not a schema change. Current hybrid layout:

```
data/
  pages/{uuid}.md          ← source of truth (YAML frontmatter + Markdown)
  databases/{uuid}/
    meta.json              ← database metadata
    rows/{uuid}.md         ← row pages
  .leaf.db                 ← SQLite index (rebuild-able from files at any time)
```

To add CRDT sync (Yjs / Automerge), only one new directory is needed:

```
data/
  ops/{uuid}.jsonl         ← NEW: append-only op log per document
                              each line: { clock, site_id, op_type, payload }
```

Migration steps (no data loss):
1. Scan all `pages/*.md` files — each becomes a single synthetic "init" op in `ops/{uuid}.jsonl`.
2. Switch write path from "write HTML → file" to "append op → derive current state".
3. `.md` files become snapshots regenerated from CRDT state (same format, same AI readability).
4. SQLite index is rebuilt from CRDT state instead of from `.md` directly.
5. Sync = exchange op logs between devices. Last-write-wins per op, no full-file transfers.

Reserved frontmatter fields already in every `.md` file:
- `crdt_checkpoint_id: null` — ID of the op log entry this snapshot was generated from
- `crdt_site_id: null` — device/site that wrote this snapshot

These are `null` until CRDT is added. AIs reading the files today will see them and understand the intent.

### Testing and quality

- Backend: pytest for leaf CRUD, tree, PATCH content, reorder, databases/rows.
- Frontend: Playwright E2E tests for core flows (create page, type, autosave, sidebar navigation, create database + row).
- CI: lint + tests on push/PR.

### Production readiness

- Production Docker setup: multi-stage backend, `next build` + `next start` frontend.
- Env and secrets: production `ALLOWED_ORIGINS`, DB URL, no secrets in repo.
- Optional: rate limiting, auth (per-user or per-workspace), backup = `cp -r data/ backup/`.

### Polish and accessibility

- Light/dark theme toggle stored in localStorage.
- Keyboard shortcuts: quick open (Cmd+K), new page, toggle sidebar.
- ARIA and screen-reader-friendly sidebar and editor.

---

## 5. Key files (for editors and planners)

### Frontend

| Path | Purpose |
|------|---------|
| `frontend/src/app/layout.tsx` | Root layout — fonts only, no sidebar |
| `frontend/src/app/(workspace)/layout.tsx` | Shared workspace layout with sidebar |
| `frontend/src/app/(workspace)/page.tsx` | Home: empty state, create page |
| `frontend/src/app/(workspace)/editor/[id]/page.tsx` | Editor: load/save leaf, autosave, cache, offline queue |
| `frontend/src/app/(workspace)/databases/page.tsx` | Database list + create |
| `frontend/src/app/(workspace)/databases/[id]/page.tsx` | Database table view, editable title, schema columns |
| `frontend/src/components/Editor.tsx` | TipTap editor, Rich/Markdown toggle, Import/Export |
| `frontend/src/components/EditorToolbar.tsx` | Formatting toolbar (H1–H3, bold, lists, code, blockquote) |
| `frontend/src/components/Sidebar.tsx` | Sidebar with new-page / new-database buttons |
| `frontend/src/components/SidebarTree.tsx` | Tree, search, expand state, drag-drop, inline child creation |
| `frontend/src/lib/api/index.ts` | Re-exports all typed API clients and types |
| `frontend/src/lib/api/types.ts` | TypeScript interfaces (Leaf, Database, Row, etc.) |
| `frontend/src/lib/api/leaves.ts` | Typed leaves API client |
| `frontend/src/lib/api/databases.ts` | Typed databases/rows API client |
| `frontend/src/lib/apiBase.ts` | `API_BASE_URL` env resolution |
| `frontend/src/lib/leafCache.ts` | IndexedDB/localStorage cache and pending-saves queue |
| `frontend/src/app/globals.css` | Theme variables, ProseMirror heading styles, scrollbars |
| `frontend/tailwind.config.ts` | Tailwind theme (leaf/earth colors, font variables) |
| `frontend/postcss.config.mjs` | PostCSS: `@tailwindcss/postcss` (ESM only) |

### Backend

| Path | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app, CORS, lifespan, timing middleware; `create_all` on startup |
| `backend/app/config.py` | Settings (DATA_DIR, DATABASE_URL, ALLOWED_ORIGINS) |
| `backend/app/storage/file_storage.py` | Writes .md files + database meta.json; HTML→Markdown via markdownify |
| `backend/app/storage/__init__.py` | `get_file_storage()` singleton |
| `backend/app/api/routes/api.py` | Router: includes leaf and database routers |
| `backend/app/api/routes/leaf/leaf_crud_controller.py` | Leaves CRUD, GET /tree, PATCH content, reorder-children |
| `backend/app/api/routes/database/database_controller.py` | Databases and rows CRUD |
| `backend/app/database/operations/leaf_operations.py` | Leaf CRUD, get_leaf_tree, patch_leaf_content, reorder_children |
| `backend/app/database/operations/database_operations.py` | Database and row operations |
| `backend/app/database/models/mysql_models.py` | LeafModel, DatabaseModel (with schema JSON), DatabaseRowModel |
| `backend/app/dtos/leaf_dtos.py` | Leaf, LeafCreate, LeafContentUpdate, LeafTreeItem, LeafReorderChildren |
| `backend/app/dtos/database_dtos.py` | Database, Row, DatabaseCreate, RowCreate, RowUpdate, PropertyDefinition, DatabaseSchema |

### DevOps and config

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Full stack: mysqldb, api, frontend (run from root) |
| `Makefile` | up, down, build, test, logs, shell-*, env |
| `backend/.env.example` | Template for backend .env |
| `backend/migrations/` | Alembic migrations (idempotent) |
| `CLAUDE.md` | AI editor instructions, key rules, project layout |
| `README.md` | Quick start, features, Makefile, dev without Docker |

---

## 6. Decisions and constraints

- **Stack:** Next.js + FastAPI + SQLite. MySQL removed in favour of the hybrid file+SQLite architecture.
- **Storage architecture:** Hybrid — `.md` files with YAML frontmatter are the source of truth; SQLite (`.leaf.db`) is a rebuild-able index for fast queries. Goals: raw speed (SQLite sub-ms reads), AI readability (plain Markdown files), and a clear path to CRDT sync. See "CRDT upgrade path" in section 4.
- **Auth:** Not implemented; optional for a later phase.
- **Storage format:** Content stored as HTML in `leaves.content` (SQLite) for fast editor rendering. Converted to Markdown via `markdownify` when writing `.md` files for AI readability and future sync.
- **Cross-component updates:** Use custom `window` events (e.g. `leaf-title-changed`) rather than prop drilling or a global store.
- **No `performance.mark` in `useEffect`:** React Strict Mode double-invokes effects, causing mark/measure errors. Remove all perf tracking from effects.
- **Mobile:** In scope later; not in the immediate plan.
- **Real-time collaboration:** Not in current plan; local-first + single-writer is the model.

---

*Last updated: 2026-03-17. Use this doc with your code editor and planner to prioritize and track tasks.*
