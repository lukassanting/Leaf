'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import type { DatabaseRow, PropertyDefinition, ViewType } from '@/lib/api'

function parseTagValues(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string' && value) {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  }
  return []
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getColumnByMatcher(columns: PropertyDefinition[], matcher: (column: PropertyDefinition) => boolean) {
  return columns.find(matcher) ?? null
}

function getStatusColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => column.key === 'status' || column.label.toLowerCase() === 'status')
}

function getDateColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => /date|due/i.test(column.key) || /date|due/i.test(column.label))
}

function getProgressColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => /progress/i.test(column.key) || /progress/i.test(column.label))
}

function getTagColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => column.type === 'tags')
}

function classifyTone(raw: string): 'green' | 'amber' | 'red' | 'muted' {
  const value = raw.toLowerCase()
  if (/(done|complete|completed|published|active)/.test(value)) return 'green'
  if (/(progress|doing|review|blocked|soon)/.test(value)) return 'amber'
  if (/(risk|urgent|stuck|bug|ai|cancelled)/.test(value)) return 'red'
  return 'muted'
}

function Pill({ label, tone = 'muted', compact = false }: { label: string; tone?: 'green' | 'amber' | 'red' | 'muted'; compact?: boolean }) {
  const styles = {
    green: { background: 'var(--color-tag-bg)', color: 'var(--color-tag-text)', borderColor: 'var(--color-tag-border)' },
    amber: { background: '#fef5e0', color: '#7a5c10', borderColor: '#e8d48a' },
    red: { background: '#fef0ee', color: '#8a3a2a', borderColor: '#e8c0b8' },
    muted: { background: '#f4f4f5', color: 'var(--leaf-text-body)', borderColor: 'rgba(0,0,0,0.06)' },
  }[tone]

  return (
    <span
      className="inline-flex items-center rounded-full border"
      style={{
        ...styles,
        fontSize: compact ? 10 : 10.5,
        padding: compact ? '1px 7px' : '2px 8px',
      }}
    >
      {label}
    </span>
  )
}

function TagChips({ value, compact = false }: { value: unknown; compact?: boolean }) {
  const tags = parseTagValues(value)
  if (!tags.length) return <span className="text-xs" style={{ color: 'var(--leaf-text-hint)' }}>—</span>

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Pill key={tag} label={tag} tone={classifyTone(tag)} compact={compact} />
      ))}
    </div>
  )
}

function StatusValue({ value, compact = false }: { value: unknown; compact?: boolean }) {
  if (!value) return <span className="text-xs" style={{ color: 'var(--leaf-text-hint)' }}>—</span>
  const label = String(value)
  return <Pill label={label} tone={classifyTone(label)} compact={compact} />
}

function ProgressValue({ value }: { value: unknown }) {
  const progress = Math.max(0, Math.min(100, parseNumberValue(value) ?? 0))
  return (
    <div className="min-w-[60px]">
      <div className="h-[5px] overflow-hidden rounded-[3px]" style={{ background: '#f4f4f5' }}>
        <div className="h-full rounded-[3px]" style={{ width: `${progress}%`, background: 'var(--leaf-green)' }} />
      </div>
    </div>
  )
}

function renderPropertyValue(column: PropertyDefinition, value: unknown, compact = false) {
  if (column.type === 'tags') return <TagChips value={value} compact={compact} />
  if (/status/i.test(column.key) || /status/i.test(column.label)) return <StatusValue value={value} compact={compact} />
  if (/progress/i.test(column.key) || /progress/i.test(column.label)) return <ProgressValue value={value} />
  if (/date|due/i.test(column.key) || /date|due/i.test(column.label)) {
    return <span style={{ color: 'var(--leaf-text-muted)', fontSize: 12 }}>{String(value || '—')}</span>
  }
  return <span className="text-sm" style={{ color: 'var(--leaf-text-sidebar)' }}>{String(value || '—')}</span>
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

  if (!editing) {
    return (
      <button
        type="button"
        className="block min-h-[1.25rem] w-full cursor-text text-left"
        onDoubleClick={() => setEditing(true)}
        title="Double-click to edit"
      >
        {renderPropertyValue(propDef, value)}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      className="w-full rounded-md bg-white px-2 py-1 text-sm focus:outline-none"
      style={{ border: '1px solid rgba(16,185,129,0.24)', boxShadow: '0 0 0 1px rgba(16,185,129,0.08)' }}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') {
          setEditing(false)
          setDraft(String(value ?? ''))
        }
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
        className="w-full rounded bg-white px-1 py-0 text-sm font-medium focus:outline-none"
        style={{ border: '1px solid rgba(16,185,129,0.24)' }}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') {
            setEditing(false)
            setDraft(row.leaf_title)
          }
        }}
      />
    )
  }

  return (
    <div className="group flex items-center gap-2.5">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-60">
        <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M8.9 2.75V5.55H11.75" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      </svg>
      <span
        className="flex-1 cursor-text truncate text-sm font-medium"
        style={{ color: 'var(--leaf-text-title)' }}
        onDoubleClick={() => setEditing(true)}
        title="Double-click to rename"
      >
        {row.leaf_title || 'Untitled'}
      </span>
      {row.leaf_id && (
        <Link
          href={`/editor/${row.leaf_id}`}
          className="shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--leaf-text-muted)' }}
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

function RowPreview({
  row,
  columns,
  onUpdateName,
  onDeleteRow,
}: {
  row: DatabaseRow
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
}) {
  const dateColumn = getDateColumn(columns)
  const progressColumn = getProgressColumn(columns)
  const tagColumn = getTagColumn(columns)

  return (
    <div className="group rounded-xl border bg-white px-3.5 py-3 transition-colors duration-150" style={{ borderColor: 'rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
      <div className="mb-2">
        <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
      </div>
      {tagColumn ? (
        <div className="mb-2">
          <TagChips value={(row.properties || {})[tagColumn.key]} compact />
        </div>
      ) : null}
      {dateColumn ? (
        <div className="text-[10.5px]" style={{ color: 'var(--leaf-text-muted)' }}>
          {String((row.properties || {})[dateColumn.key] || 'No date')}
        </div>
      ) : null}
      {progressColumn ? (
        <div className="mt-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--leaf-text-muted)' }}>Progress</div>
          <ProgressValue value={(row.properties || {})[progressColumn.key]} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onDeleteRow(row.id)}
        className="mt-3 text-xs opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: 'var(--leaf-text-muted)' }}
      >
        Delete
      </button>
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
      <div className="relative w-72 space-y-3 rounded-xl border bg-white p-5 shadow-lg" style={{ borderColor: 'var(--leaf-border-strong)', boxShadow: 'var(--leaf-shadow-soft)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--leaf-text-title)' }}>New column</h2>
        <input
          autoFocus
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--leaf-border-strong)', boxShadow: '0 0 0 0 rgba(16,185,129,0)' }}
          placeholder="Column name"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
        />
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--leaf-border-strong)' }}
          value={type}
          onChange={(event) => setType(event.target.value as PropertyDefinition['type'])}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="tags">Tags</option>
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm" style={{ color: 'var(--leaf-text-muted)' }}>Cancel</button>
          <button type="button" onClick={submit} className="rounded-lg px-3 py-1.5 text-sm text-white transition" style={{ background: 'var(--leaf-green)' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

export function DatabaseToolbar({
  activeView,
  onSetView,
  onAddRow,
}: {
  activeView: ViewType
  onSetView: (view: ViewType) => void
  onAddRow: () => void
}) {
  const viewIcons: Record<ViewType, React.ReactNode> = {
    table: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="1" width="12" height="12" rx="1.5" />
        <line x1="1" y1="5" x2="13" y2="5" />
        <line x1="5" y1="5" x2="5" y2="13" />
      </svg>
    ),
    board: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="2" width="3" height="10" rx="1" />
        <rect x="5.5" y="4" width="3" height="8" rx="1" />
        <rect x="10" y="1" width="3" height="11" rx="1" />
      </svg>
    ),
    gallery: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="1" width="5" height="5" rx="1" />
        <rect x="8" y="1" width="5" height="5" rx="1" />
        <rect x="1" y="8" width="5" height="5" rx="1" />
        <rect x="8" y="8" width="5" height="5" rx="1" />
      </svg>
    ),
    list: null,
  }

  const labels: { key: ViewType; label: string }[] = [
    { key: 'table', label: 'Table' },
    { key: 'board', label: 'Board' },
    { key: 'gallery', label: 'Gallery' },
  ]

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-0.5 rounded-full" style={{ background: '#f4f4f5', borderRadius: 20, padding: 3, border: '1px solid rgba(0,0,0,0.06)' }}>
        {labels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSetView(key)}
            className="flex items-center gap-1.5 transition-colors duration-150"
            style={{
              padding: '5px 13px',
              borderRadius: 16,
              fontSize: 12,
              background: activeView === key ? '#fff' : 'transparent',
              color: activeView === key ? 'var(--leaf-text-title)' : 'var(--leaf-text-muted)',
              fontWeight: activeView === key ? 500 : 400,
              boxShadow: activeView === key ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
            }}
          >
            {viewIcons[key]}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <button type="button" className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--leaf-text-muted)', padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.86)' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3H10M2.5 5.5H8.5M4 8H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          Filter
        </button>
        <button type="button" className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--leaf-text-muted)', padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.86)' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3L3.5 5.5L6 3M5 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Sort
        </button>
        <button
          type="button"
          onClick={onAddRow}
          className="flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 500, color: '#fff', padding: '5px 11px', borderRadius: 8, border: '1px solid var(--leaf-green)', background: 'var(--leaf-green)' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1V10M1 5.5H10" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></svg>
          New entry
        </button>
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
    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <th className="w-56 whitespace-nowrap px-3.5 py-2.5 text-left text-[11px] font-medium" style={{ color: 'var(--leaf-text-muted)', borderRight: '1px solid var(--leaf-border-soft)' }}>
              <span className="flex items-center gap-1.5"><span style={{ opacity: 0.6 }}>Aa</span>Name</span>
            </th>
            {columns.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[11px] font-medium" style={{ color: 'var(--leaf-text-muted)', borderRight: '1px solid var(--leaf-border-soft)' }}>
                {column.label}
              </th>
            ))}
            <th className="px-3.5 py-2 text-left text-[11.5px] font-normal" style={{ color: 'var(--leaf-text-muted)' }}>
              <button type="button" onClick={onAddColumn}>+ Add property</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group" style={{ borderBottom: '1px solid var(--leaf-border-soft)' }}>
              <td className="px-3.5 py-2.5 align-middle" style={{ borderRight: '1px solid var(--leaf-border-soft)' }}>
                <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
              </td>
              {columns.map((column) => (
                <td key={column.key} className="px-3.5 py-2.5 align-middle" style={{ color: 'var(--leaf-text-body)', borderRight: '1px solid var(--leaf-border-soft)' }}>
                  <Cell value={(row.properties || {})[column.key]} propDef={column} onSave={(value) => onUpdateCell(row.id, column.key, value)} />
                </td>
              ))}
              <td className="px-3.5 py-2.5 text-right align-middle">
                <button type="button" onClick={() => onDeleteRow(row.id)} className="text-xs opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--leaf-text-muted)' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={columns.length + 2} className="px-3.5 py-2.5 text-[12.5px]" style={{ color: 'var(--leaf-text-muted)' }}>
              <button type="button" onClick={onAddRow}>+ New entry</button>
            </td>
          </tr>
        </tfoot>
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
  const statusColumn = getStatusColumn(columns)
  const tagColumn = getTagColumn(columns)

  const groups = useMemo(() => {
    const map = new Map<string, DatabaseRow[]>()
    for (const row of rows) {
      const statusValue = statusColumn ? String((row.properties || {})[statusColumn.key] || '').trim() : ''
      const tagValues = tagColumn ? parseTagValues((row.properties || {})[tagColumn.key]) : []
      const keys = statusValue ? [statusValue] : tagValues.length ? tagValues : ['Todo']
      for (const key of keys) {
        map.set(key, [...(map.get(key) ?? []), row])
      }
    }
    if (!map.size) map.set('Todo', [])
    return Array.from(map.entries())
  }, [rows, statusColumn, tagColumn])

  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {groups.map(([group, groupRows]) => (
        <div key={group} className="w-[220px] min-w-[220px] shrink-0">
          <div className="flex items-center justify-between px-0.5 pb-2">
            <div className="flex items-center gap-1.5">
              <Pill label={group} tone={classifyTone(group)} compact />
              <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ color: 'var(--leaf-text-muted)', background: '#f4f4f5' }}>{groupRows.length}</span>
            </div>
            <button type="button" onClick={onAddRow} className="h-[22px] w-[22px] rounded-[5px] text-base leading-none" style={{ color: 'var(--leaf-text-muted)' }}>+</button>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl p-2" style={{ background: 'rgba(244,244,245,0.52)' }}>
            {groupRows.map((row) => (
              <RowPreview key={row.id} row={row} columns={columns} onUpdateName={onUpdateName} onDeleteRow={onDeleteRow} />
            ))}
          </div>
        </div>
      ))}
      <div className="flex min-w-[160px] items-start pt-0.5">
        <button
          type="button"
          onClick={onAddRow}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 text-sm"
          style={{ color: 'var(--leaf-text-muted)', borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(250,250,250,0.86)' }}
        >
          <span className="text-base leading-none">+</span>
          New entry
        </button>
      </div>
    </div>
  )
}

export function GalleryView({
  rows, columns, onUpdateName, onDeleteRow, onAddRow,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
}) {
  const statusColumn = getStatusColumn(columns)
  const tagColumn = getTagColumn(columns)
  const dateColumn = getDateColumn(columns)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => {
        const status = statusColumn ? (row.properties || {})[statusColumn.key] : null
        const tone = ['#f4f4f5', '#f8fafc', '#ecfdf5', '#faf5ff'][index % 4]
        return (
          <div key={row.id} className="group overflow-hidden rounded-xl border bg-white transition-colors duration-150" style={{ borderColor: 'rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div className="flex h-[92px] items-center justify-center" style={{ background: tone }}>
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" className="opacity-35">
                <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="#10b981" strokeWidth="1.15" strokeLinejoin="round" />
                <path d="M8.9 2.75V5.55H11.75" stroke="#10b981" strokeWidth="1.15" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="px-3 py-2.5">
              <div className="mb-1.5">
                <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
              </div>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {status ? <StatusValue value={status} compact /> : null}
                {tagColumn ? <TagChips value={(row.properties || {})[tagColumn.key]} compact /> : null}
              </div>
              <div className="text-[10.5px]" style={{ color: 'var(--leaf-text-muted)' }}>
                {dateColumn ? String((row.properties || {})[dateColumn.key] || '—') : 'Open page to edit'}
              </div>
              <button type="button" onClick={() => onDeleteRow(row.id)} className="mt-3 text-xs opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--leaf-text-muted)' }}>
                Delete
              </button>
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAddRow}
        className="flex min-h-[152px] items-center justify-center rounded-xl border border-dashed"
        style={{ borderColor: 'rgba(0,0,0,0.08)', background: '#fafafa' }}
      >
        <div className="flex flex-col items-center gap-1 text-[11.5px]" style={{ color: 'var(--leaf-text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          New entry
        </div>
      </button>
    </div>
  )
}
