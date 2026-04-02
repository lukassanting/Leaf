/**
 * Leaf frontend: sync API types (`frontend/src/lib/api/syncTypes.ts`).
 *
 * Purpose:
 * - TypeScript interfaces mirroring the backend sync DTOs.
 */

export type SyncMode = 'off' | 'folder' | 'git'
export type SyncState = 'idle' | 'watching' | 'syncing' | 'error'
export type ConflictType = 'content' | 'deleted_locally' | 'deleted_remotely' | 'cloud_duplicate'

export interface SyncError {
  id: string
  timestamp: string
  message: string
  file_path?: string | null
}

export interface GitStatus {
  initialized: boolean
  configured: boolean
  syncing: boolean
  last_sync_at?: string | null
  last_error?: string | null
  remote_url?: string | null
  branch: string
  last_commit?: string | null
  has_uncommitted: boolean
}

export interface SyncStatus {
  mode: SyncMode
  state: SyncState
  last_sync_at?: string | null
  pending_changes: number
  conflicts_count: number
  errors: SyncError[]
  git?: GitStatus | null
}

export interface SyncConfig {
  mode: SyncMode
  data_dir: string
  watch_enabled: boolean
  git_remote_url?: string | null
  git_sync_interval: number
}

export interface SyncConfigUpdate {
  mode?: SyncMode
  data_dir?: string
  watch_enabled?: boolean
  git_remote_url?: string | null
  git_auth_token?: string | null
  git_sync_interval?: number
}

export interface SyncConflict {
  id: string
  file_path: string
  local_updated_at?: string | null
  remote_updated_at?: string | null
  conflict_type: ConflictType
  local_title?: string | null
  remote_title?: string | null
  local_preview?: string | null
  remote_preview?: string | null
  detected_at: string
}

export interface ConflictResolution {
  keep: 'local' | 'remote' | 'both'
}
