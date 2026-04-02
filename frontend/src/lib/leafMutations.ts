/**
 * Leaf frontend: leaf mutation helpers (`frontend/src/lib/leafMutations.ts`).
 *
 * Purpose:
 * - Wraps low-level leaf API calls (create/update/rename/patch content) with:
 *   - cache priming/updating (`leafCache.ts`)
 *   - offline save queueing (when applicable)
 *   - cross-component events (`appEvents.ts`)
 *
 * How to read:
 * - “Prime cache” helpers:
 *   - `createLeafAndPrimeCache`
 *   - `updateLeafAndPrimeCache`
 *   - `renameLeafAndPrimeCache`
 * - “Content save” helpers:
 *   - `saveLeafContentAndPrimeCache` (online, with 409 conflict retry handling)
 *   - `saveLeafContentOffline` (queues to `pendingSaves` and updates local cached snapshot)
 *
 * Update:
 * - If backend payloads for content patch conflict detection change, update the 409 handling
 *   and the retry strategy inside `saveLeafContentAndPrimeCache`.
 *
 * Debug:
 * - If autosave doesn’t persist, trace:
 *   - `useLeafAutosave` -> `saveLeafContentAndPrimeCache` / `saveLeafContentOffline`
 *   - network/offline status (`isOnline()`)
 *   - cache writes and `pendingSaves` queue cleanup.
 */
import { leavesApi } from './api'
import type { Leaf, LeafContent, LeafContentUpdate, LeafCreate } from './api'
import { emitLeafCreated, emitLeafTitleChanged, type LeafCreatedDetail } from './appEvents'
import { toCachedLeaf } from './cacheMappers'
import { clearPendingSave, enqueuePendingSave, setCachedLeaf } from './leafCache'

function sameLeafContent(a: LeafContent | null | undefined, b: LeafContent | null | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export async function primeLeafCache(leaf: Leaf, contentOverride?: LeafContent | null) {
  await setCachedLeaf(toCachedLeaf({
    ...leaf,
    content: contentOverride ?? leaf.content ?? '',
  }))
}

export async function createLeafAndPrimeCache(
  payload: LeafCreate,
  detail?: Omit<LeafCreatedDetail, 'id' | 'title'>,
) {
  const leaf = await leavesApi.create(payload)
  await primeLeafCache(leaf)
  emitLeafCreated({
    id: leaf.id,
    title: leaf.title,
    parent_id: detail?.parent_id ?? leaf.parent_id ?? null,
    kind: detail?.kind ?? 'page',
  })
  return leaf
}

export async function updateLeafAndPrimeCache(
  leafId: string,
  payload: LeafCreate,
  currentContent?: LeafContent | null,
) {
  const updated = await leavesApi.update(leafId, payload)
  await primeLeafCache(updated, currentContent ?? updated.content ?? '')
  return updated
}

export async function renameLeafAndPrimeCache(
  leafId: string,
  payload: LeafCreate,
  currentContent?: LeafContent | null,
) {
  const updated = await updateLeafAndPrimeCache(leafId, payload, currentContent)
  emitLeafTitleChanged({ id: leafId, title: updated.title })
  return updated
}

function getErrorStatus(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status
}

async function cacheSavedLeafContent(leaf: Leaf, contentOverride: LeafContent) {
  await setCachedLeaf(toCachedLeaf({
    ...leaf,
    content: contentOverride,
  }))
}

type SaveLeafContentArgs = {
  leafId: string
  content: LeafContent
  updatedAt?: string | null
  snapshot: {
    title: string
    description?: string | null
    parent_id: string | null
    database_id?: string | null
    children_ids: string[]
    tags?: string[]
  }
}

export async function saveLeafContentAndPrimeCache(args: SaveLeafContentArgs) {
  const payload: LeafContentUpdate = {
    content: args.content,
    ...(args.updatedAt ? { updated_at: args.updatedAt } : {}),
  }

  let updated: Leaf
  try {
    updated = await leavesApi.patchContent(args.leafId, payload)
  } catch (error) {
    if (getErrorStatus(error) !== 409) {
      throw error
    }

    const latest = await leavesApi.get(args.leafId)
    if (sameLeafContent(latest.content, args.content)) {
      await cacheSavedLeafContent(latest, args.content)
      await clearPendingSave(args.leafId)
      return latest
    }

    updated = await leavesApi.patchContent(args.leafId, {
      content: args.content,
      updated_at: latest.updated_at,
    })
  }

  await cacheSavedLeafContent(updated, args.content)
  await clearPendingSave(args.leafId)
  return updated
}

export async function saveLeafContentOffline(args: SaveLeafContentArgs) {
  await enqueuePendingSave(args.leafId, args.content, args.updatedAt ?? null)
  await setCachedLeaf(toCachedLeaf({
    id: args.leafId,
    title: args.snapshot.title,
    description: args.snapshot.description ?? null,
    content: args.content,
    updated_at: new Date().toISOString(),
    parent_id: args.snapshot.parent_id,
    database_id: args.snapshot.database_id ?? null,
    children_ids: args.snapshot.children_ids,
    tags: args.snapshot.tags ?? [],
  }))
}
