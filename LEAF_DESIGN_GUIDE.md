# Leaf Design Guide

Single source of truth for all visual decisions in the Leaf editor.
Read this before touching any styles.

---

## 1. Design tokens

### Colours

| Token | Hex | Usage |
|---|---|---|
| `sidebar-bg` | `#f0f3ed` | Sidebar background |
| `editor-bg` | `#fefffe` | Editor / main area background |
| `primary` | `#3d8c52` | Buttons, active highlights, links |
| `primary-dark` | `#2d7042` | Hover state for primary |
| `text-dark` | `#1a3828` | Page titles, headings |
| `text-body` | `#374f42` | Body / paragraph text |
| `text-muted` | `#8fa898` | Placeholders, secondary labels, meta |
| `border` | `#dce5d7` | All dividers and borders |
| `tag-bg` | `#edf5e8` | Tag pill background |
| `tag-border` | `#c5ddb8` | Tag pill border |
| `tag-text` | `#3b6b4a` | Tag pill text |
| `sidebar-active` | `rgba(61,140,82,0.14)` | Active page row in sidebar |
| `hover` | `rgba(61,140,82,0.08)` | Hover row in sidebar / editor |

Tailwind mapping (leaf- scale):

```
leaf-50  → #f0f3ed   (sidebar bg)
leaf-100 → #edf5e8   (tag bg / lightest tint)
leaf-200 → #c5ddb8   (tag border / soft border)
leaf-300 → #dce5d7   (standard border)
leaf-400 → #8fa898   (muted text)
leaf-500 → #3d8c52   (primary green)
leaf-600 → #2d7042   (primary hover)
leaf-700 → #374f42   (body text)
leaf-800 → #1e3d2e   (dark text, headings)
leaf-900 → #1a3828   (darkest — title)
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

### Workspace shell

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (240px, #f0f3ed) │ Editor area (#fefffe)         │
│                          │                               │
│  Leaf                    │  [Breadcrumbs]  [Export]      │
│  ──────────────          │  ─────────────────────────    │
│  🌿 Page 1               │  🌿  My Page Title             │
│    🌿 Sub-page           │                               │
│  ⊞  Database 1           │  created: …  [+tag] [+prop]  │
│                          │                               │
│  + New page              │  Block content…               │
│                          │  ─────────────────────────    │
│                          │  ● Synced  124w │ Rich        │
└──────────────────────────────────────────────────────────┘
```

### Editor page structure (top to bottom)

1. Top bar: breadcrumbs (left) + Export button (right) — 40px
2. Title row: SVG icon + large editable title
3. Properties row: Created date · Tags pill input · + Add property (all inline, no border)
4. Divider line
5. Editor content (ProseMirror)
6. Status bar: `● Synced  N words` left, `Rich | Markdown` toggle right — 32px

### Sidebar structure (top to bottom)

1. Branding: "Leaf" wordmark — 44px header
2. Tree (scrollable, flex-1)
3. "+ New page" button — 40px footer

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
- Icon tile: 28×28px, background `#edf5e8`, border-radius 6px, color `#3d8c52`

---

## 6. Component rules

- No `font-semibold` or `font-bold` anywhere — use `font-medium` (500) at most
- No coloured text heavier than `text-leaf-800`
- Border colour always `border-leaf-300` (`#dce5d7`)
- Active sidebar row: `bg-[rgba(61,140,82,0.14)]`
- Hover row: `hover:bg-[rgba(61,140,82,0.08)]`
- Rounded corners: `rounded-md` (6px) for rows, `rounded-lg` (8px) for panels/modals
- All transitions: `transition-colors duration-150`

---

## 7. Motion

- Sidebar chevron rotate: `transition-transform duration-200`
- Menu appear: no animation (instant, avoids jank)
- Hover/active bg: `transition-colors duration-150`

---

## 11. v3 additions

### Updated shell

The v3 shell replaces the older left-sidebar layout described above.

```
App (flex row, 100vw × 100vh)
├── Editor area (flex: 1, flex column)
│   ├── Top strip (38px)
│   ├── Centered identity header
│   ├── Editor / database canvas (flex: 1, overflow-y: auto)
│   └── Status bar (28px)
└── Right sidebar (232px)
```

Use these CSS variables for shell surfaces:

- `--leaf-bg-app`: app frame / status bar surface
- `--leaf-bg-editor`: editor canvas and top strip
- `--leaf-bg-sidebar`: right sidebar surface
- `--leaf-bg-hover`: subtle hover state
- `--leaf-bg-active`: active row state
- `--leaf-bg-tag`: pale tag and icon-chip background
- `--leaf-border-soft`: soft separators
- `--leaf-border-strong`: stronger separators and control borders
- `--leaf-text-title`: primary title text
- `--leaf-text-body`: body text
- `--leaf-text-sidebar`: emphasized sidebar / breadcrumb current page text
- `--leaf-text-muted`: secondary labels and metadata
- `--leaf-text-hint`: placeholder text
- `--leaf-green`: primary action green
- `--leaf-green-light`: lighter accent green for drop zones and soft emphasis

### Centered identity header

- Icon frame: `52x52`, `border-radius: 12px`, `background: --leaf-bg-tag`, `border: 0.5px solid --leaf-border-strong`
- Title: `28px`, `500`, `--leaf-text-title`, centered, `max-width: 680px`
- Description: `13.5px`, `--leaf-text-hint` when empty, centered, `max-width: 480px`
- Tags: `11px`, `border-radius: 4px`, `padding: 3px 8px`
- Header spacing: `padding: 36px 0 24px`, bottom border `0.5px solid --leaf-border-soft`

### Icon picker exception

The earlier “no emoji anywhere in the app” rule is superseded for the icon picker content only.

- Emoji may appear only as user-selected page/database icons and inside the icon picker grid.
- UI chrome, navigation, and controls should still use SVG icons from `src/components/Icons.tsx`.

### Right sidebar

- Width: `232px`
- Border-left: `0.5px solid --leaf-border-strong`
- Sections: identity, properties, page tree, backlinks, footer action
- Tree rows: `font-size: 12px`, `border-radius: 5px`, `padding: 4px 5px`
- Indent progression: `5px`, `14px`, `24px`, `34px`

### Database component styling

- View switcher container: `background: #eef3eb`, `border-radius: 20px`, `padding: 3px`
- Secondary action buttons: `font-size: 12px`, `padding: 5px 11px`, `border-radius: 7px`, `border: 0.5px solid #cdd9c6`
- Primary action button: `background: --leaf-green`, `color: white`, `border-color: --leaf-green`
- Shared tag pills:
  - positive: `#edf5e8 / #3b6b4a / #c5ddb8`
  - warning: `#fef5e0 / #7a5c10 / #e8d48a`
  - negative: `#fef0ee / #8a3a2a / #e8c0b8`
  - neutral: `#f0f3ed / #5a8a6a / #ccddc4`

### Interaction patterns

- Width modes:
  - `normal`: `max-width: 680px`
  - `wide`: `max-width: 960px`
  - `full`: `max-width: 100%` with `padding: 0 24px`
- Focus mode hides the top strip and right sidebar, leaving the canvas and status bar.
- Slash menu width: `248px` to `260px`, instant open/close, grouped by `Text`, `Structure`, `Insert`
- Block handles and drag affordances must stay subtle and only appear on hover.

---

*Last updated: 2026-03-18*
