/**
 * Leaf frontend: typed sync API client (`frontend/src/lib/api/sync.ts`).
 *
 * Purpose:
 * - Wraps axios calls for `/sync/*` backend endpoints.
 * - Provides typed return values for sync status, config, conflicts,
 *   and actions (trigger sync, resolve conflicts).
 */
import axios from 'axios'
import { API_BASE_URL } from '../apiBase'
import type {
  SyncStatus,
  SyncConfig,
  SyncConfigUpdate,
  SyncConflict,
  ConflictResolution,
  GitStatus,
} from './syncTypes'

const base = API_BASE_URL

export const syncApi = {
  getStatus: () =>
    axios.get<SyncStatus>(`${base}/sync/status`).then(r => r.data),

  getConfig: () =>
    axios.get<SyncConfig>(`${base}/sync/config`).then(r => r.data),

  updateConfig: (data: SyncConfigUpdate) =>
    axios.put<SyncConfig>(`${base}/sync/config`, data).then(r => r.data),

  triggerSync: () =>
    axios.post<{ message: string; stats: Record<string, number> }>(`${base}/sync/trigger`).then(r => r.data),

  rebuildIndex: () =>
    axios.post<{ message: string; stats: Record<string, number> }>(`${base}/sync/rebuild-index`).then(r => r.data),

  getConflicts: () =>
    axios.get<SyncConflict[]>(`${base}/sync/conflicts`).then(r => r.data),

  resolveConflict: (id: string, resolution: ConflictResolution) =>
    axios.post<{ message: string; resolution: string }>(`${base}/sync/conflicts/${id}/resolve`, resolution).then(r => r.data),

  // Git-specific
  testGitConnection: (gitRemoteUrl?: string, gitAuthToken?: string) =>
    axios.post<{ ok: boolean; message: string }>(`${base}/sync/git/test-connection`, {
      ...(gitRemoteUrl ? { git_remote_url: gitRemoteUrl } : {}),
      ...(gitAuthToken ? { git_auth_token: gitAuthToken } : {}),
    }).then(r => r.data),

  getGitStatus: () =>
    axios.get<GitStatus>(`${base}/sync/git/status`).then(r => r.data),
}
