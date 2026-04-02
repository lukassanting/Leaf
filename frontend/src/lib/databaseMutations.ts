/**
 * Leaf frontend: database mutation helpers (`frontend/src/lib/databaseMutations.ts`).
 *
 * Purpose:
 * - Wraps low-level typed API client calls for database CRUD and row actions.
 * - Emits cross-component events (`leaf-created`, `leaf-title-changed`) after relevant changes.
 *
 * How to read:
 * - Each exported function corresponds to a UI action:
 *   - `createDatabaseAndEmit`
 *   - `updateDatabaseAndEmitTitle`
 *   - `createDatabaseRow`
 *   - `updateDatabaseRowTitle`
 *
 * Update:
 * - To modify what gets emitted, adjust the `emitLeaf*` calls.
 * - If the backend API payloads change, update the argument mapping to `databasesApi`/`leavesApi`.
 *
 * Debug:
 * - If UI doesn’t reflect changes immediately, ensure the emitted events are listened to
 *   (notably in `useSidebarTreeModel`).
 * - If row title updates don’t persist, check that `row.leaf_id` is present and that
 *   `leavesApi.update(...)` sends the correct fields.
 */
import { databasesApi, leavesApi } from './api'
import type { DatabaseCreate, DatabaseRow, ViewType } from './api'
import { emitLeafCreated, emitLeafTitleChanged } from './appEvents'

export async function createDatabaseAndEmit(payload: DatabaseCreate) {
  const database = await databasesApi.create(payload)
  emitLeafCreated({
    id: database.id,
    title: database.title,
    parent_id: payload.parent_leaf_id ?? null,
    kind: 'database',
  })
  return database
}

export async function updateDatabaseAndEmitTitle(databaseId: string, payload: DatabaseCreate) {
  const database = await databasesApi.update(databaseId, payload)
  emitLeafTitleChanged({ id: databaseId, title: database.title })
  return database
}

export async function updateDatabaseViewType(
  databaseId: string,
  payload: DatabaseCreate,
  viewType: ViewType,
) {
  return databasesApi.update(databaseId, { ...payload, view_type: viewType })
}

export async function createDatabaseRow(databaseId: string) {
  return databasesApi.createRow(databaseId, { properties: {} })
}

export async function updateDatabaseRowTitle(
  row: DatabaseRow,
  databaseId: string,
  title: string,
) {
  if (!row.leaf_id) return null
  const currentLeaf = await leavesApi.get(row.leaf_id)
  await leavesApi.update(row.leaf_id, {
    title,
    database_id: databaseId,
    children_ids: currentLeaf.children_ids,
    parent_id: currentLeaf.parent_id,
    tags: currentLeaf.tags,
  })
  return title
}
