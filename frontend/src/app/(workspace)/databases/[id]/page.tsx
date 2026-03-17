'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { databasesApi, leavesApi } from '@/lib/api'
import type { Database, DatabaseRow, PropertyDefinition, ViewType } from '@/lib/api'

// ─── Tag chips ─────────────────────────────────────────────────────────────

function TagChips({ value }: { value: unknown }) {
  const tags = Array.isArray(value) ? value as string[] : typeof value === 'string' && value ? value.split(',').map(t => t.trim()).filter(Boolean) : []
  if (!tags.length) return <span className="text-leaf-300 text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="px-1.5 py-0.5 rounded-full text-xs bg-leaf-100 text-leaf-700">{t}</span>
      ))}
    </div>
  )
}

// ─── Inline cell editor ────────────────────────────────────────────────────

function Cell({
  value,
  propDef,
  onSave,
}: {
  value: unknown
  propDef: PropertyDefinition
  onSave: (val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(String(value ?? '')) }, [value])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== String(value ?? '')) onSave(draft)
  }

  if (propDef.type === 'tags') {
    if (editing) {
      return (
        <input
          ref={inputRef}
          className="w-full bg-white border border-leaf-400 rounded px-1 py-0 text-xs focus:outline-none"
          placeholder="tag1, tag2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(String(value ?? '')) } }}
        />
      )
    }
    return (
      <span onDoubleClick={() => { setDraft(String(value ?? '')); setEditing(true) }} title="Double-click to edit" className="cursor-text block">
        <TagChips value={value} />
      </span>
    )
  }

  if (!editing) {
    return (
      <span
        className="block w-full cursor-text min-h-[1.25rem] text-sm"
        onDoubleClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
        title="Double-click to edit"
      >
        {String(value ?? '') || <span className="text-leaf-300">—</span>}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      className="w-full bg-white border border-leaf-400 rounded px-1 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-leaf-400"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(String(value ?? '')) } }}
    />
  )
}

// ─── Name cell (leaf title, links to page) ────────────────────────────────

function NameCell({ row, onSave }: { row: DatabaseRow; onSave: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.leaf_title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(row.leaf_title) }, [row.leaf_title])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim() || 'Untitled'
    if (trimmed !== row.leaf_title) onSave(trimmed)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full bg-white border border-leaf-400 rounded px-1 py-0 text-sm font-medium focus:outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(row.leaf_title) } }}
      />
    )
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <span
        className="flex-1 cursor-text text-sm font-medium text-leaf-900 truncate"
        onDoubleClick={() => setEditing(true)}
        title="Double-click to rename"
      >
        {row.leaf_title || 'Untitled'}
      </span>
      {row.leaf_id && (
        <Link
          href={`/editor/${row.leaf_id}`}
          className="opacity-0 group-hover:opacity-100 text-xs text-leaf-400 hover:text-leaf-600 shrink-0 transition-opacity"
          title="Open page"
        >
          ↗
        </Link>
      )}
    </div>
  )
}

// ─── Add column modal ──────────────────────────────────────────────────────

function AddColumnModal({ onAdd, onClose }: { onAdd: (def: PropertyDefinition) => void; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<PropertyDefinition['type']>('text')

  const submit = () => {
    if (!label.trim()) return
    onAdd({ key: label.trim().toLowerCase().replace(/\s+/g, '_'), label: label.trim(), type })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg border border-leaf-100 p-5 w-72 space-y-3">
        <h2 className="text-sm font-semibold text-leaf-800">New column</h2>
        <input
          autoFocus
          className="w-full border border-leaf-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-leaf-400"
          placeholder="Column name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <select
          className="w-full border border-leaf-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          value={type}
          onChange={(e) => setType(e.target.value as PropertyDefinition['type'])}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="tags">Tags</option>
        </select>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-sm text-leaf-500 hover:text-leaf-700 px-3 py-1.5">Cancel</button>
          <button type="button" onClick={submit} className="bg-leaf-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-leaf-700 transition">Add</button>
        </div>
      </div>
    </div>
  )
}

// ─── View components ───────────────────────────────────────────────────────

function TableView({
  rows, columns, onUpdateName, onUpdateCell, onDeleteRow, onAddRow, onAddColumn,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  onAddColumn: () => void
}) {
  return (
    <div className="border border-leaf-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-leaf-200 bg-leaf-50">
            <th className="text-left px-4 py-2.5 font-medium text-leaf-400 text-xs w-56">
              <span className="flex items-center gap-1.5"><span className="text-leaf-300">Aa</span> Name</span>
            </th>
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-2.5 font-medium text-leaf-400 text-xs">{col.label}</th>
            ))}
            <th className="px-4 py-2.5 text-leaf-300 text-xs font-normal text-left">
              <button type="button" onClick={onAddColumn} className="flex items-center gap-1 hover:text-leaf-600 transition">
                <span>+</span> Add property
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-leaf-100 hover:bg-leaf-50/60 group">
              <td className="px-4 py-2">
                <NameCell row={row} onSave={(t) => onUpdateName(row.id, t)} />
              </td>
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-leaf-800">
                  <Cell value={(row.properties || {})[col.key]} propDef={col} onSave={(val) => onUpdateCell(row.id, col.key, val)} />
                </td>
              ))}
              <td className="px-4 py-2 text-right">
                <button type="button" onClick={() => onDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-xs text-leaf-300 hover:text-red-500 transition">Delete</button>
              </td>
            </tr>
          ))}
          {/* Inline new-entry row */}
          <tr className="hover:bg-leaf-50/40">
            <td colSpan={columns.length + 2} className="px-4 py-2">
              <button
                type="button"
                onClick={onAddRow}
                className="flex items-center gap-1.5 text-sm text-leaf-400 hover:text-leaf-700 transition"
              >
                <span className="text-base leading-none">+</span> New page
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function ListView({
  rows, columns, onUpdateName, onDeleteRow,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
}) {
  const tagsCols = columns.filter((c) => c.type === 'tags')

  return (
    <div className="space-y-1">
      {rows.length === 0 && <div className="py-10 text-center text-leaf-400 text-sm">No entries yet.</div>}
      {rows.map((row) => {
        const allTags = tagsCols.flatMap((c) => {
          const v = (row.properties || {})[c.key]
          return Array.isArray(v) ? v as string[] : typeof v === 'string' && v ? v.split(',').map(t => t.trim()).filter(Boolean) : []
        })
        return (
          <div key={row.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-leaf-50 group">
            <div className="flex-1 min-w-0">
              <NameCell row={row} onSave={(t) => onUpdateName(row.id, t)} />
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1 shrink-0">
                {allTags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded-full text-xs bg-leaf-100 text-leaf-700">{t}</span>
                ))}
              </div>
            )}
            <button type="button" onClick={() => onDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-xs text-leaf-300 hover:text-red-500 transition shrink-0">Delete</button>
          </div>
        )
      })}
    </div>
  )
}

function GalleryView({
  rows, columns, onUpdateName, onDeleteRow,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {rows.length === 0 && <div className="col-span-3 py-10 text-center text-leaf-400 text-sm">No entries yet.</div>}
      {rows.map((row) => (
        <div key={row.id} className="border border-leaf-200 rounded-xl p-4 hover:shadow-sm transition group bg-white">
          <div className="mb-3">
            <NameCell row={row} onSave={(t) => onUpdateName(row.id, t)} />
          </div>
          <div className="space-y-1.5">
            {columns.map((col) => {
              const val = (row.properties || {})[col.key]
              if (!val && val !== 0) return null
              return (
                <div key={col.key} className="flex items-start gap-2">
                  <span className="text-xs text-leaf-400 shrink-0 pt-0.5">{col.label}</span>
                  {col.type === 'tags' ? <TagChips value={val} /> : <span className="text-xs text-leaf-700">{String(val)}</span>}
                </div>
              )
            })}
          </div>
          <button type="button" onClick={() => onDeleteRow(row.id)} className="mt-3 opacity-0 group-hover:opacity-100 text-xs text-leaf-300 hover:text-red-500 transition">Delete</button>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

const VIEW_LABELS: { key: ViewType; label: string }[] = [
  { key: 'table', label: 'Table' },
  { key: 'list', label: 'List' },
  { key: 'gallery', label: 'Gallery' },
]

export default function DatabaseViewPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [db, setDb] = useState<Database | null>(null)
  const [rows, setRows] = useState<DatabaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCol, setShowAddCol] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const savedTitleRef = useRef('')

  useEffect(() => {
    if (!id) return
    Promise.all([databasesApi.get(id), databasesApi.listRows(id)])
      .then(([dbData, rowsData]) => {
        setDb(dbData)
        setTitleDraft(dbData.title)
        savedTitleRef.current = dbData.title
        setRows(rowsData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleTitleSave = async (val: string) => {
    const trimmed = val.trim() || 'Untitled database'
    if (trimmed === savedTitleRef.current || !db) return
    setTitleDraft(trimmed)
    savedTitleRef.current = trimmed
    try {
      const updated = await databasesApi.update(id, { title: trimmed, schema: db.schema, view_type: db.view_type })
      setDb(updated)
    } catch { console.error('Failed to save title') }
  }

  const setViewType = async (vt: ViewType) => {
    if (!db) return
    try {
      const updated = await databasesApi.update(id, { title: db.title, schema: db.schema, view_type: vt })
      setDb(updated)
    } catch { console.error('Failed to save view type') }
  }

  const columns: PropertyDefinition[] = db?.schema?.properties ?? []

  const addRow = useCallback(async () => {
    try {
      const row = await databasesApi.createRow(id, { properties: {} })
      setRows((prev) => [...prev, row])
    } catch (e) { console.error(e) }
  }, [id])

  const deleteRow = async (rowId: string) => {
    if (!confirm('Delete this entry and its page?')) return
    try {
      await databasesApi.deleteRow(id, rowId)
      setRows((prev) => prev.filter((r) => r.id !== rowId))
    } catch (e) { console.error(e) }
  }

  const updateName = useCallback(async (rowId: string, title: string) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row?.leaf_id) return
    try {
      await leavesApi.update(row.leaf_id, { title, children_ids: [] })
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, leaf_title: title } : r))
    } catch (e) { console.error(e) }
  }, [rows])

  const updateCell = useCallback(async (rowId: string, key: string, val: string) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row) return
    const col = columns.find((c) => c.key === key)
    const parsed: unknown = col?.type === 'tags'
      ? val.split(',').map((t) => t.trim()).filter(Boolean)
      : val
    const updated = await databasesApi.updateRow(id, rowId, {
      properties: { ...row.properties, [key]: parsed },
    })
    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)))
  }, [id, rows, columns])

  const addColumn = useCallback(async (def: PropertyDefinition) => {
    if (!db) return
    const newSchema = { properties: [...(db.schema?.properties ?? []), def] }
    try {
      const updated = await databasesApi.update(id, { title: db.title, schema: newSchema, view_type: db.view_type })
      setDb(updated)
      setShowAddCol(false)
    } catch (e) { console.error(e) }
  }, [db, id])

  if (loading || !db) {
    return <div className="p-8 text-leaf-400 text-sm">{loading ? 'Loading…' : 'Database not found.'}</div>
  }

  const activeView = db.view_type || 'table'

  return (
    <>
      {showAddCol && <AddColumnModal onAdd={addColumn} onClose={() => setShowAddCol(false)} />}

      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-12 py-12">
          <Link href="/databases" className="text-xs text-leaf-400 hover:text-leaf-600 mb-4 inline-block">← Databases</Link>

          <input
            className="w-full text-4xl font-bold text-leaf-900 bg-transparent border-none outline-none placeholder:text-leaf-200 mb-6 leading-tight"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={(e) => handleTitleSave(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
            placeholder="Untitled database"
          />

          {/* View tabs + actions */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1 border border-leaf-200 rounded-lg p-0.5 bg-leaf-50">
              {VIEW_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewType(key)}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    activeView === key
                      ? 'bg-white text-leaf-900 font-medium shadow-sm'
                      : 'text-leaf-500 hover:text-leaf-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {activeView !== 'table' && (
              <button type="button" onClick={addRow} className="px-3 py-1.5 bg-leaf-600 text-white rounded-lg text-sm font-medium hover:bg-leaf-700 transition">
                + New entry
              </button>
            )}
          </div>

          {activeView === 'table' && (
            <TableView rows={rows} columns={columns} onUpdateName={updateName} onUpdateCell={updateCell} onDeleteRow={deleteRow} onAddRow={addRow} onAddColumn={() => setShowAddCol(true)} />
          )}
          {activeView === 'list' && (
            <ListView rows={rows} columns={columns} onUpdateName={updateName} onDeleteRow={deleteRow} />
          )}
          {activeView === 'gallery' && (
            <GalleryView rows={rows} columns={columns} onUpdateName={updateName} onDeleteRow={deleteRow} />
          )}
        </div>
      </div>
    </>
  )
}
