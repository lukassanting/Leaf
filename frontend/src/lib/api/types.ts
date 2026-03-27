/**
 * Leaf frontend: shared API types (`frontend/src/lib/api/types.ts`).
 *
 * Purpose:
 * - Defines the TypeScript types/interfaces used by the typed API clients and
 *   hooks/components.
 * - Keeps request/response shapes consistent across `lib/api/*` and the rest
 *   of the frontend.
 *
 * How to read:
 * - Leaf section: document model (`LeafNode`/`LeafInlineNode`), icons, leaf entities,
 *   and graph/tree DTOs.
 * - Database section: database schema/property definitions and row properties.
 *
 * Update:
 * - When the backend DTOs change, update this file and then adjust:
 *   - `frontend/src/lib/api/leaves.ts` and `databases.ts`
 *   - any parsing/serialization utilities (`leafDocument.ts`, caches/mappers, etc.).
 *
 * Debug:
 * - Type mismatches are usually the first signal; they can also hint that backend
 *   and frontend are using different conventions for fields like `properties`, `tags`,
 *   or `view_type`.
 */
export type LeafType = 'page' | 'project'

export type LeafMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'textStyle'; attrs?: { color?: string | null } }
  | { type: 'link'; attrs: { href: string; target?: string | null; rel?: string | null } }

export type LeafTextNode = {
  type: 'text'
  text: string
  marks?: LeafMark[]
}

export type LeafWikilinkNode = {
  type: 'wikilink'
  attrs: {
    id: string
    label: string
    path: string
  }
}

export type LeafHashtagNode = {
  type: 'hashtag'
  attrs: {
    tag: string
    id: string
  }
}

export type StoryTagVariant = 'combat' | 'political' | 'character' | 'lore' | 'boss' | 'neutral'

export type LeafStoryTagNode = {
  type: 'storyTag'
  attrs: {
    label: string
    variant: StoryTagVariant
  }
}

export type LeafInlineNode =
  | LeafTextNode
  | { type: 'hardBreak' }
  | LeafWikilinkNode
  | LeafHashtagNode
  | LeafStoryTagNode

export type LeafColumnNode = {
  type: 'column'
  attrs?: { width?: number | null }
  content: LeafNode[]
}

export type LeafNode =
  | { type: 'paragraph'; attrs?: { textAlign?: string | null }; content?: LeafInlineNode[] }
  | { type: 'heading'; attrs: { level: 1 | 2 | 3; textAlign?: string | null }; content?: LeafInlineNode[] }
  | { type: 'blockquote'; attrs?: { textAlign?: string | null }; content: LeafNode[] }
  | { type: 'callout'; attrs?: { variant?: string }; content: LeafNode[] }
  | { type: 'bulletList'; content: { type: 'listItem'; content: LeafNode[] }[] }
  | { type: 'orderedList'; content: { type: 'listItem'; content: LeafNode[] }[] }
  | { type: 'taskList'; content: { type: 'taskItem'; attrs: { checked: boolean }; content: LeafNode[] }[] }
  | { type: 'codeBlock'; attrs?: { language?: string | null }; content?: LeafTextNode[] }
  | { type: 'image'; attrs: { src: string; alt?: string | null; width?: number | null; height?: number | null } }
  | { type: 'linkCard'; attrs: { url: string; title?: string; description?: string | null; image?: string | null } }
  | { type: 'horizontalRule' }
  | { type: 'columnList'; content: LeafColumnNode[] }
  | {
      type: 'toggleCard'
      attrs?: {
        open?: boolean
        eyebrow?: string
        title?: string
        subtitle?: string
        accent?: number
        eyebrowColor?: string | null
        titleColor?: string | null
        subtitleColor?: string | null
      }
      content: LeafNode[]
    }
  | { type: 'pageEmbed'; attrs: { id: string; title: string; kind: 'page' } }
  | { type: 'databaseEmbed'; attrs: { id: string; title: string; kind: 'database'; view?: 'table' | 'board' | 'gallery' } }
  | {
      type: 'statStrip'
      attrs: {
        columns?: number
        variant?: string
        kicker0: string
        title0: string
        kicker1: string
        title1: string
        kicker2: string
        title2: string
        kicker3?: string
        title3?: string
      }
    }
  | { type: 'table'; content: LeafNode[] }
  | { type: 'tableRow'; content: LeafNode[] }
  | { type: 'tableCell'; content: LeafNode[] }
  | { type: 'tableHeader'; content: LeafNode[] }

export type LeafDocument = {
  type: 'doc'
  version: 1
  content: LeafNode[]
}

export type LeafContent = LeafDocument | string

export interface LeafIcon {
  type: 'emoji' | 'svg' | 'image'
  value: string
}

export interface Leaf {
  id: string
  title: string
  path: string
  type: LeafType
  description?: string | null
  content?: LeafContent | null
  parent_id?: string | null
  database_id?: string | null
  children_ids: string[]
  tags: string[]
  icon?: LeafIcon | null
  /** Custom page metadata (e.g. `headerBanner` object with `src` + `objectPosition`). */
  properties?: Record<string, unknown> | null
  content_text_length: number
  created_at: string
  updated_at: string
}

export interface LeafTreeItem {
  id: string
  title: string
  path: string
  type: LeafType
  kind?: 'page' | 'database'
  parent_id?: string | null
  children_ids: string[]
  tags: string[]
  order: number
}

export interface LeafGraphNode {
  id: string
  title: string
  path: string
  type: LeafType
  tags: string[]
}

export interface LeafGraphEdge {
  source: string
  target: string
}

export interface LeafGraph {
  nodes: LeafGraphNode[]
  edges: LeafGraphEdge[]
}

export interface LeafCreate {
  title: string
  description?: string | null
  content?: LeafContent | null
  parent_id?: string | null
  database_id?: string | null
  children_ids?: string[]
  tags?: string[]
  icon?: LeafIcon | null
  properties?: Record<string, unknown> | null
  /** Sidebar ordering (root pages and siblings); optional on PATCH-style updates */
  order?: number
}

export interface LeafContentUpdate {
  content: LeafContent
  updated_at?: string
}

export interface LeafReorderChildren {
  child_ids: string[]
}

// ─── Databases ───────────────────────────────────────────────────────────────

export type PropertyType = 'text' | 'number' | 'tags' | 'select' | 'date'

/** Palette keys for tag/status chips (see `globals.css` --leaf-db-chip-*). */
export type DatabaseChipColor =
  | 'default'
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'

export interface PropertyOption {
  id: string
  label: string
  color?: DatabaseChipColor
}

export interface PropertyDefinition {
  key: string
  label: string
  type: PropertyType
  /** When true, table cells for this column wrap text instead of staying on one line. */
  wrap?: boolean
  /** Table view: column width in pixels (user-resizable). */
  width?: number
  /** For `tags` and `select`: predefined choices with colours; row values are option labels. */
  options?: PropertyOption[]
}

export interface DatabaseSchema {
  properties: PropertyDefinition[]
  /** Table view: width of the Name column in pixels. */
  name_column_width?: number
}

export type ViewType = 'table' | 'list' | 'gallery' | 'board'

export type GallerySize = 'small' | 'medium' | 'large'

export interface Database {
  id: string
  title: string
  schema: DatabaseSchema
  view_type: ViewType
  parent_leaf_id?: string | null
  description?: string | null
  tags: string[]
  icon?: LeafIcon | null
  created_at: string
  updated_at: string
}

export interface DatabaseCreate {
  title?: string
  schema?: DatabaseSchema
  view_type?: ViewType
  parent_leaf_id?: string | null
  description?: string | null
  tags?: string[]
  icon?: LeafIcon | null
}

/** Optional cover from linked leaf `properties.headerBanner` (for gallery cards). */
export type LeafHeaderBanner = {
  src: string
  objectPosition?: string
}

export interface DatabaseRow {
  id: string
  database_id: string
  leaf_id?: string | null
  leaf_title: string
  properties: Record<string, unknown>
  leaf_header_banner?: LeafHeaderBanner | null
  /** Display order within the database (table/list/board). */
  order?: number
  created_at: string
  updated_at: string
}

export interface RemovePropertyResponse {
  database: Database
  rows: DatabaseRow[]
}

export interface RowCreate {
  properties?: Record<string, unknown>
}

export interface RowUpdate {
  properties?: Record<string, unknown>
}

// ─── Trash ───────────────────────────────────────────────────────────────────

export interface TrashLeafItem {
  id: string
  title: string
  deleted_at: string
  purge_at: string
}

export interface TrashDatabaseItem {
  id: string
  title: string
  deleted_at: string
  purge_at: string
}

export interface TrashListResponse {
  leaves: TrashLeafItem[]
  databases: TrashDatabaseItem[]
  retention_days: number
}
