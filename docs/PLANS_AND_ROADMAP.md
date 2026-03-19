# Leaf — Plans and Roadmap

A single reference for where Leaf stands after the v3 redesign, what is verified, and what the next phase should tackle.

---

## 1. Product direction

- **Product:** a fast, Notion-inspired workspace for personal knowledge management with pages, embedded structure, and database views.
- **Experience goal:** instant-feeling navigation, stable typing, low-friction structure creation, and clear page/database relationships.
- **Editor goal:** rich editing with a Markdown-friendly mental model, structured persistence, and room to grow into richer blocks.
- **Architecture goal:** keep the stack simple and local-first while making future search, collaboration, and richer block types feasible.

---

## 2. Current architecture

- **Frontend:** Next.js 15 App Router, React, TipTap, Tailwind CSS v4.
- **Backend:** FastAPI, SQLAlchemy, MySQL.
- **Persistence:** page content is stored as `LeafDocument` JSON with a legacy HTML migration path; database metadata is stored alongside schema payloads.
- **Caching:** IndexedDB-first cache with localStorage fallback and pending-save queueing.
- **Data flow:** UI loads from cache first, revalidates from the API, then writes back through debounced PATCH/PUT calls.

```text
User → Next.js workspace shell ⇄ IndexedDB/local cache
                ↓
         FastAPI REST API ⇄ MySQL
```

---

## 3. Implemented and verified

### Core editor

- [x] Schema-first `LeafDocument` content model with HTML migration support.
- [x] Stable TipTap editor rebuild with `gapcursor`/`dropcursor` disabled.
- [x] Slash commands and block insertion menu for headings, lists, todos, quotes, sub-pages, databases, and column layouts.
- [x] Rich/Markdown mode switching plus Markdown import/export.
- [x] Page embeds as dedicated block nodes.
- [x] Inline database embeds as dedicated block nodes backed by the shared database surface.

### Workspace shell and metadata

- [x] Three-pane shell: left sidebar (navigation), center canvas, right sidebar (context).
- [x] Left sidebar with KNOWLEDGE BASE, Personal, and PROJECTS sections.
- [x] Right sidebar with METADATA, PAGE OUTLINE, and LINKED MENTIONS sections.
- [x] Icon picker with SVG shapes, uploaded images, and emoji as user-selected content.
- [x] Width modes (`normal`, `wide`, `full`) and focus mode.
- [x] Bottom status bar with sync state and mode label.
- [x] `Ask AI ⌘K` button in top navigation.

### Databases

- [x] Standalone database pages with shared toolbar and table/board/gallery/list views.
- [x] Embedded databases render the same shared surface inline inside editor pages.
- [x] Database metadata parity with pages: title, description, tags, icon.
- [x] Row-backed pages, inline cell editing, schema-driven columns, and add-column flows.

### Layout blocks

- [x] Persisted 2-column and 3-column block types in the document schema.
- [x] Inline text editing inside column blocks.
- [x] In-block drag reordering for column positions.

### Local-first and backend

- [x] Debounced autosave with optional conflict detection via `updated_at`.
- [x] Offline queueing and cache priming for faster create/open flows.
- [x] CRUD for leaves, tree loading, child reorder, databases, and rows.
- [x] Structured content round-tripping on the backend.
- [x] Backlink indexing for structured content text extraction.

### Verification completed

- [x] Backend integration tests for leaf/database flows and structured content round-tripping.
- [x] Playwright coverage for:
  - page create/type/reload persistence
  - slash page/database embeds without ProseMirror runtime crashes
  - todo Enter flow staying interactive
  - inline database embeds rendering the shared database surface
  - column layout insert + reload persistence
- [x] Frontend lint and production build passing after the redesign.

---

## 4. Recommended next phase

These are the next best steps after the completed redesign.

### Phase 4 — Structured editing depth

| # | Item | Why next |
|---|------|----------|
| 4.1 | Upgrade column layouts from lightweight text columns to true nested block columns | Biggest functional gap in the new block system |
| 4.2 | Add a real document block drag handle and block reorder flow | Completes the core Notion-like editing model |
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
| 7.1 | Conflict-resolution UI for `updated_at` mismatches | Required for trust in multi-device edits |
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

1. Should column blocks become full nested block containers or stay lightweight for one more iteration?
2. Should document block drag use native ProseMirror drag, a custom overlay, or a hybrid handle-only approach?
3. Should search be cache-first with API fallback, or fully API-backed once indexing exists?
4. Which database property types matter most immediately after `text/number/tags/select`?
5. Is real-time collaboration still out of scope for the next milestone, or do we need to preserve a path for it now?

---

## 6. Key files

### Frontend

| Path | Purpose |
|------|---------|
| `frontend/src/app/(workspace)/editor/[id]/page.tsx` | Page editor route and shell wiring |
| `frontend/src/app/(workspace)/databases/[id]/page.tsx` | Standalone database page |
| `frontend/src/components/editor/LeafEditor.tsx` | Main editor implementation and node views |
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
| `frontend/src/lib/leafDocument.ts` | Structured content parsing and normalization |
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
| `backend/tests/test_leaf_database_integration.py` | Integration coverage for current backend behavior |

---

## 7. Constraints and working assumptions

- **Keep the editor stable first.** Avoid reintroducing known ProseMirror crash vectors while extending block behavior.
- **Preserve backward compatibility.** Legacy HTML content should still load cleanly through migration into the structured document model.
- **Prefer shared surfaces.** Standalone and embedded database experiences should keep using the same underlying components.
- **Keep docs aligned with the v3 shell.** The centered header, right sidebar, and bottom status bar are the default product shape now.
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

*Last updated: 2026-03-19. This roadmap reflects the three-pane shell redesign, list view addition, and the recommended follow-up phase.*
