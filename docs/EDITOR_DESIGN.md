# Leaf — Editor Design Reference

Single source of truth for how the editor should look, feel, and behave.
Update this file whenever a design decision is made or changed.

---

## 1. Page layout (top to bottom)

```
┌─────────────────────────────────────────────────────┐
│  🍃 Programming / Detailed Notes / SQL Notes        │  ← breadcrumbs (clickable)
│                                                     │
│  🍃  My Page Title                                  │  ← large editable title, leaf icon left
│                                                     │
│  [work]  [q1]  [notes]  + Add tag…                 │  ← tags chip input
│                                                     │
│  Saved                          ← save status       │
│  ─────────────────────────────────────────────────  │
│                                                     │
│ +  Block content here…                              │  ← rich editor, + on left of each block
│ +  ## Heading                                       │
│ +  - Bullet item                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

For a **database** page the layout is identical, replacing the leaf icon with a tree icon (🌳).

---

## 2. Icons

| Item     | Icon          | Usage                                          | Status |
|----------|---------------|------------------------------------------------|--------|
| Page     | 🍃 (leaf)     | Left of title in editor; left of item in sidebar | ✅ |
| Database | 🌳 (tree)     | Left of title in editor; left of item in sidebar | ✅ |

Icons are rendered as emoji. Long-term: swap for custom SVG matching the leaf/earth palette.

---

## 3. Breadcrumbs

- Shown at the very top of the editor, above the title.
- Format: `Parent / Grandparent / Current page` (clickable links).
- For database pages: the parent is the leaf page that created it.
- For database row pages (opened from a database): chain is `…/ Database Name / Row Title`.
- Implementation: built from the cached tree on load; refreshes on `leaf-tree-changed`.

---

## 4. Block menu (per-block "+")

A `+` button appears **to the left** of every block in the editor when hovered.

### Hover behaviour
- Appears when the mouse is over a block row.
- Does **not** disappear when the mouse moves left toward the `+` (300 ms grace period).
- Stays visible while the dropdown is open, regardless of mouse position.
- Disappears when mouse leaves the editor area entirely (after the grace period).

### Dropdown options

| Option          | TipTap command                          | Status |
|-----------------|-----------------------------------------|--------|
| Header 1        | `setHeading({ level: 1 })`             | ✅ |
| Header 2        | `setHeading({ level: 2 })`             | ✅ |
| Header 3        | `setHeading({ level: 3 })`             | ✅ |
| Bold            | `toggleBold()`                          | ✅ |
| Italic          | `toggleItalic()`                        | ✅ |
| Strikethrough   | `toggleStrike()`                        | ✅ |
| Code            | `toggleCode()`                          | ✅ |
| Bullet list     | `toggleBulletList()`                    | ✅ |
| Numbered list   | `toggleOrderedList()`                   | ✅ |
| To-Do list      | `toggleTaskList()` — `@tiptap/extension-task-list` + `task-item` | ✅ |
| Quote           | `toggleBlockquote()`                    | ✅ |
| ─────────────── | ─────────────────────────────────────── | |
| 🍃 New page     | Creates leaf with `parent_id`, inserts card | ✅ |
| 🌳 New database | Creates database with `parent_leaf_id`, inserts card | ✅ |

### Insertion behaviour
- Type-change options (headings, lists, etc.): **convert** the current block.
- New page / database: **insert a card block** after the current block; stay on current page.

---

## 5. Slash commands (`/`) ✅

Typing `/` anywhere in the editor opens the same menu as the `+` button, inline at the cursor.

- Filtered as you type: `/h1` → shows only "Header 1", `/page` → shows "New page", etc.
- `Escape` dismisses without inserting.
- Implementation: `@tiptap/suggestion` + `tippy.js` popup in `SlashCommands.tsx`.
- The slash character itself is removed on selection.

---

## 6. Page card blocks

When a sub-page or database is created from within a page, a card block is embedded:

```
┌─────────────────────────────────────────────┐
│  🍃  My Sub-page title                  ↗  │
└─────────────────────────────────────────────┘
```

- Clicking the card or `↗` navigates to that page.
- `✕` button on hover deletes the card from the content (does NOT delete the page).
- Card stores: `id`, `title` (snapshot at creation), `kind` (`page` | `database`).
- Title in the card goes stale on rename — future: live-fetch on render.

---

## 7. Search and filtering

### Immediate scope
- Sidebar search: filter by title (already implemented).

### Planned scope
- **Full-text search** across page content (body text, not just titles).
- **Filter by tags**: select one or more tags, show only matching pages.
- **Filter by type**: pages only / databases only / all.
- **Sort**: last modified, created date, alphabetical.
- **Quick open** (Cmd+K): fuzzy search by title across all pages and databases.

### Architecture decisions for search

| Decision | Choice | Reason |
|---|---|---|
| Index source | SQLite FTS5 (full-text search extension) | Built into SQLite 3.9+; zero extra infra |
| What to index | `title`, `content` (Markdown, stripped), `tags` | Covers all user-searchable fields |
| When to index | On every `write_page` / `patch_leaf_content` in `leaf_operations.py` | Keeps FTS index always current |
| FTS table | `leaves_fts` virtual table (FTS5), columns: `id`, `title`, `body`, `tags` | Separate from `leaves` to avoid schema coupling |
| Tag filter | `WHERE tags LIKE '%"work"%'` on JSON column, or FTS5 `tags:work` | JSON LIKE for exact tag match; FTS5 for fuzzy |
| Endpoint | `GET /search?q=…&tags=…&type=…&sort=…` | Single search endpoint, all filters optional |
| Frontend | Cmd+K modal + sidebar search both call the same endpoint | DRY |
| CRDT compat | FTS index is rebuilt from files on `rebuild-index`; ops log includes title/tag ops for live updates | No migration needed when CRDT is added |

---

## 8. Sidebar

- Pages and databases shown in the same tree with different icons (🍃 / 🌳).
- Databases appear as children of the page they were created in.
- Context menu: Rename, Delete.
- Inline `+` on page nodes creates a child page.
- Drag-and-drop reorder of sibling pages (not databases, for now).
- Search bar at top filters the tree by title.
- `Collapse all` button when any node is expanded.

---

## 9. Design system

This project uses a strict design system defined in `LEAF_DESIGN_GUIDE.md` at the repo root.

**Before writing any code:**

1. **CREATE** `LEAF_DESIGN_GUIDE.md` at the project root if it does not exist (copy the canonical content from the existing file).
2. **READ** it fully before touching any styles.
3. **All design decisions** — colours, spacing, type sizes, border radii, motion durations, icon shapes — must match the guide. Do not introduce new values without updating the guide first.

Key rules:
- Two SVG icons only: Leaf (pages) and Database (databases). No emoji.
- Two font weights only: 400 and 500. Never 600 or 700.
- The formatting toolbar is **removed**. All block creation is via `/` slash commands or the block `+` handle.
- Status bar at the bottom of every editor page: synced status + word count left, mode toggle right.

---

## 10. Decisions and constraints

- **Icons**: emoji for now (`🍃` page, `🌳` database); swap for SVG in a polish pass.
- **Block menu hover**: use a 300 ms grace-period timer so moving left to the `+` doesn't hide it.
- **Slash commands**: same option set as `+` menu; reuse the same component.
- **Card title staleness**: acceptable for now; refresh on open (not on render) to avoid API calls per card.
- **Search infra**: SQLite FTS5 — no Elasticsearch, no extra service, consistent with "zero infra" principle.
- **Multi-device sync**: not in scope now; CRDT path is documented in `PLANS_AND_ROADMAP.md`.
- **Mobile**: not in scope; desktop and web first.

---

*Last updated: 2026-03-17 — block menu completed, slash commands implemented, icons added.*
