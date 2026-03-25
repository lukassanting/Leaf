# Leaf codebase guide

This document explains **what lives where**, how **in-file documentation** works, and gives **three beginner-friendly practice tickets** (backend → frontend → full stack).

For day-to-day debugging steps, see [DEBUGGING_PLAYBOOK.md](DEBUGGING_PLAYBOOK.md). For product direction, see [PLANS_AND_ROADMAP.md](PLANS_AND_ROADMAP.md).

---

## How code is documented

1. **Python (`backend/app/`)**  
   Most modules start with a triple-quoted docstring labeled **Purpose**, **How to read**, **Update**, and **Debug**. Read that block first before scanning implementation.

2. **TypeScript/React (`frontend/src/`)**  
   Many files start with a `/** ... */` block with the same idea: **Purpose**, **How to read**, **Update**, **Debug**.

3. **OVERVIEW.md**  
   Several folders include `OVERVIEW.md` (e.g. `backend/app/api/`, `frontend/src/app/(workspace)/`) for a short directory-level summary.

4. **This file**  
   Use it as a **map**: find the area you care about, then open the listed file and read its header docstring/comment.

> **Note:** Some `frontend/src/lib/*` files may be gitignored in your clone except for a few allowlisted paths (`types.ts`, `cacheMappers.ts`, `leafCache.ts`). The table below still describes the **intended** layout so you know what each module does when present.

---

## Beginner practice tickets (easiest → harder)

### Ticket 1 — Backend-only: expose a read-only field on `GET /leaves/{id}`

**Goal:** Add a small computed or stored field on the leaf response (e.g. `word_count` from content text, or `has_children` boolean).

**Why:** You practice the FastAPI path without touching React: DTO → operations mapping → OpenAPI.

**Steps:**

1. Extend `Leaf` in `backend/app/dtos/leaf_dtos.py`.
2. Populate it in `LeafOperations._leaf_to_dto` in `backend/app/database/operations/leaf_operations.py`.
3. Hit `http://localhost:8000/docs` and call `GET /leaves/{id}`.

**Stretch:** Add one assertion in `backend/tests/test_leaf_database_integration.py` if the field is stable.

---

### Ticket 2 — Frontend-only: show API data in the UI (no new backend field)

**Goal:** Surface something the API already returns but the editor page does not show (e.g. `path`, `type`, or format `created_at`).

**Why:** You practice **route → hook → JSX** without designing a new API.

**Steps:**

1. Confirm the field exists on `Leaf` in `frontend/src/lib/api/types.ts`.
2. Plumb it through `useLeafPageData` if needed (`frontend/src/hooks/useLeafPageData.ts`).
3. Render it in `frontend/src/app/(workspace)/editor/[id]/page.tsx` (or `PageIdentityHeader`).

**Stretch:** Mirror the value into `toCachedLeaf` / `CachedLeaf` if it should survive offline-first loads.

---

### Ticket 3 — Full stack: user-visible metadata with persistence

**Goal:** Add a new optional leaf field (e.g. `subtitle` or `pinned`) stored in DB, editable in UI, included in `leavesApi.update` so tags are not cleared.

**Why:** You touch **model + migration or create_all path**, **DTOs**, **operations update**, **API types**, **cache mappers**, and **one UI control**.

**Steps (outline):**

1. **Backend:** SQLAlchemy column on `LeafModel` (`backend/app/database/models/mysql_models.py`), DTOs (`leaf_dtos.py`), create/update/patch paths in `leaf_operations.py`, controller if needed (`leaf_crud_controller.py`).
2. **Frontend:** `types.ts`, `useLeafPageData`, save handlers on editor page, `updateLeafAndPrimeCache` payload in `leafMutations.ts` (if tracked).
3. **Verify:** `make test`, `npm run build`, manual save/reload.

**Caution:** Follow project rules: include `tags` in update payloads; keep route order in FastAPI (static paths before `/{id}`).

---

## Repository root (top level)

| Path | Purpose |
|------|---------|
| `README.md` | Quick start, features, commands, links to deeper docs |
| `CLAUDE.md` | AI/editor instructions for this repo |
| `Makefile` | `up`, `down`, `test`, `logs`, shell helpers |
| `docker-compose.yml` | Dev stack: API + frontend; persistent volume for runtime data |
| `LEAF_DESIGN_GUIDE.md` | Visual design reference |
| `docs/` | Product + engineering docs (this file, roadmap, debugging) |

---

## Backend (`backend/`)

### Config & entry

| Path | Purpose |
|------|---------|
| `app/main.py` | FastAPI app: CORS, router mount, lifespan, timing middleware, logging |
| `app/config.py` | Env settings (`DATABASE_URL`, `DATA_DIR`, `ALLOWED_ORIGINS`, etc.) |
| `app/logger.py` | Logging setup (loguru / stdlib bridge) |

### HTTP API

| Path | Purpose |
|------|---------|
| `app/api/routes/api.py` | Aggregates routers (leaf + database) |
| `app/api/routes/leaf/leaf_crud_controller.py` | REST endpoints for leaves, tree, content patch, backlinks, graph; soft-delete to Trash; `POST /leaves/{id}/restore` |
| `app/api/routes/database/database_controller.py` | REST for databases and rows; soft-delete + restore; `DELETE /databases/{id}/properties/{key}` removes a column and strips that key from all rows |
| `app/api/routes/trash/trash_controller.py` | `GET /trash` (purge expired, then list) |
| `app/database/operations/trash_operations.py` | Permanent delete + purge after retention; used by trash API and startup |
| `app/dtos/trash_dtos.py` | Trash list response DTOs |

### Domain & persistence

| Path | Purpose |
|------|---------|
| `app/dtos/leaf_dtos.py` | Pydantic models for leaf CRUD, content patch, tree, graph |
| `app/dtos/database_dtos.py` | Pydantic models for databases and rows |
| `app/database/models/mysql_models.py` | SQLAlchemy models (name is legacy; works with SQLite default) |
| `app/database/connectors/mysql.py` | DB engine/session; SQLite by default via `DATABASE_URL` |
| `app/database/operations/leaf_operations.py` | Leaf CRUD, tree, content serialization, backlinks, file sync hooks |
| `app/database/operations/database_operations.py` | Database metadata, schema, row operations |

### Errors & side effects

| Path | Purpose |
|------|---------|
| `app/exceptions/exceptions.py` | Domain exceptions (`LeafNotFound`, etc.) |
| `app/exceptions/exception_handler.py` | Maps exceptions to JSON responses |
| `app/storage/file_storage.py` | Writes/deletes page files under `DATA_DIR` |
| `app/storage/__init__.py` | Storage accessor wiring |

### Tests & migrations

| Path | Purpose |
|------|---------|
| `tests/test_leaf_database_integration.py` | Integration tests for leaf/database flows |
| `migrations/env.py` | Alembic environment (legacy MySQL-oriented URL) |
| `migrations/versions/*.py` | Individual Alembic revisions |
| `alembic.ini` | Alembic config |

### Packaging & Docker

| Path | Purpose |
|------|---------|
| `pyproject.toml` / `poetry.lock` | Python dependencies |
| `Dockerfile.dev` / `Dockerfile` | Container images for API |
| `docker-compose.yml` / `docker-compose.dev.yml` | Alternate compose setups |
| `.env.example` | Template env vars for local backend |
| `wait-for-it.sh` | Optional wait script (CRLF normalized in Dockerfile) |

---

## Frontend (`frontend/`)

### App Router (pages)

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout: fonts (Geist + campaign fonts), `DesignThemeScript` in `<head>`, `DesignThemeProvider`, `globals.css` |
| `src/app/globals.css` | Tailwind v4 import, `--leaf-*` design tokens, ProseMirror/column CSS, `html[data-leaf-design="campaign"]` theme overrides + starfield |
| `src/app/(workspace)/layout.tsx` | Workspace chrome: sidebars, providers, shortcuts |
| `src/app/(workspace)/page.tsx` | Home / workspace landing |
| `src/app/(workspace)/loading.tsx` | Loading UI for workspace segment |
| `src/app/(workspace)/editor/[id]/page.tsx` | Single leaf editor: title, tags, editor, autosave |
| `src/app/(workspace)/databases/page.tsx` | Database list |
| `src/app/(workspace)/databases/[id]/page.tsx` | Single database table/board/gallery/list |
| `src/app/(workspace)/graph/page.tsx` | Link graph visualization |

### Components (UI)

| Path | Purpose |
|------|---------|
| `src/components/Editor.tsx` | Re-exports main editor (TipTap) |
| `src/components/editor/LeafEditor.tsx` | Main document TipTap (`TextStyle`, `Color`, `TextAlign`, `storyTagExtension`, `statStrip`, `calloutExtension`), slash menu (full commands in nested toggle **body**), `ToggleCardHeaderField` for toggle **headers**, selection bubble, embeds, `toggleCard`, columns, document model; listens for `leaf-outline-jump` to scroll to headings |
| `src/components/editor/calloutExtension.ts` | TipTap `callout` block (`data-type="callout"`, `data-variant`); classic + campaign styling in `globals.css` |
| `src/components/editor/ToggleCardHeaderField.tsx` | One-line TipTap per toggle header (eyebrow/title/subtitle); `SlashMenuPanel` + `rankToggleHeaderSlashItems`; syncs attrs when unfocused |
| `src/components/editor/toggleCardHeaderFieldExtensions.ts` | StarterKit subset + single-paragraph doc, marks, hard break on Enter, placeholder |
| `src/components/editor/toggleCardHeaderSlash.ts` | Allowed slash actions for headers (no block inserts); `applyToggleHeaderSlashAction` |
| `src/components/editor/slashMatchUtils.ts` | `computeSlashMatch`, `computeWikilinkMatch` for main editor and nested fields |
| `src/components/editor/storyTagExtension.tsx` | `StoryTag` atom + React node view (story flags) |
| `src/components/SlashCommands.tsx` | Slash command definitions and menu (**Style**, **Flags** story-flag presets, **Toggle Cards**) |
| `src/components/editor/EditorSelectionBubble.tsx` | Selection bubble: alignment, clear colour, swatches (TipTap `BubbleMenu`; no static toolbar) |
| `src/lib/editorRichText.ts` | Story-flag variants/presets (slash: “Flag · …”), text-colour swatches, slash action helpers |
| `src/components/StatusBar.tsx` | Sync state, word count, mode label |
| `src/components/TopStrip.tsx` | Top bar, breadcrumbs, Settings (⋯) menu with appearance / design theme |
| `src/components/DesignThemeProvider.tsx` | Client context: reads/writes `leaf-design` in `localStorage`, sets `data-leaf-design` on `<html>` |
| `src/components/DesignThemeScript.tsx` | Inline script to apply saved theme before paint (avoids flash) |
| `src/components/NavigationProgress.tsx` | Route transition indicator |
| `src/components/LoadingShell.tsx` | Full-page loading placeholder |
| `src/components/SidebarLeft.tsx` | Left nav: tree, new page/db |
| `src/components/SidebarTree.tsx` | Tree UI, drag-drop, rename, events |
| `src/components/SidebarTreeRow.tsx` | Single tree row |
| `src/components/SidebarTreeContextMenu.tsx` | Context menu for tree nodes |
| `src/components/sidebarTreeUtils.ts` | Tree helpers/types |
| `src/components/Sidebar.tsx` | Right sidebar: metadata, outline, backlinks |
| `src/components/page/PageIdentityHeader.tsx` | Title, description, tags, icon |
| `src/components/page/IconPicker.tsx` | Icon selection UI |
| `src/components/editor/TagsInput.tsx` | Tag chips / suggestions |
| `src/components/database/DatabaseSurface.tsx` | Shared database canvas |
| `src/components/database/DatabaseViews.tsx` | View switcher and view implementations; date column type; edit-column modal; gallery cover from `row.leaf_header_banner` |
| `src/components/database/EmbeddedDatabaseBlock.tsx` | Database block inside editor |
| `src/components/AIAssistant.tsx` | AI assistant entry UI |
| `src/components/Icons.tsx` | Shared icon components |
| `src/components/PerfPanel.tsx` | Dev/perf overlay (if enabled) |

### Hooks

| Path | Purpose |
|------|---------|
| `src/hooks/useLeafPageData.ts` | Load leaf from cache + API; parse content |
| `src/hooks/useLeafAutosave.ts` | Debounced content save, offline queue, conflict handling |
| `src/hooks/useLeafBreadcrumbs.ts` | Breadcrumbs for editor |
| `src/hooks/useDatabasePage.ts` | Database page state and mutations |
| `src/hooks/useDatabaseBreadcrumbs.ts` | Breadcrumbs for database routes |
| `src/hooks/useSidebarTreeModel.ts` | Tree data, mutations, cache, custom events |
| `src/hooks/useWarmWorkspaceRoutes.ts` | Prefetch/warm routes |

### Library (`src/lib/`)

| Path | Purpose |
|------|---------|
| `src/lib/designTheme.ts` | `leaf-design` storage key, `LeafDesignId`, `applyLeafDesignToDocument`, `readStoredLeafDesign` |
| `src/lib/apiBase.ts` | Resolves `NEXT_PUBLIC_API_URL` |
| `src/lib/api/index.ts` | Re-exports API clients and types |
| `src/lib/api/types.ts` | Shared TypeScript types (Leaf, Database, document nodes) |
| `src/lib/api/leaves.ts` | `leavesApi` HTTP client |
| `src/lib/api/databases.ts` | `databasesApi` HTTP client (`restore` for undo) |
| `src/lib/leafCache.ts` | IndexedDB + localStorage cache, pending save queue |
| `src/lib/cacheMappers.ts` | Maps API leaf → `CachedLeaf` |
| `src/lib/leafDocument.ts` | Parse/normalize `LeafDocument` JSON for TipTap |
| `src/lib/leafMutations.ts` | High-level leaf create/rename/update/save + cache priming |
| `src/lib/databaseMutations.ts` | Database create/update helpers + events |
| `src/lib/appEvents.ts` | CustomEvent helpers (tree/title/db created) |
| `src/lib/warmEditorRoute.ts` | Prefetch editor/database bundles |
| `src/lib/workspaceDefaults.ts` | Default tags/workspace seeding helpers |

### E2E & tooling

| Path | Purpose |
|------|---------|
| `e2e/workspace.spec.ts` | Playwright smoke/regression tests |
| `playwright.config.ts` | Playwright configuration |
| `next.config.ts` | Next.js config |
| `tsconfig.json` | TypeScript compiler options |
| `eslint.config.mjs` | ESLint flat config |
| `postcss.config.mjs` | PostCSS (Tailwind v4) |
| `package.json` | Scripts and dependencies |

---

## Data flow (mental model)

```text
Browser UI (pages + components)
    → hooks (load / autosave)
    → lib/api (axios) + lib/leafCache (offline)
    → FastAPI controllers
    → operations (SQLAlchemy + file storage)
    → SQLite (default) under DATA_DIR / volume
```

---

## Related reading

- [DEBUGGING_PLAYBOOK.md](DEBUGGING_PLAYBOOK.md) — step-by-step debug flow  
- [PLANS_AND_ROADMAP.md](PLANS_AND_ROADMAP.md) — implemented features and next phases  
- [FRAMEWORK_DIRECTION.md](FRAMEWORK_DIRECTION.md) — web/desktop/mobile posture (if present in your tree)  
- Root [README.md](../README.md) — commands and quick start  

*Last updated: 2026-03-24 — toggle card header mini-editors and filtered slash (`ToggleCardHeaderField`, `toggleCardHeaderSlash`, `slashMatchUtils`, `storyTagExtension`).*
