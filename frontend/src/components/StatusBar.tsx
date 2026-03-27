'use client'

import { useCallback, useEffect, useState } from 'react'
import { syncApi } from '@/lib/api/sync'
import { emitLeafTreeChanged } from '@/lib/appEvents'
import type { SyncStatus } from '@/lib/api/syncTypes'

function formatTimeAgo(isoString: string): string {
  const utcString = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  const diff = Date.now() - new Date(utcString).getTime()
  const secs = Math.floor(diff / 1_000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type Props = {
  saveStatus: string
  wordCount: number
  modeLabel?: string
}

export function StatusBar({ saveStatus, wordCount, modeLabel }: Props) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const fetch = () => { syncApi.getStatus().then(setSyncStatus).catch(() => {}) }
    fetch()
    const id = setInterval(fetch, 10_000)
    return () => clearInterval(id)
  }, [])

  // Tick every 5s to keep "time ago" fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const handleSyncClick = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await syncApi.triggerSync()
      const updated = await syncApi.getStatus()
      setSyncStatus(updated)
      emitLeafTreeChanged()
    } catch { /* status poll will pick up errors */ } finally {
      setSyncing(false)
    }
  }, [syncing])

  // Save status
  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Saved' :
    saveStatus === 'error' ? 'Error' :
    saveStatus === 'offline' ? 'Offline' : 'Saved'

  const saveDotColor =
    saveStatus === 'error' ? '#dc2626' :
    saveStatus === 'saving' ? 'var(--leaf-text-muted)' :
    saveStatus === 'offline' ? '#d97706' : 'var(--leaf-green)'

  // Git sync status
  const isSyncOn = syncStatus && syncStatus.mode !== 'off'
  const isSyncingNow = syncing || syncStatus?.state === 'syncing'
  const hasGitError = syncStatus?.git?.last_error

  let syncLabel = ''
  let syncDotColor = 'var(--leaf-text-muted)'
  if (isSyncOn) {
    if (isSyncingNow) {
      syncLabel = 'Syncing…'
      syncDotColor = 'var(--leaf-yellow, #eab308)'
    } else if (hasGitError) {
      syncLabel = 'Sync error'
      syncDotColor = 'var(--leaf-red, #ef4444)'
    } else if (syncStatus.mode === 'git' && syncStatus.git?.last_sync_at) {
      syncLabel = `Git synced ${formatTimeAgo(syncStatus.git.last_sync_at)}`
      syncDotColor = 'var(--leaf-green)'
    } else if (syncStatus.last_sync_at) {
      syncLabel = `Synced ${formatTimeAgo(syncStatus.last_sync_at)}`
      syncDotColor = 'var(--leaf-green)'
    } else {
      syncLabel = syncStatus.mode === 'git' ? 'Git sync' : 'Sync idle'
    }
  }

  const readingTime = wordCount > 1000
    ? `~${Math.ceil(wordCount / 200)} min read`
    : `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        height: 28,
        padding: '0 20px',
        background: 'var(--leaf-bg-app)',
        borderTop: '1px solid var(--leaf-border-soft)',
      }}
    >
      <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--leaf-text-muted)' }}>
        <span className="flex items-center gap-1.5" data-testid="status-save-label">
          {/* Dot only for non-idle save states so the footer has a single sync dot (right). */}
          {(saveStatus === 'saving' || saveStatus === 'error' || saveStatus === 'offline') && (
            <span
              className="rounded-full shrink-0"
              style={{ width: 5, height: 5, backgroundColor: saveDotColor }}
            />
          )}
          <span
            style={
              saveStatus === 'error'
                ? { color: '#dc2626' }
                : saveStatus === 'offline'
                  ? { color: '#d97706' }
                  : undefined
            }
          >
            {saveLabel}
          </span>
        </span>
        {wordCount > 0 && (
          <span>{readingTime}</span>
        )}
      </div>

      <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--leaf-text-muted)' }}>
        {modeLabel && <span>{modeLabel}</span>}
        {isSyncOn && (
          <button
            type="button"
            onClick={handleSyncClick}
            disabled={syncing}
            className="flex items-center gap-1.5 border-none bg-transparent cursor-pointer"
            style={{ fontSize: 11, color: 'var(--leaf-text-muted)', padding: 0 }}
            title="Click to sync now"
          >
            <span
              className="rounded-full"
              style={{
                width: 5,
                height: 5,
                backgroundColor: syncDotColor,
                boxShadow: isSyncingNow ? `0 0 6px ${syncDotColor}` : 'none',
              }}
            />
            {syncLabel}
          </button>
        )}
      </div>
    </div>
  )
}
