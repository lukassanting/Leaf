# Leaf — Editor Design Reference

Single source of truth for how the current editor experience should look, feel, and behave.

---

## 1. Shell layout

The editor and database routes share a three-pane shell:

```text
App (flex row, 100vw × 100vh)
├── Left sidebar (260px, navigation)
│   ├── Branding
│   ├── Search / Recent / Settings
│   ├── KNOWLEDGE BASE section
│   ├── Personal page tree
│   └── PROJECTS page tree
├── Center canvas (flex: 1, flex column)
│   ├── Sticky top navigation (48px)
│   ├── Identity header (title, description, tags)
│   ├── Editor / database canvas (flex: 1, overflow-y: auto)
│   └── Status bar (28px)
└── Right sidebar (280px, context)
    ├── Page Info header
    ├── METADATA section
    ├── PAGE OUTLINE section
    └── LINKED MENTIONS section
```

Key expectations:

- The identity header is left-aligned and shared between pages and databases.
- The left sidebar is for navigation and workspace structure.
- The right sidebar is for metadata, page outline, and linked mentions.
- The status bar remains visible at the bottom and carries sync state plus current mode.
- Both sidebars can be toggled off for distraction-free writing.

---

## 2. Icons and identity

- Use the shared SVG icons from `src/components/Icons.tsx` for page and database chrome.
- User-selected icons may be emoji, uploaded images, or supported SVG shapes through the icon picker.
- Page and database identity surfaces should stay visually parallel: icon, title, description, tags, and lightweight meta.

---

## 3. Editor behavior

### Structured content

- Page content persists as `LeafDocument` JSON.
- Legacy HTML content should be migrated on load, not edited as raw legacy HTML.
- New block types must fit into the structured model before they are considered complete.

### Editing modes

- Rich mode is the default.
- Markdown mode is still supported for import/export and source-style editing.
- The mode switch lives in the status bar, not in a top formatting toolbar.

### Autosave

- Typing should stay local-first.
- Save states should be visible but low-noise.
- Reloading after a successful save should preserve the exact structured content shape.

---

## 4. Block creation surfaces

Block insertion currently happens through:

1. Slash commands (`/`)
2. The block insertion handle/menu

Both surfaces should expose the same mental model and roughly the same option set.

Current supported insertions:

| Group | Items |
|---|---|
| Text | Heading 1, Heading 2, Heading 3, Bold, Italic, Strikethrough, Code |
| Structure | Bullet list, Numbered list, To-do list, Quote |
| Insert | 2 columns, 3 columns, Sub-page, Database |

Important behavior:

- Text/structure commands transform or insert into the current document flow.
- Sub-page creates a page embed block.
- Database creates an inline database embed backed by the shared database surface.
- Column layouts create persisted `columnLayout` blocks.

---

## 5. Embed behavior

### Page embeds

Page embeds are lightweight card-style blocks:

- show icon, title snapshot, status, and navigate affordance
- navigate to the page on click
- can be removed from the document without deleting the underlying page

### Database embeds

Database embeds are no longer lightweight cards after creation.

- pending/error states may render as a simple placeholder card
- once ready, the block expands into the shared inline database surface
- the inline surface should feel like a real block in the page, not a detached preview
- removing the block removes only the embed from the document, not the database itself

---

## 6. Column layouts

Current column support is intentionally lightweight:

- 2-column and 3-column layouts are first-class document nodes
- each column currently stores lightweight text content
- columns support drag reordering within the block

Design intent:

- columns should read as part of the page flow, not as a modal or detached widget
- the drag affordance should stay subtle
- future work can upgrade columns into true nested block containers without changing the page-level shell

---

## 7. Sidebar expectations

### Left sidebar
- Primary purpose: navigation and workspace structure.
- Organized into sections: KNOWLEDGE BASE (Graph View), Personal (page tree), PROJECTS (project tree).
- Section labels should be muted, uppercase, and tracked.
- Pages and databases appear in the same navigational tree with distinct icons.

### Right sidebar
- Primary purpose: metadata and context.
- Three main sections: METADATA (created, author, tags), PAGE OUTLINE (hierarchical headings), LINKED MENTIONS (backlink cards).
- Clicking identity fields in the sidebar should focus the corresponding field in the header when possible.
- Backlinks belong in the sidebar, not inline below the editor body.

---

## 8. Search and navigation direction

Already implemented:

- sidebar search by title
- breadcrumb navigation
- backlinks visibility in the sidebar

Planned next:

- quick switcher (`Cmd+K`)
- full-text search over structured content
- stronger wikilink/backlink workflows

---

## 9. Design system contract

`LEAF_DESIGN_GUIDE.md` remains the visual source of truth.

Non-negotiables:

- use the shared token set and shell surfaces from the design guide
- prefer SVG chrome icons from `Icons.tsx`
- keep font weights at 400/500
- keep block handles and drag affordances subtle
- avoid reintroducing a heavy formatting toolbar

---

## 10. Constraints and follow-up

- Stability is more important than clever editor behavior.
- Avoid changes that risk reintroducing the prior ProseMirror runtime issues.
- New block types should be shared and reusable where possible.
- The next editor milestone is true nested block columns plus full document block drag/reorder.

---

*Last updated: 2026-03-19 — reflects the three-pane shell, inline database embeds, column layout blocks, and database list view.*
