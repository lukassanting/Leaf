/**
 * Leaf hook: database page state/actions (`frontend/src/hooks/useDatabasePage.ts`).
 *
 * Purpose:
 * - Owns the state for `/databases/[id]`:
 *   - database metadata drafts (title/description/tags/icon)
 *   - rows + columns derived from schema
 *   - row/cell actions (add/delete/update)
 *   - view-type changes and debounced title saving
 *
 * How to read:
 * - `useEffect(... [id])` loads `databasesApi.get(id)` and `databasesApi.listRows(id)`.
 * - `saveDatabase(patch)` delegates to `updateDatabaseAndEmitTitle`.
 * - Local actions (`addRow`, `deleteRow`, `updateName`, `updateCell`, `addColumn`)
 *   call the appropriate mutation helpers from `lib/databaseMutations.ts` or `databasesApi`.
 *
 * Update:
 * - If you add new database metadata fields, keep drafts in state and expand `saveDatabase(...)`.
 * - For schema changes, add to `PropertyDefinition` / `DatabaseSchema` and update `updateCell` parsing.
 *
 * Debug:
 * - If row edits don’t persist:
 *   - verify `updateCell` parses typed columns correctly
 *   - inspect `databasesApi.updateRow` response handling
 * - If the page gets stuck loading, check the `finally(() => setLoading(false))` block.
 */


'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { databasesApi } from '@/lib/api'
import type { Database, DatabaseRow, LeafIcon, PropertyDefinition, ViewType } from '@/lib/api'
import {
  createDatabaseRow,
  updateDatabaseAndEmitTitle,
  updateDatabaseRowTitle,
  updateDatabaseViewType,
} from '@/lib/databaseMutations'
import { useDatabaseBreadcrumbs } from './useDatabaseBreadcrumbs'

export function useDatabasePage(id: string) {
  const [db, setDb] = useState<Database | null>(null)
  const [rows, setRows] = useState<DatabaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCol, setShowAddCol] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [tagsDraft, setTagsDraft] = useState<string[]>([])
  const [iconDraft, setIconDraft] = useState<LeafIcon | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const savedTitleRef = useRef('')
  const hasLoadedTitleRef = useRef(false)
  const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return

    Promise.all([databasesApi.get(id), databasesApi.listRows(id)])
      .then(([database, rowItems]) => {
        setDb(database)
        setTitleDraft(database.title)
        setDescriptionDraft(database.description ?? '')
        setTagsDraft(database.tags ?? [])
        setIconDraft(database.icon ?? null)
        savedTitleRef.current = database.title
        hasLoadedTitleRef.current = false
        setRows(rowItems)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const saveDatabase = useCallback(async (patch: Partial<Database>) => {
    if (!db) return null
    const updated = await updateDatabaseAndEmitTitle(id, {
      title: patch.title ?? db.title,
      description: patch.description ?? db.description ?? null,
      tags: patch.tags ?? db.tags ?? [],
      icon: patch.icon ?? db.icon ?? null,
      schema: patch.schema ?? db.schema,
      view_type: patch.view_type ?? db.view_type,
      parent_leaf_id: patch.parent_leaf_id ?? db.parent_leaf_id ?? undefined,
    })
    setDb(updated)
    return updated
  }, [db, id])

  const saveTitle = useCallback(async (value: string) => {
    const trimmed = value.trim() || 'Untitled database'
    if (trimmed === savedTitleRef.current || !db) {
      setSaveStatus('idle')
      return
    }
    try {
      const updated = await saveDatabase({ title: trimmed })
      if (!updated) return
      setDb(updated)
      setTitleDraft(updated.title)
      savedTitleRef.current = updated.title
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((current) => current === 'saved' ? 'idle' : current), 1200)
    } catch {
      setSaveStatus('error')
      console.error('Failed to save title')
    }
  }, [db, saveDatabase])

  useEffect(() => {
    if (!db) return
    if (!hasLoadedTitleRef.current) {
      hasLoadedTitleRef.current = true
      return
    }
    if (titleDraft.trim() === savedTitleRef.current) return

    setSaveStatus('saving')
    if (titleSaveTimeoutRef.current) clearTimeout(titleSaveTimeoutRef.current)
    titleSaveTimeoutRef.current = setTimeout(() => {
      void saveTitle(titleDraft)
    }, 500)

    return () => {
      if (titleSaveTimeoutRef.current) clearTimeout(titleSaveTimeoutRef.current)
    }
  }, [titleDraft, db, saveTitle])

  const flushTitleSave = useCallback(() => {
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current)
      titleSaveTimeoutRef.current = null
    }
    void saveTitle(titleDraft)
  }, [saveTitle, titleDraft])

  const setViewType = useCallback(async (viewType: ViewType) => {
    if (!db) return
    try {
      const updated = await updateDatabaseViewType(id, {
        title: db.title,
        description: db.description ?? null,
        tags: db.tags ?? [],
        icon: db.icon ?? null,
        schema: db.schema,
        parent_leaf_id: db.parent_leaf_id ?? undefined,
      }, viewType)
      setDb(updated)
    } catch {
      console.error('Failed to save view type')
    }
  }, [db, id])

  const columns: PropertyDefinition[] = useMemo(() => db?.schema?.properties ?? [], [db])

  const addRow = useCallback(async () => {
    try {
      const row = await createDatabaseRow(id)
      setRows((prev) => [...prev, row])
    } catch (error) {
      console.error(error)
    }
  }, [id])

  const deleteRow = useCallback(async (rowId: string) => {
    if (!confirm('Delete this entry and its page?')) return
    try {
      await databasesApi.deleteRow(id, rowId)
      setRows((prev) => prev.filter((row) => row.id !== rowId))
    } catch (error) {
      console.error(error)
    }
  }, [id])

  const updateName = useCallback(async (rowId: string, title: string) => {
    const row = rows.find((item) => item.id === rowId)
    if (!row) return
    try {
      await updateDatabaseRowTitle(row, id, title)
      setRows((prev) => prev.map((item) => item.id === rowId ? { ...item, leaf_title: title } : item))
    } catch (error) {
      console.error(error)
    }
  }, [rows, id])

  const updateCell = useCallback(async (rowId: string, key: string, value: string) => {
    const row = rows.find((item) => item.id === rowId)
    if (!row) return
    const column = columns.find((item) => item.key === key)
    const parsedValue: unknown = column?.type === 'tags'
      ? value.split(',').map((tag) => tag.trim()).filter(Boolean)
      : value
    const updated = await databasesApi.updateRow(id, rowId, {
      properties: { ...row.properties, [key]: parsedValue },
    })
    setRows((prev) => prev.map((item) => (item.id === rowId ? updated : item)))
  }, [id, rows, columns])

  const addColumn = useCallback(async (definition: PropertyDefinition) => {
    if (!db) return
    const newSchema = { properties: [...(db.schema?.properties ?? []), definition] }
    try {
      const updated = await databasesApi.update(id, {
        title: db.title,
        description: db.description ?? null,
        tags: db.tags ?? [],
        icon: db.icon ?? null,
        schema: newSchema,
        view_type: db.view_type,
        parent_leaf_id: db.parent_leaf_id ?? undefined,
      })
      setDb(updated)
      setShowAddCol(false)
    } catch (error) {
      console.error(error)
    }
  }, [db, id])

  const breadcrumbs = useDatabaseBreadcrumbs(db?.parent_leaf_id)
  const activeView = db?.view_type === 'list' ? 'board' : (db?.view_type || 'table')

  return {
    db,
    rows,
    loading,
    showAddCol,
    setShowAddCol,
    titleDraft,
    setTitleDraft,
    descriptionDraft,
    setDescriptionDraft,
    tagsDraft,
    setTagsDraft,
    iconDraft,
    setIconDraft,
    saveStatus,
    flushTitleSave,
    saveDatabase,
    breadcrumbs,
    columns,
    activeView,
    addRow,
    deleteRow,
    updateName,
    updateCell,
    addColumn,
    setViewType,
  }
}
