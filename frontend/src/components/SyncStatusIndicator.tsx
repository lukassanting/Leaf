'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { syncApi } from '@/lib/api/sync'
import type { SyncStatus } from '@/lib/api/syncTypes'

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null)

  useEffect(() => {
    const fetch = () => {
      syncApi.getStatus().then(setStatus).catch(() => {})
    }
    fetch()
    const id = setInterval(fetch, 10_000)
    return () => clearInterval(id)
  }, [])

  // Don't render if sync is off or we haven't loaded yet
  if (!status || status.mode === 'off') return null

  // Derive color and label from state + git info
  const hasGitError = status.git?.last_error
  const effectiveState = hasGitError ? 'error' : status.state

  const dotColor =
    effectiveState === 'watching' ? 'var(--leaf-green)' :
    effectiveState === 'syncing'  ? 'var(--leaf-yellow, #eab308)' :
    effectiveState === 'error'    ? 'var(--leaf-red, #ef4444)' :
                                    'var(--leaf-text-muted)'

  let label: string
  if (effectiveState === 'error') {
    label = 'Sync error'
  } else if (effectiveState === 'syncing') {
    label = 'Syncing…'
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
    <Link
      href="/settings"
      className="flex items-center gap-2 px-3 py-1.5 no-underline transition-colors"
      style={{ color: 'var(--leaf-text-muted)' }}
      title="Sync settings"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          background: dotColor,
          boxShadow: status.state === 'syncing' ? `0 0 6px ${dotColor}` : 'none',
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
    </Link>
  )
}
