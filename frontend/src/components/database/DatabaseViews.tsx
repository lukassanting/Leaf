'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import type { DatabaseRow, PropertyDefinition } from '@/lib/api'

function parseTagValues(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string' && value) {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  }
  return []
}

function TagChips({ value }: { value: unknown }) {
  const tags = parseTagValues(value)
  if (!tags.length) return <span className="text-leaf-300 text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="px-1.5 py-0.5 rounded-full text-xs bg-leaf-100 text-leaf-700">{tag}</span>
      ))}
    </div>
  )
}

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
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') { setEditing(false); setDraft(String(value ?? '')) }
          }}
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
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') { setEditing(false); setDraft(String(value ?? '')) }
      }}
    />
  )
}

function NameCell({ row, onSave }: { row: DatabaseRow; onSave: (title: string) => void }) {
  const { startNavigation } = useNavigationProgress()
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
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') { setEditing(false); setDraft(row.leaf_title) }
        }}
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
          onClick={() => startNavigation()}
          onMouseEnter={() => { void warmEditorRoute() }}
        >
          ↗
        </Link>
      )}
    </div>
  )
}

export function AddColumnModal({ onAdd, onClose }: { onAdd: (def: PropertyDefinition) => void; onClose: () => void }) {
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
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
        />
        <select
          className="w-full border border-leaf-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          value={type}
          onChange={(event) => setType(event.target.value as PropertyDefinition['type'])}
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

export function TableView({
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
            {columns.map((column) => (
              <th key={column.key} className="text-left px-4 py-2.5 font-medium text-leaf-400 text-xs">{column.label}</th>
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
                <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
              </td>
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-2 text-leaf-800">
                  <Cell value={(row.properties || {})[column.key]} propDef={column} onSave={(value) => onUpdateCell(row.id, column.key, value)} />
                </td>
              ))}
              <td className="px-4 py-2 text-right">
                <button type="button" onClick={() => onDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-xs text-leaf-300 hover:text-red-500 transition">Delete</button>
              </td>
            </tr>
          ))}
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

export function BoardView({
  rows, columns, onUpdateName, onDeleteRow, onAddRow,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
}) {
  const groupColumn = columns.find((column) => column.type === 'tags') ?? null
  const groups = new Map<string, DatabaseRow[]>()

  for (const row of rows) {
    const groupValues = groupColumn ? parseTagValues((row.properties || {})[groupColumn.key]) : []
    const keys = groupValues.length ? groupValues : ['No Tags']
    for (const key of keys) {
      const existing = groups.get(key) ?? []
      existing.push(row)
      groups.set(key, existing)
    }
  }

  if (!groups.size) groups.set('No Tags', [])

  return (
    <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-3 sm:grid-cols-2">
      {Array.from(groups.entries()).map(([group, groupRows]) => (
        <div key={group} className="rounded-2xl border border-leaf-100 bg-[rgba(255,255,255,0.55)] shadow-sm">
          <div className="flex items-center justify-between border-b border-leaf-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--color-hover)', color: 'var(--color-text-body)' }}>
                {group}
              </span>
              <span className="text-xs text-leaf-400">{groupRows.length}</span>
            </div>
          </div>
          <div className="space-y-3 p-3">
            {groupRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-leaf-100 bg-white p-3 shadow-sm transition hover:shadow-md group">
                <div className="mb-2">
                  <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
                </div>
                <div className="space-y-1.5">
                  {columns.map((column) => {
                    const value = (row.properties || {})[column.key]
                    if (!value && value !== 0) return null
                    return (
                      <div key={column.key} className="flex flex-wrap items-start gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-leaf-300">{column.label}</span>
                        {column.type === 'tags'
                          ? <TagChips value={value} />
                          : <span className="text-xs text-leaf-700">{String(value)}</span>}
                      </div>
                    )
                  })}
                </div>
                <button type="button" onClick={() => onDeleteRow(row.id)} className="mt-3 opacity-0 group-hover:opacity-100 text-xs text-leaf-300 hover:text-red-500 transition">
                  Delete
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onAddRow}
              className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-leaf-200 bg-white/60 px-3 py-2 text-sm text-leaf-400 transition hover:text-leaf-700"
            >
              <span className="text-base leading-none">+</span> New page
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function GalleryView({
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
            <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
          </div>
          <div className="space-y-1.5">
            {columns.map((column) => {
              const value = (row.properties || {})[column.key]
              if (!value && value !== 0) return null
              return (
                <div key={column.key} className="flex items-start gap-2">
                  <span className="text-xs text-leaf-400 shrink-0 pt-0.5">{column.label}</span>
                  {column.type === 'tags' ? <TagChips value={value} /> : <span className="text-xs text-leaf-700">{String(value)}</span>}
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
