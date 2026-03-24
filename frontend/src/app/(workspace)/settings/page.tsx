'use client'

import { useCallback, useEffect, useState } from 'react'
import { syncApi } from '@/lib/api/sync'
import type { SyncConfig, SyncConflict, SyncMode, SyncStatus } from '@/lib/api/syncTypes'

function StatusDot({ state }: { state: SyncStatus['state'] }) {
  const color =
    state === 'watching' ? 'var(--leaf-green)' :
    state === 'syncing'  ? 'var(--leaf-yellow, #eab308)' :
    state === 'error'    ? 'var(--leaf-red, #ef4444)' :
                           'var(--leaf-text-muted)'
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: color }}
    />
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 text-sm font-semibold tracking-tight"
      style={{ color: 'var(--leaf-text-title)' }}
    >
      {children}
    </h2>
  )
}

function Divider() {
  return <hr className="my-6" style={{ borderColor: 'var(--leaf-border-soft)' }} />
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--leaf-text-body)' }}>
      {children}
    </label>
  )
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [config, setConfig] = useState<SyncConfig | null>(null)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  // Draft state for editable config
  const [draftMode, setDraftMode] = useState<SyncMode>('off')
  const [draftWatch, setDraftWatch] = useState(true)
  const [draftGitUrl, setDraftGitUrl] = useState('')
  const [draftInterval, setDraftInterval] = useState(300)

  const refresh = useCallback(async () => {
    try {
      const [s, conflictList, conf] = await Promise.all([
        syncApi.getStatus(),
        syncApi.getConflicts(),
        syncApi.getConfig(),
      ])
      setStatus(s)
      setConflicts(conflictList)
      setConfig(conf)
      setDraftMode(conf.mode)
      setDraftWatch(conf.watch_enabled)
      setDraftGitUrl(conf.git_remote_url ?? '')
      setDraftInterval(conf.git_sync_interval)
    } catch {
      // API may not have sync endpoints yet
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => { void refresh() }, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await syncApi.updateConfig({
        mode: draftMode,
        watch_enabled: draftWatch,
        git_remote_url: draftGitUrl || undefined,
        git_sync_interval: draftInterval,
      })
      setConfig(updated)
    } catch {
      // handle error
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncApi.triggerSync()
      await refresh()
    } finally {
      setSyncing(false)
    }
  }

  const handleRebuild = async () => {
    setSyncing(true)
    try {
      await syncApi.rebuildIndex()
      await refresh()
    } finally {
      setSyncing(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await syncApi.testGitConnection()
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, message: 'Failed to reach API' })
    } finally {
      setTesting(false)
    }
  }

  const handleResolve = async (conflictId: string, keep: 'local' | 'remote' | 'both') => {
    try {
      await syncApi.resolveConflict(conflictId, { keep })
      await refresh()
    } catch {
      // handle error
    }
  }

  const modeOptions: { value: SyncMode; label: string; desc: string }[] = [
    { value: 'off', label: 'Off', desc: 'Local only, no sync' },
    { value: 'folder', label: 'Folder Sync', desc: 'Point DATA_DIR at a cloud-synced folder (Google Drive, Dropbox, OneDrive)' },
    { value: 'git', label: 'Git Sync', desc: 'Auto-commit and push to a Git remote' },
  ]

  const intervalOptions = [
    { value: 60, label: '1 minute' },
    { value: 120, label: '2 minutes' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 1800, label: '30 minutes' },
  ]

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-10">
      <h1
        className="mb-1 text-xl font-semibold tracking-tight"
        style={{ color: 'var(--leaf-text-title)' }}
      >
        Settings
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--leaf-text-muted)' }}>
        Configure sync and other workspace preferences.
      </p>

      {/* ─── Sync Configuration ─────────────────────────────────────── */}
      <SectionTitle>Sync Mode</SectionTitle>
      <div className="flex flex-col gap-2">
        {modeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDraftMode(opt.value)}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
            style={{
              background: draftMode === opt.value
                ? 'color-mix(in srgb, var(--leaf-green) 8%, transparent)'
                : 'transparent',
              border: `1px solid ${draftMode === opt.value ? 'color-mix(in srgb, var(--leaf-green) 30%, transparent)' : 'var(--leaf-border-soft)'}`,
            }}
          >
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: draftMode === opt.value ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
              }}
            >
              {draftMode === opt.value && (
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: 'var(--leaf-green)' }}
                />
              )}
            </span>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--leaf-text-body)' }}>
                {opt.label}
              </div>
              <div className="text-xs" style={{ color: 'var(--leaf-text-muted)' }}>
                {opt.desc}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Data directory (read-only) */}
      {config && (
        <div className="mt-4">
          <Label>Data Directory</Label>
          <div
            className="rounded-md px-3 py-2 text-xs font-mono"
            style={{
              background: 'var(--leaf-bg-elevated)',
              color: 'var(--leaf-text-muted)',
              border: '1px solid var(--leaf-border-soft)',
            }}
          >
            {config.data_dir}
          </div>
        </div>
      )}

      {/* File watcher toggle */}
      <div className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          id="watch-enabled"
          checked={draftWatch}
          onChange={(e) => setDraftWatch(e.target.checked)}
          className="accent-[var(--leaf-green)]"
        />
        <label htmlFor="watch-enabled" className="text-sm" style={{ color: 'var(--leaf-text-body)' }}>
          Watch for external file changes
        </label>
      </div>

      {/* Git-specific config */}
      {draftMode === 'git' && (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <Label>Git Remote URL</Label>
            <div className="flex gap-2">
              <input
                type="text"
                value={draftGitUrl}
                onChange={(e) => { setDraftGitUrl(e.target.value); setTestResult(null) }}
                placeholder="https://github.com/user/leaf-data.git"
                className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--leaf-bg-elevated)',
                  color: 'var(--leaf-text-body)',
                  border: '1px solid var(--leaf-border-soft)',
                }}
              />
              <button
                type="button"
                onClick={() => { void handleTestConnection() }}
                disabled={testing || !draftGitUrl}
                className="shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  background: 'var(--leaf-bg-elevated)',
                  color: 'var(--leaf-text-body)',
                  border: '1px solid var(--leaf-border-soft)',
                  opacity: testing || !draftGitUrl ? 0.5 : 1,
                }}
              >
                {testing ? 'Testing…' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div
                className="mt-1.5 rounded-md px-3 py-1.5 text-xs"
                style={{
                  background: testResult.ok
                    ? 'color-mix(in srgb, var(--leaf-green) 8%, transparent)'
                    : 'color-mix(in srgb, var(--leaf-red, #ef4444) 8%, transparent)',
                  color: testResult.ok ? 'var(--leaf-green)' : 'var(--leaf-red, #ef4444)',
                  border: `1px solid ${testResult.ok
                    ? 'color-mix(in srgb, var(--leaf-green) 25%, transparent)'
                    : 'color-mix(in srgb, var(--leaf-red, #ef4444) 25%, transparent)'}`,
                }}
              >
                {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
              </div>
            )}
            <p className="mt-1 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
              For private repos, use a URL with a Personal Access Token: https://TOKEN@github.com/user/repo.git
            </p>
          </div>
          <div>
            <Label>Sync Interval</Label>
            <select
              value={draftInterval}
              onChange={(e) => setDraftInterval(Number(e.target.value))}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--leaf-bg-elevated)',
                color: 'var(--leaf-text-body)',
                border: '1px solid var(--leaf-border-soft)',
              }}
            >
              {intervalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Git status panel */}
          {status?.git && (
            <div
              className="rounded-lg p-3 mt-1"
              style={{
                background: 'var(--leaf-bg-elevated)',
                border: '1px solid var(--leaf-border-soft)',
              }}
            >
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--leaf-text-body)' }}>
                Git Repository
              </div>
              <div className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
                <span>Branch: <strong style={{ color: 'var(--leaf-text-body)' }}>{status.git.branch}</strong></span>
                {status.git.remote_url && <span>Remote: {status.git.remote_url}</span>}
                {status.git.last_commit && <span>Last commit: {status.git.last_commit}</span>}
                {status.git.has_uncommitted && (
                  <span style={{ color: 'var(--leaf-yellow, #eab308)' }}>Uncommitted local changes</span>
                )}
                {status.git.last_error && (
                  <span style={{ color: 'var(--leaf-red, #ef4444)' }}>Error: {status.git.last_error}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => { void handleSave() }}
          disabled={saving}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: 'var(--leaf-green)',
            color: 'var(--leaf-on-accent)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>

      <Divider />

      {/* ─── Sync Status ───────────────────────────────────────────── */}
      <SectionTitle>Sync Status</SectionTitle>
      {status ? (
        <div
          className="rounded-lg p-4"
          style={{
            background: 'var(--leaf-bg-elevated)',
            border: '1px solid var(--leaf-border-soft)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <StatusDot state={status.state} />
            <span className="text-sm font-medium" style={{ color: 'var(--leaf-text-body)' }}>
              {status.state === 'watching' ? 'Watching for changes' :
               status.state === 'syncing' ? 'Syncing…' :
               status.state === 'error' ? 'Sync error' :
               'Idle'}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--leaf-text-muted)' }}>
            <span>Last synced: {status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : 'Never'}</span>
            <span>Pending changes: {status.pending_changes}</span>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { void handleSync() }}
              disabled={syncing}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--leaf-green) 10%, transparent)',
                color: 'var(--leaf-green)',
                border: '1px solid color-mix(in srgb, var(--leaf-green) 25%, transparent)',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            <button
              type="button"
              onClick={() => { void handleRebuild() }}
              disabled={syncing}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'var(--leaf-bg-elevated)',
                color: 'var(--leaf-text-body)',
                border: '1px solid var(--leaf-border-soft)',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              Rebuild Index from Files
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--leaf-text-muted)' }}>Loading…</p>
      )}

      {/* ─── Conflicts ─────────────────────────────────────────────── */}
      {conflicts.length > 0 && (
        <>
          <Divider />
          <SectionTitle>Conflicts ({conflicts.length})</SectionTitle>
          <div className="flex flex-col gap-3">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="rounded-lg p-4"
                style={{
                  background: 'var(--leaf-bg-elevated)',
                  border: '1px solid color-mix(in srgb, var(--leaf-yellow, #eab308) 30%, var(--leaf-border-soft))',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--leaf-yellow, #eab308)' }}>
                    <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M8 7V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
                  </svg>
                  <span className="text-sm font-medium" style={{ color: 'var(--leaf-text-body)' }}>
                    {c.conflict_type === 'cloud_duplicate' ? 'Cloud duplicate detected' : 'Content conflict'}
                  </span>
                </div>
                <div className="mb-2 text-xs font-mono" style={{ color: 'var(--leaf-text-muted)' }}>
                  {c.file_path}
                </div>
                {c.local_title && (
                  <div className="text-xs" style={{ color: 'var(--leaf-text-muted)' }}>
                    Local: &quot;{c.local_title}&quot;
                    {c.local_updated_at && ` (${new Date(c.local_updated_at).toLocaleString()})`}
                  </div>
                )}
                {c.remote_title && (
                  <div className="text-xs mb-2" style={{ color: 'var(--leaf-text-muted)' }}>
                    Remote: &quot;{c.remote_title}&quot;
                    {c.remote_updated_at && ` (${new Date(c.remote_updated_at).toLocaleString()})`}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  {(['local', 'remote', 'both'] as const).map((keep) => (
                    <button
                      key={keep}
                      type="button"
                      onClick={() => { void handleResolve(c.id, keep) }}
                      className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: 'var(--leaf-bg-elevated)',
                        color: 'var(--leaf-text-body)',
                        border: '1px solid var(--leaf-border-soft)',
                      }}
                    >
                      Keep {keep.charAt(0).toUpperCase() + keep.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
