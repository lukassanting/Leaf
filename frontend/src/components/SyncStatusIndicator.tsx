'use client'

import { useCallback, useEffect, useState } from 'react'
import { syncApi } from '@/lib/api/sync'
import type { SyncStatus } from '@/lib/api/syncTypes'

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const secs = Math.floor(diff / 1_000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [, setTick] = useState(0)       // forces re-render for "time ago"
  const [syncing, setSyncing] = useState(false)

  // Fetch status from API every 10s
  useEffect(() => {
    const fetchStatus = () => {
      syncApi.getStatus().then(setStatus).catch(() => {})
    }
    fetchStatus()
    const id = setInterval(fetchStatus, 10_000)
    return () => clearInterval(id)
  }, [])

  // Lightweight tick every 5s to keep "time ago" label fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  // Click to sync now
  const handleClick = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await syncApi.triggerSync()
      // Refresh status after sync completes
      const updated = await syncApi.getStatus()
      setStatus(updated)
    } catch {
      // silently ignore — status poll will pick up errors
    } finally {
      setSyncing(false)
    }
  }, [syncing])

  // Don't render if sync is off or we haven't loaded yet
  if (!status || status.mode === 'off') return null

  // Derive color and label from state + git info
  const hasGitError = status.git?.last_error
  const isSyncingNow = syncing || status.state === 'syncing'
  const effectiveState = hasGitError ? 'error' : isSyncingNow ? 'syncing' : status.state

  const dotColor =
    effectiveState === 'watching' ? 'var(--leaf-green)' :
    effectiveState === 'syncing'  ? 'var(--leaf-yellow, #eab308)' :
    effectiveState === 'error'    ? 'var(--leaf-red, #ef4444)' :
                                    'var(--leaf-text-muted)'

  let label: string
  if (isSyncingNow) {
    label = 'Syncing…'
  } else if (effectiveState === 'error') {
    label = 'Sync error'
  } else if (status.mode === 'git' && status.git?.last_sync_at) {
    label = `Git synced ${formatTimeAgo(status.git.last_sync_at)}`
  } else if (status.last_sync_at) {
    label = `Synced ${formatTimeAgo(status.last_sync_at)}`
  } else if (effectiveState === 'watching') {
    label = 'Watching'
  } else {
    label = status.mode === 'git' ? 'Git sync' : 'Sync idle'
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-1.5 w-full transition-colors cursor-pointer border-none bg-transparent text-left"
      style={{ color: 'var(--leaf-text-muted)' }}
      title="Click to sync now"
      disabled={syncing}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          background: dotColor,
          boxShadow: isSyncingNow ? `0 0 6px ${dotColor}` : 'none',
        }}
      />
      <span style={{ fontSize: 11 }}>{label}</span>
      {status.conflicts_count > 0 && (
        <span
          className="ml-auto rounded-full px-1.5 text-[10px] font-medium"
          style={{
            background: 'color-mix(in srgb, var(--leaf-yellow, #eab308) 15%, transparent)',
            color: 'var(--leaf-yellow, #eab308)',
          }}
        >
          {status.conflicts_count}
        </span>
      )}
    </button>
  )
}
