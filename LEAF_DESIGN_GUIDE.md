# Leaf Design Guide

Single source of truth for all visual decisions in the Leaf editor.
Read this before touching any styles.

---

## 1. Design tokens

### Colours

| Token | Hex | Usage |
|---|---|---|
| `sidebar-bg` | `#f4f4f5` | Sidebar background (zinc-100) |
| `editor-bg` | `#ffffff` | Editor / main area background |
| `app-bg` | `#fafafa` | App frame / status bar surface |
| `primary` | `#10b981` | Buttons, active highlights, links (emerald-500) |
| `primary-dark` | `#047857` | Hover state for primary (emerald-700) |
| `text-dark` | `#18181b` | Page titles, headings (zinc-900) |
| `text-body` | `#3f3f46` | Body / paragraph text (zinc-700) |
| `text-muted` | `#71717a` | Placeholders, secondary labels, meta (zinc-500) |
| `border` | `#e4e4e7` | All dividers and borders (zinc-300) |
| `tag-bg` | `#ecfdf5` | Tag pill background (emerald-50) |
| `tag-border` | `#a7f3d0` | Tag pill border (emerald-200) |
| `tag-text` | `#047857` | Tag pill text (emerald-700) |
| `sidebar-active` | `rgba(16,185,129,0.14)` | Active page row in sidebar |
| `hover` | `rgba(16,185,129,0.08)` | Hover row in sidebar / editor |

Tailwind mapping (leaf- scale):

```
leaf-50  → #f4f4f5   (sidebar bg — zinc-100)
leaf-100 → #ecfdf5   (tag bg — emerald-50)
leaf-200 → #a7f3d0   (tag border — emerald-200)
leaf-300 → #e4e4e7   (standard border — zinc-300)
leaf-400 → #71717a   (muted text — zinc-500)
leaf-500 → #10b981   (primary green — emerald-500)
leaf-600 → #047857   (primary hover — emerald-700)
leaf-700 → #3f3f46   (body text — zinc-700)
leaf-800 → #27272a   (dark text — zinc-800)
leaf-900 → #18181b   (darkest — title — zinc-900)
```

---

## 2. Typography

Font: Inter (or system-ui fallback). Two weights only: **400** and **500**. Never 600 or 700.

| Role | Size | Weight |
|---|---|---|
| Page title | 28–30px | 500 |
| H1 | 20px | 500 |
| H2 | 16px | 500 |
| H3 | 14px | 500 |
| Body | 14px | 400 |
| Meta / label | 11–12px | 400 |

---

## 3. Icons

Two SVG icons only. No emoji anywhere in the app.

- **Leaf icon** — used for all page nodes (title + sidebar)
- **Database icon** — used for all database nodes (title + sidebar)

Both are in `src/components/Icons.tsx`. Import from there.

Small block-type icons (for slash menu tiles) are also in `Icons.tsx`.

---

## 4. Layout

### Workspace shell (three-pane)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Left sidebar (260px)  │  Center canvas                │ Right sidebar│
│ #f4f4f5               │  #ffffff                      │ (280px)      │
│                       │                               │ #f4f4f5      │
│  Leaf                 │ Breadcrumbs / Leaf Project     │              │
│  ──────────────       │  [Ask AI ⌘K]  [...] [toggles] │ Page Info    │
│  🔍 Search            │  ─────────────────────────     │ ──────────── │
│  🕐 Recent            │                               │ METADATA     │
│  ⚙ Settings           │  🌿  Architecture Docs         │  Created     │
│                       │  description text…            │  Author      │
│  KNOWLEDGE BASE       │                               │  Tags        │
│  📊 Graph View        │  ┌─ Project Tasks ──────────┐ │ ──────────── │
│                       │  │ Table Board Gallery List  │ │ Description  │
│  Personal             │  │ ─────────────────────────│ │ ──────────── │
│   🌿 Daily Notes      │  │ Name  Status  Tags  Est  │ │ PAGE OUTLINE │
│   🌿 Reading List     │  │ ...   ...     ...   ...  │ │  1. Heading  │
│   🌿 Idea Dump        │  └──────────────────────────┘ │   1.1 Sub    │
│                       │                               │ ──────────── │
│  PROJECTS             │  ─────────────────────────     │ LINKED       │
│   ▼ Leaf Development  │  ● Synced  124w │ Rich        │ MENTIONS     │
│      🌿 Arch Docs     │                               │  [card]      │
│      🌿 Task Board    │                               │  [card]      │
│      🌿 Design System │                               │              │
│                       │                               │              │
│  [+ New page]         │                               │              │
└──────────────────────────────────────────────────────────────────────┘
```

### Editor page structure (top to bottom)

1. Top bar: sidebar toggle (left) + breadcrumbs (center) + `Ask AI ⌘K` button + width controls + focus toggle + sidebar toggle (right) — 48px
2. Title row: SVG icon + large editable title (left-aligned)
3. Description row: editable description text
4. Tags row: coloured pill chips with `+ Add…` affordance
5. Divider line
6. Editor content (ProseMirror)
7. Status bar: `● Synced  N words` left, `Rich | Markdown` toggle right — 28px

### Left sidebar structure (top to bottom)

1. Branding: leaf icon + "Leaf" wordmark — 44px header
2. Navigation: Search, Recent, Settings buttons
3. `KNOWLEDGE BASE` section label (muted, uppercase, tracked) with Graph View
4. `Personal` section label with page tree
5. `PROJECTS` section label with project tree
6. `+ New page` button — footer

### Right sidebar structure (top to bottom)

1. "Page Info" header
2. `METADATA` section: Created date, Author, Tags (coloured pills), Description
3. `PAGE OUTLINE` section: hierarchical heading list with active heading indicator (green dot)
4. `LINKED MENTIONS` section: backlink cards with title, snippet, and highlighted wikilink text

---

## 5. Slash menu

Triggered by typing `/` or clicking the `+` handle on a block.

Structure:
```
┌────────────────────────────────────┐
│ 🔍 [Search blocks…           ]    │  ← 32px search bar, autofocused
├────────────────────────────────────┤
│ TEXT                               │  ← group label (muted, 11px, uppercase)
│ [H1] Heading 1   Turn into H1     │  ← 28px icon tile + name 500w + desc 11px muted
│ [H2] Heading 2   Turn into H2     │
│ [H3] Heading 3                    │
├────────────────────────────────────┤
│ STRUCTURE                          │
│ [•]  Bullet list                  │
│ [1.] Numbered list                │
│ [✓]  To-Do list                   │
│ ["]  Quote                        │
├────────────────────────────────────┤
│ INSERT                             │
│ [🌿] Sub-page    New child page   │
│ [⊞]  Database    New table        │
└────────────────────────────────────┘
```

- Width: 260px
- Keyboard: ArrowUp/Down navigate, Enter inserts, Escape dismisses
- Dismiss on click outside
- Icon tile: 28×28px, background `#ecfdf5`, border-radius 6px, color `#10b981`

---

## 6. Component rules

- No `font-semibold` or `font-bold` anywhere — use `font-medium` (500) at most
- No coloured text heavier than `text-leaf-800`
- Border colour always `border-leaf-300` (`#e4e4e7`)
- Active sidebar row: `bg-[rgba(16,185,129,0.14)]`
- Hover row: `hover:bg-[rgba(16,185,129,0.08)]`
- Rounded corners: `rounded-md` (6px) for rows, `rounded-lg` (8px) for panels/modals
- All transitions: `transition-colors duration-150`

---

## 7. Motion

- Sidebar chevron rotate: `transition-transform duration-200`
- Menu appear: no animation (instant, avoids jank)
- Hover/active bg: `transition-colors duration-150`

---

## 8. Database views

Four view types are available via the view switcher toolbar:

### Table view
- Rounded bordered table container
- Header row with light gray background (`#fafafa`) and muted column labels
- Column borders between cells
- Name column with page icon and link affordance
- Tag/status/number columns with appropriate renderers
- `+ New` row in footer, `+ Add property` in header

### Board view (Kanban)
- Columns grouped by Status property
- Column headers: status pill + count badge + `+` and `...` buttons
- Cards: white with subtle border, showing title + tags + estimate
- `+ New` affordance at bottom of each column and as a new-column placeholder

### Gallery view
- 3-column responsive grid of cards
- Cover area with light tinted backgrounds and image placeholders
- Card body: title, status pill, tags, meta
- "New Page" card with `+` icon at the end

### List view
- Minimal rows with page icon and title on left
- Tags and status pill aligned to right
- `+ New` row at bottom

### Shared database styling
- View switcher: pill-shaped toggle group with active highlight
- Action buttons: `Filter`, `Sort`, `Search` (secondary), `New` (primary green)
- Tag pills use semantic tones:
  - positive (Done, Active): `#ecfdf5 / #047857 / #a7f3d0`
  - warning (In Progress, Review): `#fef5e0 / #7a5c10 / #e8d48a`
  - negative (Risk, Urgent, Bug): `#fef0ee / #8a3a2a / #e8c0b8`
  - neutral (To Do, default): `#f4f4f5 / #3f3f46 / rgba(0,0,0,0.06)`

---

## 9. Top navigation

- Sticky bar with glass-like translucency (`background: rgba(255,255,255,0.88)`, `backdrop-filter: blur(18px)`)
- Three sections: left (sidebar toggle), center (breadcrumbs + title), right (Ask AI + controls + sidebar toggle)
- `Ask AI ⌘K` button: green background with white text, sparkle icon
- Width mode switcher: segmented control with normal/wide/full options
- Focus mode: fullscreen icon, hides both sidebars

---

## 10. Right sidebar sections

### METADATA
Clean key-value rows:
- Created: date display
- Author: name with avatar
- Tags: coloured pill chips
- Description: multi-line text, truncated with expand affordance

### PAGE OUTLINE
- Hierarchical heading list indented by level
- Active heading marked with green dot indicator
- Heading levels shown as `1.`, `2.1`, `3.1` style numbering

### LINKED MENTIONS
- Cards with green left-accent strip
- Title in medium weight, snippet text below
- Highlighted `[[wikilink]]` text in green within snippets

---

## 11. Inline database blocks and column layouts

### Inline database blocks

- Embedded databases should reuse the same visual language as standalone database pages.
- Inline database blocks sit inside the page flow as rounded bordered panels, not detached cards.
- Pending/error creation states may use a simple embed card, but the ready state should expand into the shared database surface.

### Column layouts

- Column blocks use a simple grid inside the page flow with `20px` gaps.
- Two-column layouts use `grid-template-columns: 1fr 1fr`.
- Three-column layouts use `grid-template-columns: 1fr 1fr 1fr`.
- Each column surface should read as a soft drop zone: pale background, dashed border, subtle handle, no heavy chrome.
- Current column blocks are lightweight text columns; future nested-block columns should preserve the same outer shell and spacing.

---

## 12. Interaction patterns

- Width modes:
  - `normal`: `max-width: 680px`
  - `wide`: `max-width: 960px`
  - `full`: `max-width: 100%` with `padding: 0 24px`
- Focus mode hides the top strip and both sidebars, leaving the canvas and status bar.
- Slash menu width: `248px` to `260px`, instant open/close, grouped by `Text`, `Structure`, `Insert`
- Block handles and drag affordances must stay subtle and only appear on hover.

---

## 13. Icon picker exception

The earlier "no emoji anywhere in the app" rule is superseded for the icon picker content only.

- Emoji may appear only as user-selected page/database icons and inside the icon picker grid.
- UI chrome, navigation, and controls should still use SVG icons from `src/components/Icons.tsx`.

---

## 14. Floating AI companion

- AI remains a floating bottom-centered surface, not a permanent chat column
- It should feel discoverable and premium, with subtle glow/accent treatment
- Suggested actions appear before typing and collapse once input begins
- Trigger: `Ask AI ⌘K` button in top nav or floating action button

---

*Last updated: 2026-03-19*
