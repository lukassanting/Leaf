/**
 * Leaf hook: workspace route warming (`frontend/src/hooks/useWarmWorkspaceRoutes.ts`).
 *
 * Purpose:
 * - Pre-schedules loading of heavyweight client route bundles for smoother navigation.
 * - Uses `warmEditorRoute` and `warmDatabaseRoute` helpers, triggered after initial mount.
 *
 * How to read:
 * - The hook sets up two scheduled warm calls and returns cleanup functions.
 *
 * Update:
 * - To warm additional routes, add more schedule calls here.
 *
 * Debug:
 * - If warm doesn’t appear to help, verify this hook is used in the workspace home route
 *   (`frontend/src/app/(workspace)/page.tsx` or other relevant entrypoints).
 */


'use client'

import { useEffect } from 'react'
import { scheduleWarmDatabaseRoute, scheduleWarmEditorRoute } from '@/lib/warmEditorRoute'

export function useWarmWorkspaceRoutes() {
  useEffect(() => {
    const stopWarmEditor = scheduleWarmEditorRoute()
    const stopWarmDatabase = scheduleWarmDatabaseRoute()

    return () => {
      stopWarmEditor()
      stopWarmDatabase()
    }
  }, [])
}
