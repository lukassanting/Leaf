/**
 * Leaf frontend: typed leaves API client (`frontend/src/lib/api/leaves.ts`).
 *
 * Purpose:
 * - Wraps axios calls for `/leaves/*` backend endpoints.
 * - Provides typed return values for leaves, tree items, graph data, and
 *   request payloads for create/update/content patch/reorder/delete.
 *
 * How to read:
 * - `leavesApi` is a small object of functions mapping 1:1 to backend routes.
 * - Each function uses `API_BASE_URL` and returns `r.data` (typed via axios generics).
 *
 * Update:
 * - When you add/rename backend endpoints, update this module accordingly.
 * - Keep `LeafContentUpdate` / `LeafReorderChildren` in sync with DTOs in `lib/api/types.ts`.
 *
 * Debug:
 * - If a call fails, inspect:
 *   - URL path (e.g. `/leaves/${id}/content`)
 *   - request body shape expected by backend DTO
 *   - CORS/network errors which typically surface as axios errors.
 */
import axios from 'axios'
import { API_BASE_URL } from '../apiBase'
import type { Leaf, LeafGraph, LeafTreeItem, LeafCreate, LeafContentUpdate, LeafReorderChildren } from './types'

const base = API_BASE_URL

export const leavesApi = {
  getTree: (opts?: { includeDbRows?: boolean }) =>
    axios.get<LeafTreeItem[]>(`${base}/leaves/tree`, {
      params: opts?.includeDbRows ? { include_db_rows: true } : undefined,
    }).then((r) => r.data),

  get: (id: string) =>
    axios.get<Leaf>(`${base}/leaves/${id}`).then((r) => r.data),

  create: (data: LeafCreate) =>
    axios.post<Leaf>(`${base}/leaves`, data).then((r) => r.data),

  update: (id: string, data: LeafCreate) =>
    axios.put<Leaf>(`${base}/leaves/${id}`, data).then((r) => r.data),

  patchContent: (id: string, data: LeafContentUpdate) =>
    axios.patch<Leaf>(`${base}/leaves/${id}/content`, data).then((r) => r.data),

  reorderChildren: (id: string, data: LeafReorderChildren) =>
    axios.put<Leaf>(`${base}/leaves/${id}/reorder-children`, data).then((r) => r.data),

  delete: (id: string) =>
    axios.delete(`${base}/leaves/${id}`),

  restore: (id: string) =>
    axios.post<Leaf>(`${base}/leaves/${id}/restore`).then((r) => r.data),

  getBacklinks: (id: string) =>
    axios.get<LeafTreeItem[]>(`${base}/leaves/${id}/backlinks`).then((r) => r.data),

  getGraph: () =>
    axios.get<LeafGraph>(`${base}/leaves/graph`).then((r) => r.data),
}
