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
