/**
 * Leaf frontend: typed databases API client (`frontend/src/lib/api/databases.ts`).
 *
 * Purpose:
 * - Wraps axios calls for `/databases/*` backend endpoints.
 * - Provides typed accessors for database metadata plus row CRUD.
 *
 * How to read:
 * - `databasesApi.list/get/create/update/delete` map to database endpoints.
 * - The “Rows” section maps to `/databases/{database_id}/rows/*`.
 *
 * Update:
 * - If you introduce new row actions, add them here and ensure the types
 *   match `frontend/src/lib/api/types.ts`.
 *
 * Debug:
 * - If row operations fail, confirm `database_id` and `row_id` are correctly passed as strings.
 * - Inspect axios request/response payloads to ensure schema/properties shapes match.
 */
import axios from 'axios'
import { API_BASE_URL } from '../apiBase'
import type { Database, DatabaseCreate, DatabaseRow, RemovePropertyResponse, RowCreate, RowUpdate } from './types'

const base = API_BASE_URL

export const databasesApi = {
  list: () =>
    axios.get<Database[]>(`${base}/databases`).then((r) => r.data),

  get: (id: string) =>
    axios.get<Database>(`${base}/databases/${id}`).then((r) => r.data),

  create: (data: DatabaseCreate) =>
    axios.post<Database>(`${base}/databases`, data).then((r) => r.data),

  update: (id: string, data: DatabaseCreate) =>
    axios.put<Database>(`${base}/databases/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    axios.delete(`${base}/databases/${id}`),

  removeProperty: (databaseId: string, propertyKey: string) =>
    axios.delete<RemovePropertyResponse>(
      `${base}/databases/${databaseId}/properties/${encodeURIComponent(propertyKey)}`,
    ).then((r) => r.data),

  /** Undo soft-delete (Cmd/Ctrl+Z in workspace). */
  restore: (id: string) =>
    axios.post<Database>(`${base}/databases/${id}/restore`).then((r) => r.data),

  // Rows
  listRows: (databaseId: string) =>
    axios.get<DatabaseRow[]>(`${base}/databases/${databaseId}/rows`).then((r) => r.data),

  createRow: (databaseId: string, data: RowCreate) =>
    axios.post<DatabaseRow>(`${base}/databases/${databaseId}/rows`, data).then((r) => r.data),

  updateRow: (databaseId: string, rowId: string, data: RowUpdate) =>
    axios.patch<DatabaseRow>(`${base}/databases/${databaseId}/rows/${rowId}`, data).then((r) => r.data),

  deleteRow: (databaseId: string, rowId: string) =>
    axios.delete(`${base}/databases/${databaseId}/rows/${rowId}`),

  reorderRows: (databaseId: string, rowIds: string[]) =>
    axios
      .post<DatabaseRow[]>(`${base}/databases/${databaseId}/rows/reorder`, { row_ids: rowIds })
      .then((r) => r.data),
}
