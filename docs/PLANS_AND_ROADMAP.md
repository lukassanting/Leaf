# Leaf — Plans and Roadmap

A single reference for where Leaf stands after the v3 redesign, what is verified, and what the next phase should tackle.

---

## 1. Product direction

- **Product:** a fast workspace for personal knowledge management with pages, embedded structure, and database views.
- **Experience goal:** instant-feeling navigation, stable typing, low-friction structure creation, and clear page/database relationships.
- **Editor goal:** rich editing with a Markdown-friendly mental model, structured persistence, and room to grow into richer blocks.
- **Architecture goal:** keep the stack simple and local-first while making future search, collaboration, and richer block types feasible.

---

## 2. Current architecture

- **Frontend:** Next.js 15 App Router, React, TipTap, Tailwind CSS v4.
- **Backend:** FastAPI, SQLAlchemy, default SQLite runtime (`DATABASE_URL`) with legacy MySQL-oriented Alembic config still present.
- **Persistence:** page content is stored as `LeafDocument` JSON with a legacy HTML migration path; database metadata is stored alongside schema payloads.
- **Caching:** IndexedDB-first cache with localStorage fallback and pending-save queueing.
- **Data flow:** UI loads from cache first, revalidates from the API, then writes back through debounced PATCH/PUT calls.

```text
User → Next.js workspace shell ⇄ IndexedDB/local cache
                ↓
         FastAPI REST API ⇄ SQLite (default)
```

---

## 3. Implemented and verified

### Core editor

- [x] Schema-first `LeafDocument` content model with HTML migration support.
- [x] Stable TipTap editor rebuild with `gapcursor`/`dropcursor` disabled.
- [x] Slash commands and block insertion menu for headings, lists, todos, quotes, sub-pages, databases, column layouts, **markdown tables** (GFM pipe tables in Markdown mode; TipTap `Table` with resizable columns in rich mode), and **callouts** (classic colored panels + campaign-themed variants).
- [x] Text alignment (paragraph, heading, blockquote) and palette text colours (`TextAlign`, `TextStyle`, `Color`); selection bubble + slash **Style** group (no static toolbar).
- [x] Inline **story flag** atoms (variant + editable label; slash menu group **Flags**; distinct from page **tags** metadata) and **stat strip** block (2–4 kicker/value pairs; gutter grip menu: delete, colour, column count); presets in `lib/editorRichText.ts`.
- [x] **Toggle cards**: eyebrow/title/subtitle are small TipTap fields with a **filtered slash menu** (text marks, alignment, colours, **Flags**); values persist as string/HTML node attrs. Collapsible body is normal editor content — **full** slash commands (headings, lists, embeds, flags, etc.) work inside the card body.
- [x] Rich/Markdown mode switching plus Markdown import/export.
- [x] Page embeds as dedicated block nodes.
- [x] Inline database embeds as dedicated block nodes backed by the shared database surface.

### Workspace shell and metadata

- [x] Three-pane shell: left sidebar (navigation), center canvas, right sidebar (context).
- [x] Left sidebar with KNOWLEDGE BASE, Personal, and PROJECTS sections.
- [x] Right sidebar with METADATA, PAGE OUTLINE (hierarchical numbering; **click heading to jump** in editor), and LINKED MENTIONS sections.
- [x] Icon picker with SVG shapes, uploaded images, and emoji as user-selected content.
- [x] Width modes (`normal`, `wide`, `full`) and focus mode.
- [x] Bottom status bar with sync state and mode label.
- [x] `Ask AI ⌘K` button in top navigation.
- [x] Optional **Campaign** visual theme (D&D-inspired dark UI, gold accent, Cinzel / Crimson Pro, starfield background): top-strip toggle, `localStorage` key `leaf-design`, `html[data-leaf-design="campaign"]` token remap in `globals.css` (includes database table/board/gallery chrome via `--leaf-db-*` tokens).
- [x] Workspace **Home** uses the same **TopStrip** (settings, width, sidebars) as editor/database routes.

### Databases

- [x] Standalone database pages with shared toolbar and table/board/gallery/list views.
- [x] Embedded databases render the same shared surface inline inside editor pages.
- [x] Database metadata parity with pages: title, description, tags, icon.
- [x] Row-backed pages, inline cell editing, schema-driven columns, **date** property type, **edit column** (label + type; table header ✎ or double-click; wired for embedded DBs), add-column flows, **table view column resize** (persisted: `schema.name_column_width`, `PropertyDefinition.width`), and **gallery card cover** from linked leaf `properties.headerBanner` (API field `leaf_header_banner`).
- [x] **Trash** for deleted pages and databases: soft-delete with **7-day** retention (`TRASH_RETENTION_DAYS`), automatic purge on startup and when opening `GET /trash`; restore via Settings UI (`POST /leaves/{id}/restore`, `POST /databases/{id}/restore`).

### Layout blocks

- [x] Persisted 2–5 column block types in the document schema (`columnList > column` nested architecture).
- [x] Real nested content inside columns — cursor navigation, undo/redo, and text selection work natively across column boundaries.
- [x] Resizable column widths via drag handles between columns.
- [x] Drag-to-create columns: drag any block to the left or right edge of another to create side-by-side columns.
- [x] "Remove columns" unwraps content back into the main document (no content is ever deleted).
- [x] Minimal chrome for columns — no borders/dividers, just whitespace gaps.
- [x] Responsive stacking on narrow screens (< 640px).
- [x] Nesting prevention — slash commands block column insertion inside existing columns.
- [x] Automatic migration from legacy `columnLayout` (JSON blob) format to new nested node format.
- [x] CSS fix for TipTap's intermediate `data-node-view-content-react` wrapper that broke flex layout (columns were stacking vertically).

### Local-first and backend

- [x] Debounced autosave with optional conflict detection via `updated_at`.
- [x] Offline queueing and cache priming for faster create/open flows.
- [x] CRUD for leaves, tree loading, child reorder, databases, and rows.
- [x] Structured content round-tripping on the backend.
- [x] Backlink indexing for structured content text extraction.
- [x] Leaf DTO now exposes `content_text_length` to help frontend diagnostics and search-oriented UI context.

### Sync and multi-device

- [x] Bidirectional file sync: `.md` files are the source of truth; DB is a rebuildable index.
- [x] File watcher (`watchdog`) detects external changes to `.md` files and reverse-syncs into SQLite.
- [x] Self-write suppression prevents the watcher from re-ingesting API-triggered writes.
- [x] Sync manifest (`DATA_DIR/.sync-manifest.json`) for efficient SHA-256-based change detection.
- [x] Cloud conflict detection for Google Drive, Dropbox, and OneDrive conflict copies.
- [x] Conflict store with persisted `DATA_DIR/.sync-conflicts.json` and resolution API.
- [x] Sync REST API: `GET/PUT /sync/config`, `GET /sync/status`, `POST /sync/trigger`, `POST /sync/rebuild-index`, conflict CRUD.
- [x] Frontend Settings page (`/settings`) with sync mode selector, data dir display, watcher toggle, git config fields, sync status dashboard, and conflict resolution UI.
- [x] Footer `StatusBar` on workspace pages: green/yellow/red dot + "Synced Xm ago", click to sync now when sync is enabled; Settings remains the full dashboard.
- [x] Runtime sync config persisted to `DATA_DIR/.sync-config.json`, loaded at startup.
- [x] Git-based sync: auto-init repo in DATA_DIR, stage/commit/pull(rebase)/push cycle, PAT auth in URL, `.gitignore` for DB + metadata files.
- [x] Periodic git sync scheduler (configurable interval, asyncio background task, post-pull DB reconciliation).
- [x] Git test connection endpoint and UI button.
- [x] Git status panel in Settings: branch, remote, last commit, uncommitted changes, errors.

### Verification completed

- [x] Backend integration tests for leaf/database flows and structured content round-tripping.
- [x] Playwright coverage for:
  - page create/type/reload persistence
  - slash page/database embeds without ProseMirror runtime crashes
  - todo Enter flow staying interactive
  - inline database embeds rendering the shared database surface
  - column layout insert + reload persistence
- [x] Frontend lint and production build passing after the redesign.
- [x] `make test` backend fallback now works on Windows shells without Unix-only tokens.

---

## 4. Recommended next phase

These are the next best steps after the completed redesign.

### Phase 4 — Structured editing depth

| # | Item | Why next |
|---|------|----------|
| ~~4.1~~ | ~~Upgrade column layouts from lightweight text columns to true nested block columns~~ | ✅ Done — drag-to-create columns + minimal rendering |
| ~~4.2~~ | ~~Add a real document block drag handle and block reorder flow~~ | ✅ Done — block drag handle with column-drop zones |
| 4.3 | Add scroll-position memory and small editor polish around status/focus states | High user value, low risk |

### Phase 5 — Search and knowledge graph

| # | Item | Why next |
|---|------|----------|
| 5.1 | Quick switcher (`Cmd+K`) over cached tree + API search | Fast navigation payoff |
| 5.2 | Full-text search endpoint over structured page content | Unlocks real workspace retrieval |
| 5.3 | `[[wikilinks]]` insertion and stronger backlinks UX | Natural fit with the new structured model |

### Phase 6 — Database depth

| # | Item | Why next |
|---|------|----------|
| 6.1 | Sort/filter/group configuration for databases | Most obvious workflow gap after visual parity |
| 6.2 | Richer property types (dates, relations, status) | Needed before advanced planning workflows |
| 6.3 | Stronger board interactions and persisted grouping config | Makes board view truly first-class |

### Phase 7 — Sync and hardening

| # | Item | Why next |
|---|------|----------|
| ~~7.1~~ | ~~Conflict-resolution UI for `updated_at` mismatches~~ | ✅ Done — bidirectional file sync + cloud conflict detection + settings page |
| ~~7.4~~ | ~~Git-based sync (auto-commit + push/pull to remote)~~ | ✅ Done — git init/commit/pull/push cycle, periodic scheduler, test connection, git status panel |
| 7.5 | GitHub Device Flow OAuth + auto-repo creation | One-click GitHub sync: user authorizes via device code flow, backend auto-creates a private repo and configures git sync — no manual PAT or repo setup. Best fit for self-hosted/local tools (no callback server needed). `client_id` configurable per deployment. |
| 7.2 | CI workflow for lint + backend tests + Playwright smoke suite | Keeps redesign stable |
| 7.3 | Production deployment path and env hardening | Needed before wider usage |

---

## 5. Open product decisions

These are the questions most likely to affect implementation shape in the next phase.

Framework direction is now decided separately in `docs/FRAMEWORK_DIRECTION.md`:

- stay on React/Next for the web app
- treat desktop as packaging/runtime planning around the current web experience
- treat mobile as a separate client against shared API/document contracts

Questions still open for the next milestone:

1. ~~Should column blocks become full nested block containers or stay lightweight for one more iteration?~~ **Resolved:** columns are now real nested ProseMirror nodes (`columnList > column > block+`).
2. ~~Should document block drag use native ProseMirror drag, a custom overlay, or a hybrid handle-only approach?~~ **Resolved:** hybrid — custom gutter drag handle feeds `editor.view.dragging` for native ProseMirror drop behavior, with column-drop zone overlay for drag-to-create columns.
3. Should search be cache-first with API fallback, or fully API-backed once indexing exists?
4. Which database property types matter most immediately after `text/number/tags/select`?
5. Is real-time collaboration still out of scope for the next milestone, or do we need to preserve a path for it now?

---

## 6. Key files

### Onboarding and codebase navigation

| Path | Purpose |
|------|---------|
| `docs/CODEBASE.md` | File/directory map, in-code documentation conventions, three beginner practice tickets |
| `docs/DEBUGGING_PLAYBOOK.md` | Cross-stack debugging workflow and worked examples |

### Frontend

| Path | Purpose |
|------|---------|
| `frontend/src/app/(workspace)/editor/[id]/page.tsx` | Page editor route and shell wiring |
| `frontend/src/app/(workspace)/databases/[id]/page.tsx` | Standalone database page |
| `frontend/src/components/editor/LeafEditor.tsx` | Main editor implementation, node views, toggle card wiring; block gutter uses `posAtCoords` for atom views (stat strip, embeds) |
| `frontend/src/components/editor/ToggleCardHeaderField.tsx` | Toggle card header lines: mini TipTap + filtered slash (Style, Flags) |
| `frontend/src/components/editor/toggleCardHeaderSlash.ts` | Slash actions and ranking for toggle header fields |
| `frontend/src/lib/editorRichText.ts` | Story-tag presets and shared colour swatches |
| `frontend/src/components/SlashCommands.tsx` | Shared slash menu data and menu UI |
| `frontend/src/components/database/DatabaseSurface.tsx` | Shared standalone/embedded database renderer |
| `frontend/src/components/database/EmbeddedDatabaseBlock.tsx` | Inline database block wrapper |
| `frontend/src/components/database/DatabaseViews.tsx` | Table/board/gallery/list views and toolbar |
| `frontend/src/components/page/PageIdentityHeader.tsx` | Shared centered identity header |
| `frontend/src/components/page/IconPicker.tsx` | Page/database icon picker |
| `frontend/src/components/Sidebar.tsx` | Right sidebar metadata and navigation |
| `frontend/src/hooks/useLeafPageData.ts` | Page data loading and structured content parsing |
| `frontend/src/hooks/useLeafAutosave.ts` | Autosave pipeline |
| `frontend/src/hooks/useDatabasePage.ts` | Database route state and mutations |
| `frontend/src/lib/api/types.ts` | Shared page/database/document types |
| `frontend/src/lib/leafDocument.ts` | Structured content parsing and normalization; `statStrip` HTML includes `columns`, `variant`, fourth pair |
| `frontend/e2e/workspace.spec.ts` | Browser regression coverage |
| `docs/FRAMEWORK_DIRECTION.md` | Web framework decision and platform expansion guidance |

### Backend

| Path | Purpose |
|------|---------|
| `backend/app/api/routes/leaf/leaf_crud_controller.py` | Leaf CRUD and content patch endpoints |
| `backend/app/api/routes/database/database_controller.py` | Database and row endpoints |
| `backend/app/database/operations/leaf_operations.py` | Content serialization, backlink indexing, leaf CRUD |
| `backend/app/database/operations/database_operations.py` | Database metadata/schema composition and row operations |
| `backend/app/dtos/leaf_dtos.py` | Structured or legacy content DTOs |
| `backend/app/dtos/database_dtos.py` | Database metadata and schema DTOs |
| `backend/app/sync/file_to_db.py` | Reverse sync engine (file → DB) |
| `backend/app/sync/file_watcher.py` | Watchdog-based live file change detection |
| `backend/app/sync/manifest.py` | File hash manifest for change detection |
| `backend/app/sync/conflict_store.py` | Persisted sync conflict tracking |
| `backend/app/sync/cloud_detector.py` | Cloud service conflict copy detection |
| `backend/app/sync/git_sync.py` | Git auto-commit/pull/push engine |
| `backend/app/sync/scheduler.py` | Periodic background sync loop |
| `backend/app/api/routes/sync/sync_controller.py` | Sync API endpoints (file + git) |
| `frontend/src/app/(workspace)/settings/page.tsx` | Settings page with sync configuration UI |
| `frontend/src/components/StatusBar.tsx` | Footer sync + save status; click-to-sync |
| `frontend/src/lib/api/sync.ts` | Sync API client |
| `backend/tests/test_leaf_database_integration.py` | Integration coverage for current backend behavior |
| `Makefile` | Local developer workflow (`up`, `test`, logs, shell helpers) |

---

## 7. Constraints and working assumptions

- **Keep the editor stable first.** Avoid reintroducing known ProseMirror crash vectors while extending block behavior.
- **Preserve backward compatibility.** Legacy HTML content should still load cleanly through migration into the structured document model.
- **Prefer shared surfaces.** Standalone and embedded database experiences should keep using the same underlying components.
- **Keep docs aligned with the v3 shell.** The centered header, right sidebar, and bottom status bar are the default product shape now.
- **No nested `.claude/worktrees` in-repo.** A one-off worktree was merged into `frontend/src` and `backend/app` (preserving top-of-file `Purpose:` docs and all of `frontend/src/lib/**`), then `.claude/` was removed from the repo root.
- **Stay local-first.** New features should respect cache-first loading and offline-safe save behavior where practical.
- **Collaboration is not the next milestone.** Do not contort the current implementation for CRDTs yet, but do avoid blocking that future.

## 8. Platform expansion posture

This is the current default strategy for expanding beyond the web app:

- **Web:** continue on React/Next.
- **Desktop:** prefer packaging the current web experience and reusing the existing backend/content model.
- **Mobile:** plan a separate client against the shared API and `LeafDocument` contract, rather than expecting direct UI reuse.

That means platform growth should focus first on:

1. preserving stable backend contracts
2. keeping domain logic portable where practical
3. avoiding framework rewrites unless product constraints clearly demand them

---

*Last updated: 2026-03-24. Toggle card headers: mini TipTap + filtered slash (Style, Flags); key-files rows for `ToggleCardHeaderField` / `toggleCardHeaderSlash`. Previous: git-based sync; bidirectional file sync.*
