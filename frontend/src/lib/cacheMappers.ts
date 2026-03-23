/**
 * Leaf frontend: cache mapping helpers (`frontend/src/lib/cacheMappers.ts`).
 *
 * Purpose:
 * - Converts API DTO shapes into the `CachedLeaf` shape stored in local cache
 *   (IndexedDB / localStorage via `leafCache.ts`).
 *
 * How to read:
 * - `toCachedLeaf(...)` is the only export.
 * - It normalizes optional fields (`content`, `parent_id`, `children_ids`, `tags`).
 *
 * Update:
 * - If you add fields to `CachedLeaf`, update the `CachedLeafSource` pick type and the mapper.
 * - Keep the mapper consistent with how `getCachedLeaf` persists objects.
 *
 * Debug:
 * - If cached values are missing/empty, check whether the mapper is defaulting fields as intended.
 */
import type { CachedLeaf } from './leafCache'
import type { Leaf, LeafContent } from './api'

type CachedLeafSource = Pick<
  Leaf,
  'id' | 'title' | 'updated_at' | 'parent_id' | 'database_id' | 'children_ids'
> & {
  content?: LeafContent | null
  description?: string | null
  tags?: string[]
  content_text_length?: number
}

export function toCachedLeaf(source: CachedLeafSource): CachedLeaf {
  return {
    id: source.id,
    title: source.title,
    description: source.description ?? null,
    content: source.content ?? '',
    content_text_length: source.content_text_length ?? 0,
    updated_at: source.updated_at,
    parent_id: source.parent_id ?? null,
    database_id: source.database_id ?? null,
    children_ids: source.children_ids ?? [],
    tags: source.tags ?? [],
  }
}
