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
import { useRouter } from 'next/navigation'
import { databasesApi } from '@/lib/api'
import type { Database, DatabaseRow, GallerySize, LeafIcon, PropertyDefinition, PropertyOption, ViewType } from '@/lib/api'
import type { OptionColumnActions } from '@/components/database/optionPickers'
import {
  createDatabaseRow,
  updateDatabaseAndEmitTitle,
  updateDatabaseRowTitle,
  updateDatabaseViewType,
} from '@/lib/databaseMutations'
import { useDatabaseBreadcrumbs } from './useDatabaseBreadcrumbs'

function parseTagValuesLocal(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string' && value) {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  }
  return []
}

export function useDatabasePage(id: string) {
  const router = useRouter()
  const [db, setDb] = useState<Database | null>(null)
  const [rows, setRows] = useState<DatabaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCol, setShowAddCol] = useState(false)
  const [gallerySize, setGallerySizeState] = useState<GallerySize>('medium')
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

  useEffect(() => {
    if (typeof window === 'undefined' || !id) return
    try {
      const raw = localStorage.getItem(`leaf-db-gallery-size:${id}`)
      if (raw === 'small' || raw === 'medium' || raw === 'large') setGallerySizeState(raw)
    } catch {
      /* ignore */
    }
  }, [id])

  const setGallerySize = useCallback((size: GallerySize) => {
    setGallerySizeState(size)
    try {
      localStorage.setItem(`leaf-db-gallery-size:${id}`, size)
    } catch {
      /* ignore */
    }
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
    let parsedValue: unknown = value
    if (column?.type === 'tags') {
      parsedValue = value.split(',').map((tag) => tag.trim()).filter(Boolean)
    } else if (column?.type === 'number') {
      const t = value.trim()
      parsedValue = t === '' ? null : Number(t)
    } else if (column?.type === 'date') {
      parsedValue = value.trim() === '' ? null : value.trim()
    }
    const updated = await databasesApi.updateRow(id, rowId, {
      properties: { ...row.properties, [key]: parsedValue },
    })
    setRows((prev) => prev.map((item) => (item.id === rowId ? updated : item)))
  }, [id, rows, columns])

  const updateCellValue = useCallback(async (rowId: string, key: string, parsedValue: unknown) => {
    const row = rows.find((item) => item.id === rowId)
    if (!row) return
    const updated = await databasesApi.updateRow(id, rowId, {
      properties: { ...row.properties, [key]: parsedValue },
    })
    setRows((prev) => prev.map((item) => (item.id === rowId ? updated : item)))
  }, [id, rows])

  const setColumnOptions = useCallback(async (columnKey: string, options: PropertyOption[]) => {
    if (!db) return
    const nextSchema = {
      properties: db.schema.properties.map((c) => (c.key === columnKey ? { ...c, options } : c)),
    }
    try {
      const updated = await saveDatabase({ schema: nextSchema })
      if (updated) setDb(updated)
    } catch (error) {
      console.error(error)
    }
  }, [db, saveDatabase])

  const renameColumnOption = useCallback(async (columnKey: string, optionId: string, newLabel: string) => {
    if (!db) return
    const col = db.schema.properties.find((c) => c.key === columnKey)
    if (!col?.options) return
    const opt = col.options.find((o) => o.id === optionId)
    if (!opt) return
    const trimmed = newLabel.trim()
    if (!trimmed || trimmed === opt.label) return
    const oldLabel = opt.label
    const nextOpts = col.options.map((o) => (o.id === optionId ? { ...o, label: trimmed } : o))
    const nextSchema = {
      properties: db.schema.properties.map((c) => (c.key === columnKey ? { ...c, options: nextOpts } : c)),
    }

    let nextRows = rows
    for (const row of rows) {
      const v = (row.properties || {})[columnKey]
      if (col.type === 'tags') {
        const arr = parseTagValuesLocal(v)
        if (!arr.includes(oldLabel)) continue
        const nextArr = arr.map((t) => (t === oldLabel ? trimmed : t))
        const updated = await databasesApi.updateRow(id, row.id, {
          properties: { ...row.properties, [columnKey]: nextArr },
        })
        nextRows = nextRows.map((r) => (r.id === row.id ? updated : r))
      } else if (col.type === 'select' && String(v ?? '') === oldLabel) {
        const updated = await databasesApi.updateRow(id, row.id, {
          properties: { ...row.properties, [columnKey]: trimmed },
        })
        nextRows = nextRows.map((r) => (r.id === row.id ? updated : r))
      }
    }
    setRows(nextRows)
    try {
      const updated = await saveDatabase({ schema: nextSchema })
      if (updated) setDb(updated)
    } catch (error) {
      console.error(error)
    }
  }, [db, id, rows, saveDatabase])

  const deleteColumnOption = useCallback(async (columnKey: string, optionId: string) => {
    if (!db) return
    const col = db.schema.properties.find((c) => c.key === columnKey)
    if (!col?.options) return
    const opt = col.options.find((o) => o.id === optionId)
    if (!opt) return
    const label = opt.label
    const nextOpts = col.options.filter((o) => o.id !== optionId)
    const nextSchema = {
      properties: db.schema.properties.map((c) => (c.key === columnKey ? { ...c, options: nextOpts } : c)),
    }

    let nextRows = rows
    for (const row of rows) {
      const v = (row.properties || {})[columnKey]
      if (col.type === 'tags') {
        const arr = parseTagValuesLocal(v)
        if (!arr.includes(label)) continue
        const nextArr = arr.filter((t) => t !== label)
        const updated = await databasesApi.updateRow(id, row.id, {
          properties: { ...row.properties, [columnKey]: nextArr },
        })
        nextRows = nextRows.map((r) => (r.id === row.id ? updated : r))
      } else if (col.type === 'select' && String(v ?? '') === label) {
        const updated = await databasesApi.updateRow(id, row.id, {
          properties: { ...row.properties, [columnKey]: null },
        })
        nextRows = nextRows.map((r) => (r.id === row.id ? updated : r))
      }
    }
    setRows(nextRows)
    try {
      const updated = await saveDatabase({ schema: nextSchema })
      if (updated) setDb(updated)
    } catch (error) {
      console.error(error)
    }
  }, [db, id, rows, saveDatabase])

  const optionColumnActions: OptionColumnActions = useMemo(
    () => ({
      setColumnOptions: (columnKey, options) => setColumnOptions(columnKey, options),
      renameColumnOption: (columnKey, optionId, newLabel) => renameColumnOption(columnKey, optionId, newLabel),
      deleteColumnOption: (columnKey, optionId) => deleteColumnOption(columnKey, optionId),
      updateCellValue: (rowId, columnKey, value) => updateCellValue(rowId, columnKey, value),
    }),
    [setColumnOptions, renameColumnOption, deleteColumnOption, updateCellValue],
  )

  const saveColumnDefinition = useCallback(async (
    key: string,
    patch: { label: string; type: PropertyDefinition['type']; wrap?: boolean },
  ) => {
    if (!db) return
    const label = patch.label.trim()
    const next = db.schema.properties.map((c) =>
      c.key === key
        ? {
            ...c,
            label: label || c.label,
            type: patch.type,
            ...(patch.wrap !== undefined ? { wrap: patch.wrap } : {}),
          }
        : c,
    )
    try {
      const updated = await saveDatabase({ schema: { properties: next } })
      if (updated) setDb(updated)
    } catch (error) {
      console.error(error)
    }
  }, [db, saveDatabase])

  const deleteColumn = useCallback(async (key: string) => {
    if (!db) return
    const col = db.schema.properties.find((c) => c.key === key)
    const label = col?.label ?? key
    if (!confirm(`Delete property "${label}"? Values in this column will be removed from all rows.`)) return
    try {
      const { database: nextDb, rows: nextRows } = await databasesApi.removeProperty(id, key)
      setDb(nextDb)
      setRows(nextRows)
    } catch (error) {
      console.error(error)
    }
  }, [db, id])

  const deleteDatabase = useCallback(async () => {
    if (!db) return
    if (!confirm(`Move "${db.title}" to Trash? You can restore it from Settings → Trash.`)) return
    try {
      await databasesApi.delete(id)
      window.dispatchEvent(new CustomEvent('leaf-tree-changed'))
      router.push('/databases')
    } catch (error) {
      console.error(error)
    }
  }, [db, id, router])

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
  const activeView = db?.view_type || 'table'

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
    saveColumnDefinition,
    deleteColumn,
    gallerySize,
    setGallerySize,
    deleteDatabase,
    updateCellValue,
    setColumnOptions,
    renameColumnOption,
    deleteColumnOption,
    optionColumnActions,
  }
}
