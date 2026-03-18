'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { leavesApi } from '@/lib/api'
import { clearPendingSave, enqueuePendingSave, getPendingSaves, isOnline } from '@/lib/leafCache'
import { saveLeafContentAndPrimeCache, saveLeafContentOffline } from '@/lib/leafMutations'

type UseLeafAutosaveArgs = {
  leafId: string
  currentContent: string
  title: string
  parentId: string | null
  databaseId: string | null
  childrenIds: string[]
  tags: string[]
  updatedAt: string | null
  setUpdatedAt: (value: string) => void
}

export function useLeafAutosave(args: UseLeafAutosaveArgs) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle')
  const latestContentRef = useRef('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    latestContentRef.current = args.currentContent
  }, [args.currentContent])

  const flushPending = useCallback(async () => {
    const pending = await getPendingSaves()
    for (const pendingSave of pending) {
      try {
        await leavesApi.patchContent(pendingSave.leafId, {
          content: pendingSave.content,
          ...(pendingSave.updated_at ? { updated_at: pendingSave.updated_at } : {}),
        })
        await clearPendingSave(pendingSave.leafId)
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 409) {
          try {
            const latest = await leavesApi.get(pendingSave.leafId)
            await leavesApi.patchContent(pendingSave.leafId, {
              content: pendingSave.content,
              updated_at: latest.updated_at,
            })
            await clearPendingSave(pendingSave.leafId)
            continue
          } catch (retryError: unknown) {
            const retryStatus = (retryError as { response?: { status?: number } })?.response?.status
            if (retryStatus === 404) {
              await clearPendingSave(pendingSave.leafId)
            }
          }
        }
        if (status === 404) {
          console.warn('[leaf:flush] clearing stale pending save (leaf gone):', pendingSave.leafId)
          await clearPendingSave(pendingSave.leafId)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (isOnline()) void flushPending()
    window.addEventListener('online', flushPending)
    return () => window.removeEventListener('online', flushPending)
  }, [flushPending])

  const doSave = useCallback(async (content: string) => {
    const snapshot = {
      title: args.title,
      parent_id: args.parentId,
      database_id: args.databaseId,
      children_ids: args.childrenIds,
      tags: args.tags,
    }

    if (!isOnline()) {
      await saveLeafContentOffline({
        leafId: args.leafId,
        content,
        updatedAt: args.updatedAt,
        snapshot,
      })
      setSaveStatus('offline')
      setTimeout(() => setSaveStatus((current) => current === 'offline' ? 'idle' : current), 2000)
      return
    }

    try {
      const updated = await saveLeafContentAndPrimeCache({
        leafId: args.leafId,
        content,
        updatedAt: args.updatedAt,
        snapshot,
      })
      args.setUpdatedAt(updated.updated_at)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((current) => current === 'saved' ? 'idle' : current), 1500)
    } catch (error: unknown) {
      console.error('[leaf:save] content patch failed', error)
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status !== 404) {
        await enqueuePendingSave(args.leafId, content, args.updatedAt)
      }
      setSaveStatus('error')
    }
  }, [args])

  const scheduleSave = useCallback((newContent: string) => {
    latestContentRef.current = newContent
    setSaveStatus('saving')
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void doSave(latestContentRef.current)
    }, 800)
  }, [doSave])

  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    void doSave(latestContentRef.current)
  }, [doSave])

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
  }, [])

  return {
    saveStatus,
    latestContentRef,
    scheduleSave,
    saveNow,
  }
}
