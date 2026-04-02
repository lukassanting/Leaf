/**
 * Leaf frontend: API module barrel (`frontend/src/lib/api/index.ts`).
 *
 * Purpose:
 * - Re-exports typed API clients and shared types so other modules can import
 *   from `@/lib/api`.
 *
 * How to read:
 * - `leavesApi` is implemented in `./leaves`.
 * - `databasesApi` is implemented in `./databases`.
 * - Types live in `./types`.
 *
 * Update:
 * - To add a new API client, create a new file in this folder and re-export it here.
 *
 * Debug:
 * - If imports break, verify the re-export paths match the filenames and that
 *   type exports use `export type * from ...` when appropriate.
 */
export { leavesApi } from './leaves'
export { databasesApi } from './databases'
export { syncApi } from './sync'
export { trashApi } from './trash'
export type * from './types'
export type * from './syncTypes'
export { API_BASE_URL } from '../apiBase'
