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

function getTagColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => column.type === 'tags')
}

function getEstimateColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => /estimate|est|points/i.test(column.key) || /estimate|est|points/i.test(column.label))
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
    green: { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
    amber: { background: '#fef9ec', color: '#92400e', borderColor: '#fde68a' },
    red: { background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' },
    muted: { background: '#f4f4f5', color: '#3f3f46', borderColor: 'rgba(0,0,0,0.06)' },
  }[tone]

  return (
    <span
      className="inline-flex items-center rounded-full border"
      style={{
        ...styles,
        fontSize: compact ? 10.5 : 11,
        padding: compact ? '1px 8px' : '2px 10px',
        fontWeight: 500,
        lineHeight: 1.5,
      }}
    >
      {label}
    </span>
  )
}

function StatusDot({ tone }: { tone: 'green' | 'amber' | 'red' | 'muted' }) {
  const color = {
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    muted: '#a1a1aa',
  }[tone]
  return <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: color }} />
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
  const tone = classifyTone(label)
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot tone={tone} />
      <Pill label={label} tone={tone} compact={compact} />
    </span>
  )
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
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50">
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
  const tagColumn = getTagColumn(columns)
  const estimateColumn = getEstimateColumn(columns)

  return (
    <div className="group rounded-xl border bg-white px-3.5 py-3 transition-colors duration-150" style={{ borderColor: 'rgba(0,0,0,0.07)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
      <div className="mb-2">
        <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {tagColumn ? <TagChips value={(row.properties || {})[tagColumn.key]} compact /> : null}
        </div>
        {estimateColumn ? (
          <span style={{ fontSize: 11, color: 'var(--leaf-text-muted)' }}>
            # {String((row.properties || {})[estimateColumn.key] || '—')}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDeleteRow(row.id)}
        className="mt-2 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: 'var(--leaf-text-muted)' }}
      >
        ...
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
        <h2 className="text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>New column</h2>
        <input
          autoFocus
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--leaf-border-strong)' }}
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
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="1" y="1" width="12" height="12" rx="1.5" />
        <line x1="1" y1="5" x2="13" y2="5" />
        <line x1="5" y1="5" x2="5" y2="13" />
      </svg>
    ),
    board: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="1" y="2" width="3" height="10" rx="1" />
        <rect x="5.5" y="4" width="3" height="8" rx="1" />
        <rect x="10" y="1" width="3" height="11" rx="1" />
      </svg>
    ),
    gallery: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="1" y="1" width="5" height="5" rx="1" />
        <rect x="8" y="1" width="5" height="5" rx="1" />
        <rect x="1" y="8" width="5" height="5" rx="1" />
        <rect x="8" y="8" width="5" height="5" rx="1" />
      </svg>
    ),
    list: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M1.5 3.5H12.5M1.5 7H12.5M1.5 10.5H12.5" strokeLinecap="round" />
      </svg>
    ),
  }

  const labels: { key: ViewType; label: string }[] = [
    { key: 'table', label: 'Table' },
    { key: 'board', label: 'Board' },
    { key: 'gallery', label: 'Gallery' },
    { key: 'list', label: 'List' },
  ]

  return (
    <div className="mb-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--leaf-border-soft)', paddingBottom: 10 }}>
      {/* View mode tabs */}
      <div className="flex items-center gap-0.5">
        {labels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSetView(key)}
            className="flex items-center gap-1.5 transition-colors duration-150"
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 13,
              background: activeView === key ? '#fff' : 'transparent',
              color: activeView === key ? 'var(--leaf-text-title)' : 'var(--leaf-text-muted)',
              fontWeight: activeView === key ? 600 : 400,
              boxShadow: activeView === key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              border: activeView === key ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
            }}
          >
            {viewIcons[key]}
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          className="flex items-center justify-center"
          style={{ padding: '5px 8px', color: 'var(--leaf-text-hint)', fontSize: 14 }}
        >
          +
        </button>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1.5">
        <button type="button" className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--leaf-text-muted)', padding: '5px 10px', borderRadius: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3.5H10.5M3 6H9M4.5 8.5H7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
          Filter
        </button>
        <button type="button" className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--leaf-text-muted)', padding: '5px 10px', borderRadius: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2.5V9.5M3 9.5L1 7.5M3 9.5L5 7.5M9 9.5V2.5M9 2.5L7 4.5M9 2.5L11 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Sort
        </button>
        <button type="button" className="flex items-center justify-center" style={{ color: 'var(--leaf-text-muted)', padding: '5px 8px', borderRadius: 6 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" /><path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </button>
        <span style={{ width: 1, height: 16, background: 'var(--leaf-border-soft)', margin: '0 4px' }} />
        <button
          type="button"
          onClick={onAddRow}
          className="flex items-center gap-1 text-white"
          style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 8, background: '#10b981' }}
        >
          New
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
    <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--leaf-border-soft)' }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th
              className="whitespace-nowrap px-4 py-2.5 text-left text-[11.5px] font-medium"
              style={{ color: 'var(--leaf-text-muted)', borderBottom: '1px solid var(--leaf-border-soft)', borderRight: '1px solid var(--leaf-border-soft)', minWidth: 240 }}
            >
              <span className="flex items-center gap-1.5">
                <span style={{ opacity: 0.5, fontSize: 12 }}>T</span>
                Name
              </span>
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap px-4 py-2.5 text-left text-[11.5px] font-medium"
                style={{ color: 'var(--leaf-text-muted)', borderBottom: '1px solid var(--leaf-border-soft)', borderRight: '1px solid var(--leaf-border-soft)' }}
              >
                <span className="flex items-center gap-1.5">
                  {/status/i.test(column.label) && <span style={{ opacity: 0.5, fontSize: 12 }}>⌄</span>}
                  {column.type === 'tags' && <span style={{ opacity: 0.5, fontSize: 12 }}>⊛</span>}
                  {column.type === 'number' && <span style={{ opacity: 0.5, fontSize: 12 }}>#</span>}
                  {column.label}
                </span>
              </th>
            ))}
            <th
              className="whitespace-nowrap px-4 py-2.5 text-left text-[11.5px] font-normal"
              style={{ color: 'var(--leaf-text-hint)', borderBottom: '1px solid var(--leaf-border-soft)', width: 48 }}
            >
              <button type="button" onClick={onAddColumn} style={{ color: 'var(--leaf-text-hint)' }}>+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group transition-colors duration-100 hover:bg-[#fafafa]">
              <td className="px-4 py-2.5 align-middle" style={{ borderBottom: '1px solid var(--leaf-border-soft)', borderRight: '1px solid var(--leaf-border-soft)' }}>
                <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
              </td>
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-2.5 align-middle" style={{ color: 'var(--leaf-text-body)', borderBottom: '1px solid var(--leaf-border-soft)', borderRight: '1px solid var(--leaf-border-soft)' }}>
                  <Cell value={(row.properties || {})[column.key]} propDef={column} onSave={(value) => onUpdateCell(row.id, column.key, value)} />
                </td>
              ))}
              <td className="px-3 py-2.5 text-center align-middle" style={{ borderBottom: '1px solid var(--leaf-border-soft)' }}>
                <button type="button" onClick={() => onDeleteRow(row.id)} className="text-xs opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--leaf-text-muted)', letterSpacing: 1 }}>
                  ···
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={columns.length + 2} className="px-4 py-2.5 text-[12.5px]" style={{ color: 'var(--leaf-text-muted)' }}>
              <button type="button" onClick={onAddRow} className="flex items-center gap-1">
                <span style={{ fontSize: 14 }}>+</span> New
              </button>
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
      const keys = statusValue ? [statusValue] : tagValues.length ? tagValues : ['To Do']
      for (const key of keys) {
        map.set(key, [...(map.get(key) ?? []), row])
      }
    }
    if (!map.size) map.set('To Do', [])
    return Array.from(map.entries())
  }, [rows, statusColumn, tagColumn])

  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {groups.map(([group, groupRows]) => (
        <div key={group} className="w-[240px] min-w-[240px] shrink-0">
          <div className="flex items-center justify-between px-0.5 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone={classifyTone(group)} />
                <Pill label={group} tone={classifyTone(group)} compact />
              </span>
              <span className="text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>{groupRows.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onAddRow} className="h-[22px] w-[22px] rounded-[5px] text-sm leading-none" style={{ color: 'var(--leaf-text-muted)' }}>+</button>
              <button type="button" className="h-[22px] w-[22px] rounded-[5px] text-sm leading-none" style={{ color: 'var(--leaf-text-muted)' }}>···</button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {groupRows.map((row) => (
              <RowPreview key={row.id} row={row} columns={columns} onUpdateName={onUpdateName} onDeleteRow={onDeleteRow} />
            ))}
            <button
              type="button"
              onClick={onAddRow}
              className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-xs"
              style={{ color: 'var(--leaf-text-muted)' }}
            >
              + New
            </button>
          </div>
        </div>
      ))}
      <div className="flex min-w-[160px] items-start pt-6">
        <button
          type="button"
          onClick={onAddRow}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 text-sm"
          style={{ color: 'var(--leaf-text-muted)', borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(250,250,250,0.86)' }}
        >
          + New
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

  // Alternate cover backgrounds — green-tinted for some, neutral for others
  const coverStyles = [
    { background: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)' },
    { background: '#f4f4f5' },
    { background: '#f4f4f5' },
    { background: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)' },
    { background: '#f4f4f5' },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => {
        const status = statusColumn ? (row.properties || {})[statusColumn.key] : null
        const cover = coverStyles[index % coverStyles.length]
        const hasGreenCover = cover.background.includes('ecfdf5')
        return (
          <div
            key={row.id}
            className="group overflow-hidden rounded-xl bg-white transition-shadow duration-150"
            style={{
              border: hasGreenCover ? '1.5px solid #d1fae5' : '1px solid var(--leaf-border-soft)',
            }}
          >
            {/* Cover area */}
            <div className="flex h-[100px] items-center justify-center" style={cover}>
              {!hasGreenCover && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-20">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#a1a1aa" strokeWidth="1.5" />
                  <circle cx="8.5" cy="8.5" r="2" stroke="#a1a1aa" strokeWidth="1.2" />
                  <path d="M3 16L8 12L13 15L17 11L21 14" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {/* Card content */}
            <div className="px-3.5 py-3">
              <div className="mb-2 text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
                <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {status ? <StatusValue value={status} compact /> : null}
                {tagColumn ? <TagChips value={(row.properties || {})[tagColumn.key]} compact /> : null}
                <button
                  type="button"
                  onClick={() => onDeleteRow(row.id)}
                  className="ml-auto text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: 'var(--leaf-text-muted)', letterSpacing: 1 }}
                >
                  ···
                </button>
              </div>
            </div>
          </div>
        )
      })}
      {/* New Page card */}
      <button
        type="button"
        onClick={onAddRow}
        className="flex min-h-[172px] items-center justify-center rounded-xl border border-dashed transition-colors duration-150"
        style={{ borderColor: 'rgba(0,0,0,0.1)', background: '#fafafa' }}
      >
        <div className="flex flex-col items-center gap-2" style={{ color: 'var(--leaf-text-muted)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 500 }}>New Page</span>
        </div>
      </button>
    </div>
  )
}

export function ListView({
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

  return (
    <div>
      {rows.map((row) => {
        const status = statusColumn ? (row.properties || {})[statusColumn.key] : null
        return (
          <div
            key={row.id}
            className="group flex items-center gap-3 px-2 py-2.5 transition-colors duration-100"
            style={{ borderBottom: '1px solid var(--leaf-border-soft)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
          >
            {/* Title with icon */}
            <div className="flex-1 min-w-0">
              <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
            </div>

            {/* Tags + Status on right */}
            <div className="flex items-center gap-2.5">
              {tagColumn ? <TagChips value={(row.properties || {})[tagColumn.key]} compact /> : null}
              {status ? <StatusValue value={status} compact /> : null}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteRow(row.id) }}
                className="text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: 'var(--leaf-text-muted)', letterSpacing: 1 }}
              >
                ···
              </button>
            </div>
          </div>
        )
      })}
      <div className="px-2 py-2.5">
        <button
          type="button"
          onClick={onAddRow}
          className="flex items-center gap-1 text-[12.5px]"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          <span style={{ fontSize: 14 }}>+</span> New
        </button>
      </div>
    </div>
  )
}
