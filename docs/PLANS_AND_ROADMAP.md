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
- **Fonts:** Geist ships via the `geist` npm package; campaign theme uses **vendored** `.woff2` files in `frontend/public/fonts/` so installs and Docker builds do not need to reach Google Fonts. Maintainers can refresh files with `npm run fonts` in `frontend/`.
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
- [x] Slash commands and block insertion menu for headings, lists, todos, quotes, sub-pages, databases, column layouts, **markdown tables** (GFM pipe tables in Markdown mode; TipTap `Table` with resizable columns in rich mode), and **callouts** (classic colored panels + campaign-themed variants). Gutter **+** uses the same grouped list as `/` slash; menus flip upward near the bottom of the viewport.
- [x] Text alignment (paragraph, heading, blockquote) and palette text colours (`TextAlign`, `TextStyle`, `Color`); selection bubble (alignment, colours, link panel with page search / web URL / bookmark card / remove link) + floating link panel on **Ctrl+K** when there is no text selection; inline links styled in prose (`.leaf-doc-link`); slash **Style** group (no static toolbar).
- [x] Inline **story flag** atoms (variant + editable label; slash menu group **Flags**; distinct from page **tags** metadata) and **stat strip** block (2–6 kicker/value pairs; gutter grip menu: delete, colour, column count); presets in `lib/editorRichText.ts`.
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
- [x] `Ask AI` + Ctrl+K (⌘+K on macOS) in top navigation / AI panel.
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
- [x] Drag-to-create columns: drag any block to the left or right edge of another to create side-by-side columns (targets resolve to the **innermost** block under the pointer—works inside callouts, toggle bodies, and existing columns).
- [x] Grip **reorder** drop target uses the same nested resolution (center drop no longer jumps to the top-level wrapper).
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
- [x] GitHub OAuth Device Flow: "Connect to GitHub" button, device code entry, repo picker, PAT fallback. Protocol spec in `docs/PLAN_GITHUB_OAUTH.md` for cross-platform reuse (desktop, mobile).

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

These rows are a **sequencing lens**, not a promise of order: later phases can start early when dependencies allow. **Nothing is removed when shipped** — strikethrough rows stay as history. A broader, reader-friendly wish list (same ideas, different grouping) lives in **README.md → Roadmap (planned)**.

**Spine (near-term engineering):** Phases **4 → 7** — editor polish, retrieval, database depth, sync/ship hardening. **Expansion (product breadth):** Phases **8 → 11** — customization, productivity extras, AI, native clients — often parallelizable after the API and document model stay stable.

### Phase 4 — Structured editing depth

| # | Item | Why next |
|---|------|----------|
| ~~4.1~~ | ~~Upgrade column layouts from lightweight text columns to true nested block columns~~ | ✅ Done — drag-to-create columns + minimal rendering |
| ~~4.2~~ | ~~Add a real document block drag handle and block reorder flow~~ | ✅ Done — block drag handle with column-drop zones |
| 4.3 | Add scroll-position memory and small editor polish around status/focus states | High user value, low risk |
| 4.4 | Gutter / block chrome polish: margin + column inset positioning, nested targets, hover/stick behaviour | Keeps block actions predictable as layouts get richer |
| 4.5 | Initial render and route-transition performance (editor + workspace shell) | Perceived speed; pairs with cache strategy in §5 |
| 4.6 | Page outline: click-to-scroll to heading with accurate in-page target (nested scroll containers) | Right sidebar outline is high-traffic |
| 4.7 | Block drag-and-drop: clearer preview / drop affordance (where the block will land) | Complements existing gutter drag + column zones |

### Phase 5 — Search, navigation, and graph

| # | Item | Why next |
|---|------|----------|
| 5.1 | Quick switcher (`Ctrl+K`, ⌘+K on macOS) over cached tree + API search | Fast navigation payoff |
| 5.2 | Full-text search endpoint over structured page content | Unlocks real workspace retrieval |
| 5.3 | `[[wikilinks]]` insertion and stronger backlinks UX | Natural fit with the new structured model |
| 5.4 | Graph view: layout, readability, and node positioning | Current graph is useful but cramped; needs pass before interaction depth |
| 5.5 | Graph view: draggable nodes (and persistence / layout hints if needed) | Builds on 5.4; avoid churn until base layout is stable |

### Phase 6 — Database depth

| # | Item | Why next |
|---|------|----------|
| 6.1 | Sort/filter/group configuration for databases | Most obvious workflow gap after visual parity |
| 6.2 | Richer property types (dates, relations, status) | Needed before advanced planning workflows (note: basic **date** columns already exist — extend semantics, rollups, relations) |
| 6.3 | Stronger board interactions and persisted grouping config | Makes board view truly first-class |
| 6.4 | Database entry **page templates** (row-backed pages) and shortcuttable insert flows | Same row model; faster capture for repeated shapes |
| 6.5 | Database-scoped search (within one DB / view) | Complements 5.2 workspace-wide search |

### Phase 7 — Release hardening and sync UX

| # | Item | Why next |
|---|------|----------|
| ~~7.1~~ | ~~Conflict-resolution UI for `updated_at` mismatches~~ | ✅ Done — bidirectional file sync + cloud conflict detection + settings page |
| ~~7.4~~ | ~~Git-based sync (auto-commit + push/pull to remote)~~ | ✅ Done — git init/commit/pull/push cycle, periodic scheduler, test connection, git status panel |
| 7.2 | CI workflow for lint + backend tests + Playwright smoke suite | Keeps redesign stable |
| 7.3 | Production deployment path and env hardening | Needed before wider usage |
| ~~7.5~~ | ~~GitHub Device Flow OAuth + repo picker~~ | ✅ Done — OAuth Device Flow login, repo picker from user's GitHub repos, PAT fallback. Protocol spec in `docs/PLAN_GITHUB_OAUTH.md`. |

### Phase 8 — Customization and design system

| # | Item | Why next |
|---|------|----------|
| 8.1 | Page templates with key-bindable shortcuts | Faster authoring; pairs with slash/gutter mental model |
| 8.2 | User-defined design profiles: fonts, colours, styles (beyond classic / campaign presets) | README roadmap; depends on stable token surface in `globals.css` |
| 8.3 | Icons and visual identity: better defaults, picker depth, consistency across shell + DB | Surface polish across dense UI |
| 8.4 | Dedicated highlighter mark (background highlight) vs text colour | Selection bubble + link UX refreshed; optional separate highlight tool remains |

### Phase 9 — Productivity and lifestyle

| # | Item | Why next |
|---|------|----------|
| 9.1 | Tasks, todos, reminders (data model + surfaces) | Cross-cuts editor, DB, and notifications; scope carefully vs existing todo blocks |
| 9.2 | Mood tracker | Distinct surface; likely optional module |

### Phase 10 — AI and external integrations

| # | Item | Why next |
|---|------|----------|
| 10.1 | AI-assisted search across pages (see also 5.2) | Retrieval quality + trust UX (citations, scope) |
| 10.2 | Generative AI: prose, structured blocks, database scaffolding, page creation | Same API/document contract; strong guardrails |
| 10.3 | External tool integrations (calendar, drive, email, publishing, …) | Long tail; prefer narrow vertical slices |
| 10.4 | Auto tag detection and suggestions | Metadata loop with pages + databases |

### Phase 11 — Native clients

| # | Item | Why next |
|---|------|----------|
| 11.1 | Windows desktop application | Align with `docs/FRAMEWORK_DIRECTION.md` — package web + backend |
| 11.2 | Android application | Separate client vs shared API / `LeafDocument` |

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
6. AI: local-only models, cloud APIs with user keys, hosted Leaf service, or hybrid — which default matches the product promise (local-first)?
7. Native clients: prioritize **desktop** packaging vs **mobile** companion first given the current editor complexity?

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
| `frontend/src/components/editor/LeafEditor.tsx` | Main editor implementation, node views, toggle card wiring; block gutter uses `posAtCoords` for atom views (stat strip, embeds); drag column zones + reorder use `resolveInnermostContentBlockRange` for nested targets |
| `frontend/src/components/editor/ToggleCardHeaderField.tsx` | Toggle card header lines: mini TipTap + filtered slash (Style, Flags) |
| `frontend/src/components/editor/toggleCardHeaderSlash.ts` | Slash actions and ranking for toggle header fields |
| `frontend/src/lib/editorRichText.ts` | Story-tag presets and shared colour swatches |
| `frontend/src/components/SlashCommands.tsx` | Slash items, `SlashMenuPanel`, `SlashCommandList`, viewport-aware `computeFixedMenuTopLeft` |
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
| `frontend/public/fonts/*.woff2` | Vendored campaign fonts (offline Docker / `npm install`) |
| `frontend/scripts/download-fonts.js` | Optional refresh from Google Fonts (`npm run fonts`) |
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
| `backend/app/sync/github_oauth.py` | GitHub OAuth Device Flow client (platform-independent protocol) |
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

*Last updated: 2026-03-31. Selection bubble link panel, floating link (Ctrl+K), link card edit dialog, prose link styling.*
