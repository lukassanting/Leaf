/**
 * Leaf UI: database view renderers (`frontend/src/components/database/DatabaseViews.tsx`).
 *
 * Purpose:
 * - Implements the different row layout modes for database pages:
 *   - table, board, gallery, list
 * - Provides shared UI pieces used by `DatabaseSurface`:
 *   - `DatabaseToolbar` (view switching + actions)
 *   - `AddColumnModal` (add schema properties)
 *
 * How to read:
 * - Start with `DatabaseToolbar`/`AddColumnModal` exports.
 * - Then look for the exported view components:
 *   - `TableView`, `BoardView`, `GalleryView`, `ListView`
 * - Row/cell editing semantics are implemented inside those renderers and call the callbacks
 *   passed from `useDatabasePage` (via `DatabaseSurface`).
 *
 * Update:
 * - To support a new view type:
 *   - extend the `ViewType` union in `lib/api/types.ts`
 *   - add a new view component here
 *   - add a render branch in `DatabaseSurface`.
 *
 * Debug:
 * - If cell editing behaves inconsistently:
 *   - check which property columns are detected (status/tags/progress/etc.)
 *   - verify `onUpdateCell` is called with the correct `key` used by schema properties.
 */


'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import type { DatabaseRow, GallerySize, LeafHeaderBanner, PropertyDefinition, ViewType } from '@/lib/api'

export type { GallerySize }

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

function formatDateCellDisplay(value: unknown): string {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`)
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return s
}

function hashTone(id: string, palette: readonly string[]) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

const DB_CARD_COVER_TONES = [
  'var(--leaf-db-gallery-cover-0)',
  'var(--leaf-db-gallery-cover-1)',
  'var(--leaf-db-gallery-cover-2)',
  'var(--leaf-db-gallery-cover-3)',
] as const

function GalleryCover({
  banner,
  fallbackTone,
  height = 88,
}: {
  banner?: LeafHeaderBanner | null
  fallbackTone: string
  height?: number
}) {
  if (banner?.src) {
    return (
      <div className="w-full overflow-hidden" style={{ height, background: 'var(--leaf-bg-subtle)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.src}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: banner.objectPosition ?? '50% 50%' }}
        />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center" style={{ height, background: fallbackTone }}>
      <svg width="24" height="24" viewBox="0 0 16 16" fill="none" className="opacity-30" style={{ color: 'var(--leaf-db-icon-muted)' }}>
        <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M8.9 2.75V5.55H11.75" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function getColumnByMatcher(columns: PropertyDefinition[], matcher: (column: PropertyDefinition) => boolean) {
  return columns.find(matcher) ?? null
}

function getStatusColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => column.key === 'status' || column.label.toLowerCase() === 'status' || column.type === 'select')
}

function getTagColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => column.type === 'tags')
}

function getEstimateColumn(columns: PropertyDefinition[]) {
  return getColumnByMatcher(columns, (column) => /estimate|est|points/i.test(column.key) || /estimate|est|points/i.test(column.label))
}

/** List/Gallery use status + tags slots; a "Status" column with type `tags` matches both and would render twice. */
function statusColumnSameAsTagColumn(
  status: PropertyDefinition | null,
  tag: PropertyDefinition | null,
): boolean {
  return Boolean(status && tag && status.key === tag.key)
}

function classifyTone(raw: string): 'green' | 'blue' | 'amber' | 'red' | 'muted' {
  const value = raw.toLowerCase()
  if (/(done|complete|completed|published)/.test(value)) return 'green'
  if (/(in progress|progress|doing|review|blocked)/.test(value)) return 'blue'
  if (/(soon|planned|todo|to do)/.test(value)) return 'amber'
  if (/(risk|urgent|stuck|bug|ai|cancelled)/.test(value)) return 'red'
  return 'muted'
}

/** Pastel chip colours per tag label (reference: varied tag hues in table view). */
function tagChipPalette(label: string): { background: string; color: string; borderColor: string } {
  const palettes = [
    { background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' },
    { background: '#ede9fe', color: '#5b21b6', borderColor: '#ddd6fe' },
    { background: '#d1fae5', color: '#047857', borderColor: '#a7f3d0' },
    { background: '#fce7f3', color: '#9d174d', borderColor: '#fbcfe8' },
    { background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' },
    { background: '#ffedd5', color: '#9a3412', borderColor: '#fed7aa' },
    { background: '#e0e7ff', color: '#4338ca', borderColor: '#c7d2fe' },
    { background: '#ccfbf1', color: '#0f766e', borderColor: '#99f6e4' },
  ]
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return palettes[h % palettes.length]
}

/* ── StatusPill: round with colored dot (single-select status) ────────────── */
function StatusPill({ label, tone = 'muted', compact = false }: { label: string; tone?: 'green' | 'blue' | 'amber' | 'red' | 'muted'; compact?: boolean }) {
  const styles = {
    green: { background: 'var(--leaf-db-pill-green-bg)', color: 'var(--leaf-db-pill-green-fg)', borderColor: 'var(--leaf-db-pill-green-border)' },
    blue: { background: 'var(--leaf-db-pill-blue-bg)', color: 'var(--leaf-db-pill-blue-fg)', borderColor: 'var(--leaf-db-pill-blue-border)' },
    amber: { background: 'var(--leaf-db-pill-amber-bg)', color: 'var(--leaf-db-pill-amber-fg)', borderColor: 'var(--leaf-db-pill-amber-border)' },
    red: { background: 'var(--leaf-db-pill-red-bg)', color: 'var(--leaf-db-pill-red-fg)', borderColor: 'var(--leaf-db-pill-red-border)' },
    muted: { background: 'var(--leaf-db-pill-muted-bg)', color: 'var(--leaf-db-pill-muted-fg)', borderColor: 'var(--leaf-db-pill-muted-border)' },
  }[tone]

  const dotColor = {
    green: 'var(--leaf-db-dot-green)',
    blue: 'var(--leaf-db-dot-blue)',
    amber: 'var(--leaf-db-dot-amber)',
    red: 'var(--leaf-db-dot-red)',
    muted: 'var(--leaf-db-dot-muted)',
  }[tone]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border"
      style={{
        ...styles,
        fontSize: compact ? 10 : 10.5,
        padding: compact ? '1px 8px 1px 6px' : '2px 10px 2px 7px',
      }}
    >
      <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: dotColor, flexShrink: 0 }} />
      {label}
    </span>
  )
}

/* ── TagPill: squared-off tag chip (multi-select tags) ────────────────────── */
function TagPill({ label, compact = false }: { label: string; compact?: boolean }) {
  const p = tagChipPalette(label)
  return (
    <span
      className="inline-flex items-center border"
      style={{
        background: p.background,
        color: p.color,
        borderColor: p.borderColor,
        fontSize: compact ? 10 : 10.5,
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: 4,
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
        <TagPill key={tag} label={tag} compact={compact} />
      ))}
    </div>
  )
}

function StatusValue({ value, compact = false }: { value: unknown; compact?: boolean }) {
  if (!value) return <span className="text-xs" style={{ color: 'var(--leaf-text-hint)' }}>—</span>
  const label = String(value)
  const tone = classifyTone(label)
  return <StatusPill label={label} tone={tone} compact={compact} />
}

function ProgressValue({ value }: { value: unknown }) {
  const progress = Math.max(0, Math.min(100, parseNumberValue(value) ?? 0))
  return (
    <div className="min-w-[60px]">
      <div className="h-[5px] overflow-hidden rounded-[3px]" style={{ background: 'var(--leaf-db-progress-track)' }}>
        <div className="h-full rounded-[3px]" style={{ width: `${progress}%`, background: 'var(--leaf-green)' }} />
      </div>
    </div>
  )
}

function renderPropertyValue(column: PropertyDefinition, value: unknown, compact = false) {
  if (column.type === 'tags') return <TagChips value={value} compact={compact} />
  if (column.type === 'select') return <StatusValue value={value} compact={compact} />
  if (column.type === 'number') {
    const n = parseNumberValue(value)
    return (
      <span className="text-sm" style={{ color: 'var(--leaf-text-sidebar)', fontSize: compact ? 11 : undefined }}>
        {n == null || Number.isNaN(n) ? '—' : String(n)}
      </span>
    )
  }
  if (column.type === 'date') {
    return <span style={{ color: 'var(--leaf-text-muted)', fontSize: compact ? 11 : 12 }}>{formatDateCellDisplay(value)}</span>
  }
  if (/status/i.test(column.key) || /status/i.test(column.label)) return <StatusValue value={value} compact={compact} />
  if (/progress/i.test(column.key) || /progress/i.test(column.label)) return <ProgressValue value={value} />
  if (/date|due/i.test(column.key) || /date|due/i.test(column.label)) {
    return <span style={{ color: 'var(--leaf-text-muted)', fontSize: 12 }}>{formatDateCellDisplay(value)}</span>
  }
  return <span className="text-sm" style={{ color: 'var(--leaf-text-sidebar)' }}>{String(value || '—')}</span>
}

function isoDatePrefix(s: string): string | null {
  const t = String(s || '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null
}

/* ── DatePicker: text field + month grid (incl. faded adjacent-month days) ─── */
function DatePicker({
  value,
  onSave,
  onClose,
}: {
  value: string
  onSave: (val: string) => void
  onClose: () => void
}) {
  const today = new Date()
  const parsed = isoDatePrefix(value)
  const initial = parsed ? new Date(`${parsed}T12:00:00`) : today
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [selected, setSelected] = useState(parsed || '')
  const [textField, setTextField] = useState(() => (parsed ? formatDateCellDisplay(parsed) : ''))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const p = isoDatePrefix(value)
    setSelected(p || '')
    setTextField(p ? formatDateCellDisplay(p) : '')
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }
  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  const applyIso = (iso: string) => {
    setSelected(iso)
    setTextField(formatDateCellDisplay(iso))
    onSave(iso)
    onClose()
  }

  const tryParseTextField = () => {
    const raw = textField.trim()
    if (!raw) return
    const tryD = new Date(raw)
    if (!Number.isNaN(tryD.getTime())) {
      const iso = `${tryD.getFullYear()}-${String(tryD.getMonth() + 1).padStart(2, '0')}-${String(tryD.getDate()).padStart(2, '0')}`
      applyIso(iso)
      return
    }
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) applyIso(`${m[1]}-${m[2]}-${m[3]}`)
  }

  const clear = () => { onSave(''); onClose() }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const dim = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevDim = new Date(viewYear, viewMonth, 0).getDate()

  type Cell = { day: number; y: number; m: number; inMonth: boolean }
  const cells: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const offset = i - firstDow + 1
    if (offset < 1) {
      const pm = viewMonth === 0 ? 11 : viewMonth - 1
      const py = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day: prevDim + offset, y: py, m: pm, inMonth: false })
    } else if (offset > dim) {
      const nm = viewMonth === 11 ? 0 : viewMonth + 1
      const ny = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: offset - dim, y: ny, m: nm, inMonth: false })
    } else {
      cells.push({ day: offset, y: viewYear, m: viewMonth, inMonth: true })
    }
  }

  const cellIso = (c: Cell) =>
    `${c.y}-${String(c.m + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`

  const isTodayCell = (c: Cell) =>
    c.y === today.getFullYear() && c.m === today.getMonth() && c.day === today.getDate()

  const monthShortYear = new Date(viewYear, viewMonth).toLocaleString(undefined, { month: 'short', year: 'numeric' })
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const primary = 'var(--color-primary)'
  const onPrimary = 'var(--leaf-on-accent)'

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 w-[280px] rounded-xl border py-2.5 pl-3 pr-3 shadow-lg"
      style={{
        background: 'var(--leaf-bg-elevated)',
        borderColor: 'var(--leaf-border-strong)',
        boxShadow: 'var(--leaf-shadow-soft)',
      }}
    >
      <input
        className="mb-2.5 w-full rounded-lg border px-2.5 py-2 text-[13px] focus:outline-none"
        style={{
          borderColor: 'var(--leaf-border-soft)',
          background: 'color-mix(in srgb, var(--color-primary) 8%, var(--leaf-bg-subtle))',
          color: 'var(--leaf-text-title)',
        }}
        value={textField}
        placeholder="Mar 25, 2026"
        onChange={(e) => setTextField(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') tryParseTextField()
          if (e.key === 'Escape') onClose()
        }}
      />

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--leaf-text-title)' }}>{monthShortYear}</span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={goToday} className="rounded px-1.5 py-0.5 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>Today</button>
          <button type="button" onClick={prevMonth} className="rounded px-1 py-0.5 text-sm" style={{ color: 'var(--leaf-text-muted)' }} aria-label="Previous month">‹</button>
          <button type="button" onClick={nextMonth} className="rounded px-1 py-0.5 text-sm" style={{ color: 'var(--leaf-text-muted)' }} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0 mb-0.5">
        {weekdays.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium" style={{ color: 'var(--leaf-text-muted)' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0">
        {cells.map((c, idx) => {
          const iso = cellIso(c)
          const sel = selected === iso
          return (
            <button
              key={`${idx}-${iso}`}
              type="button"
              onClick={() => applyIso(iso)}
              className="flex h-[32px] w-full items-center justify-center rounded-md text-[12px] transition-colors"
              style={{
                background: sel ? primary : isTodayCell(c) && c.inMonth ? 'var(--leaf-bg-subtle)' : undefined,
                color: sel ? onPrimary : c.inMonth ? 'var(--leaf-text-body)' : 'var(--leaf-text-hint)',
                opacity: c.inMonth ? 1 : 0.45,
                fontWeight: isTodayCell(c) && !sel ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!sel) e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)'
              }}
              onMouseLeave={(e) => {
                if (!sel) {
                  e.currentTarget.style.background = isTodayCell(c) && c.inMonth ? 'var(--leaf-bg-subtle)' : ''
                }
              }}
            >
              {c.day}
            </button>
          )
        })}
      </div>

      <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--leaf-border-soft)' }}>
        <button
          type="button"
          onClick={clear}
          className="w-full rounded-md px-2 py-1.5 text-left text-[12px] transition-colors"
          style={{ color: 'var(--leaf-text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
        >
          Clear
        </button>
      </div>
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
  const [showDatePicker, setShowDatePicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cellRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setDraft(String(value ?? '')) }, [value])
  useEffect(() => { if (editing && propDef.type !== 'date') inputRef.current?.select() }, [editing, propDef.type])

  const commit = () => {
    setEditing(false)
    if (draft !== String(value ?? '')) onSave(draft)
  }

  if (propDef.type === 'date') {
    return (
      <div ref={cellRef} className="relative">
        <button
          type="button"
          className="flex min-h-[28px] w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors"
          style={{
            borderColor: 'var(--leaf-border-soft)',
            background: 'var(--leaf-bg-subtle)',
            color: 'var(--leaf-text-body)',
          }}
          onClick={() => setShowDatePicker(true)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50" aria-hidden>
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2.5 6.5h11M5.5 2v2M10.5 2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-[13px]">{formatDateCellDisplay(value)}</span>
        </button>
        {showDatePicker && (
          <DatePicker
            value={String(value ?? '')}
            onSave={onSave}
            onClose={() => setShowDatePicker(false)}
          />
        )}
      </div>
    )
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

  const inputType = propDef.type === 'number' ? 'number' : 'text'

  return (
    <input
      ref={inputRef}
      type={inputType}
      className="w-full rounded-md px-2 py-1 text-sm focus:outline-none"
      style={{
        border: '1px solid var(--leaf-border-strong)',
        background: 'var(--leaf-bg-elevated)',
      }}
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
        className="w-full rounded px-1 py-0 text-sm font-medium focus:outline-none"
        style={{
          border: '1px solid var(--leaf-border-strong)',
          background: 'var(--leaf-bg-elevated)',
        }}
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
  coverTone,
  coverHeight,
  onUpdateName,
  onDeleteRow,
}: {
  row: DatabaseRow
  columns: PropertyDefinition[]
  coverTone: string
  coverHeight?: number
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
}) {
  const tagColumn = getTagColumn(columns)
  const estimateColumn = getEstimateColumn(columns)

  return (
    <div
      className="group overflow-hidden rounded-xl border transition-colors duration-150"
      style={{
        borderColor: 'var(--leaf-border-soft)',
        boxShadow: '0 1px 2px color-mix(in srgb, var(--foreground) 4%, transparent)',
        background: 'var(--leaf-bg-elevated)',
      }}
    >
      <GalleryCover banner={row.leaf_header_banner} fallbackTone={coverTone} height={coverHeight} />
      <div className="px-3.5 py-3">
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
        className="leaf-db-row-action mt-2 rounded px-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: 'var(--leaf-text-muted)' }}
      >
        ···
      </button>
      </div>
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
      <div
        className="relative w-72 space-y-3 rounded-xl border p-5 shadow-lg"
        style={{
          borderColor: 'var(--leaf-border-strong)',
          boxShadow: 'var(--leaf-shadow-soft)',
          background: 'var(--leaf-bg-elevated)',
        }}
      >
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
          <option value="select">Status</option>
          <option value="tags">Tags</option>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm" style={{ color: 'var(--leaf-text-muted)' }}>Cancel</button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg px-3 py-1.5 text-sm transition"
            style={{ background: 'var(--leaf-green)', color: 'var(--leaf-on-accent)' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function PropertyHeaderGlyph({ type }: { type: PropertyDefinition['type'] }) {
  const muted = 'var(--leaf-text-muted)'
  if (type === 'tags') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: muted, flexShrink: 0 }} aria-hidden>
        <path d="M3 4.5h1.5v1H3V4.5zm0 3h1.5v1H3V7.5zm0 3h1.5v1H3v-1zM6.5 4h7M6.5 8h7M6.5 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  if (type === 'select') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: muted, flexShrink: 0 }} aria-hidden>
        <path d="M8 2.5L9.2 5.8l3.5.4-2.7 2.4.8 3.4L8 10.1 4.2 12l.8-3.4-2.7-2.4 3.5-.4L8 2.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    )
  }
  if (type === 'date') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: muted, flexShrink: 0 }} aria-hidden>
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.5 6.5h11M5.5 2v2M10.5 2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  if (type === 'number') {
    return <span style={{ color: muted, fontSize: 12, width: 14, textAlign: 'center', flexShrink: 0 }}>#</span>
  }
  return <span style={{ color: muted, fontSize: 11, width: 14, textAlign: 'center', flexShrink: 0 }}>Aa</span>
}

export type ColumnDefinitionPatch = { label: string; type: PropertyDefinition['type']; wrap?: boolean }

/* ── ColumnHeaderMenu: property menu (rename, type, wrap, delete) ─────────── */
export function ColumnHeaderMenu({
  column,
  onSave,
  onClose,
  onDelete,
}: {
  column: PropertyDefinition
  onSave: (patch: ColumnDefinitionPatch) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const [label, setLabel] = useState(column.label)
  const [localType, setLocalType] = useState(column.type)
  const [localWrap, setLocalWrap] = useState(column.wrap ?? false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLabel(column.label)
    setLocalType(column.type)
    setLocalWrap(column.wrap ?? false)
    setShowTypeMenu(false)
  }, [column])

  useEffect(() => { inputRef.current?.select() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (label.trim() && label.trim() !== column.label) {
          onSave({ label: label.trim(), type: localType, wrap: localWrap })
        }
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [label, column.label, column.key, localType, localWrap, onSave, onClose])

  const typeOptions: { value: PropertyDefinition['type']; label: string }[] = [
    { value: 'select', label: 'Status' },
    { value: 'tags', label: 'Tags' },
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
  ]

  const menuItemClass = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[12px] transition-colors'
  const menuItemStyle = { color: 'var(--leaf-text-body)' }

  const flushRename = () => {
    if (label.trim()) onSave({ label: label.trim(), type: localType, wrap: localWrap })
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 w-[min(280px,calc(100vw-24px))] rounded-xl border py-1.5 shadow-lg"
      style={{
        background: 'var(--leaf-bg-elevated)',
        borderColor: 'var(--leaf-border-strong)',
        boxShadow: 'var(--leaf-shadow-soft)',
      }}
    >
      <div className="flex items-center gap-2 px-2.5 pb-2 pt-1">
        <PropertyHeaderGlyph type={localType} />
        <input
          ref={inputRef}
          autoFocus
          className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-[13px] focus:outline-none"
          style={{
            borderColor: 'var(--color-primary)',
            background: 'var(--leaf-bg-subtle)',
            color: 'var(--leaf-text-title)',
          }}
          placeholder="Property name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              flushRename()
              onClose()
            }
            if (e.key === 'Escape') onClose()
          }}
        />
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
          style={{ color: 'var(--leaf-text-muted)', border: '1px solid var(--leaf-border-soft)' }}
          title={`Stored key: ${column.key}`}
        >
          i
        </span>
      </div>

      <div className="mx-2 border-t" style={{ borderColor: 'var(--leaf-border-soft)' }} />

      <div className="relative px-1 py-0.5">
        <button
          type="button"
          className={menuItemClass}
          style={menuItemStyle}
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.45 }} aria-hidden>
            <path d="M4 5.5A4.5 4.5 0 0 1 11.2 4M12 2.5v2.5H9.5M12 10.5A4.5 4.5 0 0 1 4.8 12M4 13.5V11h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="flex-1">Change type</span>
          <span className="text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
            {typeOptions.find((t) => t.value === localType)?.label}
          </span>
          <span style={{ color: 'var(--leaf-text-muted)', fontSize: 11 }}>›</span>
        </button>
        {showTypeMenu && (
          <div
            className="absolute left-full top-0 z-[60] ml-1 w-[168px] rounded-lg border py-1 shadow-lg"
            style={{
              background: 'var(--leaf-bg-elevated)',
              borderColor: 'var(--leaf-border-strong)',
              boxShadow: 'var(--leaf-shadow-soft)',
            }}
          >
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={menuItemClass}
                style={{
                  ...menuItemStyle,
                  fontWeight: localType === opt.value ? 500 : 400,
                  background: localType === opt.value ? 'var(--leaf-db-chrome-hover)' : undefined,
                }}
                onClick={() => {
                  setLocalType(opt.value)
                  onSave({ label: label.trim() || column.label, type: opt.value, wrap: localWrap })
                  setShowTypeMenu(false)
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = localType === opt.value ? 'var(--leaf-db-chrome-hover)' : ''
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-1 pb-0.5">
        <button
          type="button"
          className={menuItemClass}
          style={{
            ...menuItemStyle,
            background: localWrap ? 'var(--leaf-db-chrome-hover)' : undefined,
          }}
          onClick={() => {
            const next = !localWrap
            setLocalWrap(next)
            onSave({ label: label.trim() || column.label, type: localType, wrap: next })
          }}
          onMouseEnter={(e) => { if (!localWrap) e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
          onMouseLeave={(e) => { if (!localWrap) e.currentTarget.style.background = '' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.45 }} aria-hidden>
            <path d="M4 3.5h6a2 2 0 0 1 0 4H4M4 7.5l-2 2 2 2M12 12.5H6a2 2 0 0 1 0-4h6M12 8.5l2-2-2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Wrap text
        </button>
      </div>

      <div className="mx-2 border-t" style={{ borderColor: 'var(--leaf-border-soft)' }} />

      {onDelete ? (
        <div className="px-1 pt-0.5">
          <button
            type="button"
            className={menuItemClass}
            style={{ color: 'var(--leaf-red, #ef4444)' }}
            onClick={() => { onDelete(); onClose() }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.55 }} aria-hidden>
              <path d="M5 3V2h6v1M3 4h10M4.5 4v8.5h7V4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
            Delete property
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function DatabaseToolbar({
  activeView,
  onSetView,
  onAddRow,
  gallerySize,
  onSetGallerySize,
}: {
  activeView: ViewType
  onSetView: (view: ViewType) => void
  onAddRow: () => void
  gallerySize?: GallerySize
  onSetGallerySize?: (size: GallerySize) => void
}) {
  const viewIcons: Record<ViewType, React.ReactNode> = {
    table: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="1" width="12" height="12" rx="1.5" />
        <line x1="1" y1="5" x2="13" y2="5" />
        <line x1="5" y1="5" x2="5" y2="13" />
      </svg>
    ),
    board: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="2" width="3" height="10" rx="1" />
        <rect x="5.5" y="4" width="3" height="8" rx="1" />
        <rect x="10" y="1" width="3" height="11" rx="1" />
      </svg>
    ),
    gallery: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="1" width="5" height="5" rx="1" />
        <rect x="8" y="1" width="5" height="5" rx="1" />
        <rect x="1" y="8" width="5" height="5" rx="1" />
        <rect x="8" y="8" width="5" height="5" rx="1" />
      </svg>
    ),
    list: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
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

  const gallerySizes: GallerySize[] = ['small', 'medium', 'large']

  return (
    <div
      className="mb-0 flex items-center justify-between border-b px-2"
      style={{ borderColor: 'var(--leaf-border-soft)' }}
    >
      {/* Flat tab-style view switcher */}
      <div className="flex items-center gap-0 -mb-px">
        {labels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSetView(key)}
            className="flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-2 transition-colors duration-150"
            style={{
              fontSize: 12,
              borderBottomColor: activeView === key ? 'var(--color-primary)' : 'transparent',
              color: activeView === key ? 'var(--leaf-text-title)' : 'var(--leaf-text-muted)',
              fontWeight: activeView === key ? 500 : 400,
            }}
          >
            {viewIcons[key]}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 pb-1">
        {/* Gallery size selector */}
        {activeView === 'gallery' && onSetGallerySize && (
          <div className="mr-2 flex items-center gap-0.5 rounded-md border px-1 py-0.5" style={{ borderColor: 'var(--leaf-border-soft)' }}>
            {gallerySizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onSetGallerySize(size)}
                className="rounded px-1.5 py-0.5 text-[10px] capitalize transition-colors"
                style={{
                  background: gallerySize === size ? 'var(--leaf-db-chrome-hover-strong)' : undefined,
                  color: gallerySize === size ? 'var(--leaf-text-title)' : 'var(--leaf-text-muted)',
                  fontWeight: gallerySize === size ? 500 : 400,
                }}
              >
                {size}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="leaf-db-toolbar-btn flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] transition-colors"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3H10M2.5 5.5H8.5M4 8H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          Filter
        </button>
        <button
          type="button"
          className="leaf-db-toolbar-btn flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] transition-colors"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3L3.5 5.5L6 3M5 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Sort
        </button>
        <button
          type="button"
          className="leaf-db-toolbar-btn flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] transition-colors"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" /><path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          Search
        </button>
        <button
          type="button"
          onClick={onAddRow}
          className="ml-1 flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors"
          style={{ background: 'var(--color-primary)', color: 'var(--leaf-on-accent)' }}
        >
          New
        </button>
      </div>
    </div>
  )
}

export function TableView({
  rows, columns, onUpdateName, onUpdateCell, onDeleteRow, onAddRow, onAddColumn, highlightedRowId, saveColumnDefinition, deleteColumn,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  onAddColumn: () => void
  highlightedRowId?: string | null
  saveColumnDefinition?: (key: string, patch: ColumnDefinitionPatch) => void | Promise<void>
  deleteColumn?: (key: string) => void | Promise<void>
}) {
  const [headerMenuKey, setHeaderMenuKey] = useState<string | null>(null)

  const openHeaderMenu = (key: string) => {
    setHeaderMenuKey((current) => (current === key ? null : key))
  }

  return (
    <div className="overflow-x-auto px-2 pb-2">
      <table className="leaf-db-table w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--leaf-border-soft)' }}>
            <th className="w-56 whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium" style={{ color: 'var(--leaf-text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                  <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Name
              </span>
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`group relative px-3 py-2 text-left text-[11px] font-medium ${column.wrap ? 'align-top' : 'whitespace-nowrap'}`}
                style={{ color: 'var(--leaf-text-muted)', cursor: 'pointer', maxWidth: column.wrap ? 280 : undefined }}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('.leaf-col-menu')) return
                  if ((event.target as HTMLElement).closest('.leaf-col-header-menu-btn')) return
                  openHeaderMenu(column.key)
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <PropertyHeaderGlyph type={column.type} />
                    <span className="truncate">{column.label}</span>
                  </span>
                  <button
                    type="button"
                    className="leaf-col-header-menu-btn shrink-0 rounded px-0.5 text-[15px] leading-none opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: 'var(--leaf-text-muted)' }}
                    aria-label="Column options"
                    onClick={(event) => {
                      event.stopPropagation()
                      openHeaderMenu(column.key)
                    }}
                  >
                    ⋯
                  </button>
                </div>
                {headerMenuKey === column.key && saveColumnDefinition && (
                  <div className="leaf-col-menu">
                    <ColumnHeaderMenu
                      column={column}
                      onSave={(patch) => { void saveColumnDefinition(column.key, patch) }}
                      onClose={() => setHeaderMenuKey(null)}
                      onDelete={deleteColumn ? () => { void deleteColumn(column.key) } : undefined}
                    />
                  </div>
                )}
              </th>
            ))}
            <th className="px-3 py-2 text-left" style={{ color: 'var(--leaf-text-muted)' }}>
              <button
                type="button"
                onClick={onAddColumn}
                className="leaf-db-toolbar-btn flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors"
                style={{ color: 'var(--leaf-text-muted)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                Add property
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isHighlighted = highlightedRowId && row.leaf_id === highlightedRowId.replace('dbrow:', '')
            return (
              <tr
                key={row.id}
                className="group transition-colors duration-75"
                style={{
                  borderBottom: '1px solid var(--leaf-border-soft)',
                  background: isHighlighted ? 'var(--leaf-bg-active)' : undefined,
                }}
                onMouseEnter={(e) => { if (!isHighlighted) e.currentTarget.style.background = 'var(--leaf-db-row-hover)' }}
                onMouseLeave={(e) => { if (!isHighlighted) e.currentTarget.style.background = '' }}
              >
                <td className="px-3 py-2 align-middle">
                  <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
                </td>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2 align-middle ${column.wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}
                    style={{ color: 'var(--leaf-text-body)', maxWidth: column.wrap ? 280 : undefined }}
                  >
                    <Cell value={(row.properties || {})[column.key]} propDef={column} onSave={(value) => onUpdateCell(row.id, column.key, value)} />
                  </td>
                ))}
                <td className="px-3 py-2 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row.id)}
                    className="leaf-db-row-action rounded px-1.5 py-0.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: 'var(--leaf-text-muted)' }}
                  >
                    ···
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={columns.length + 2} className="px-3 py-2">
              <button
                type="button"
                onClick={onAddRow}
                className="leaf-db-toolbar-btn flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] transition-colors"
                style={{ color: 'var(--leaf-text-muted)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                New page
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
    <div className="flex gap-4 overflow-x-auto px-2 py-3 pb-3">
      {groups.map(([group, groupRows]) => (
        <div key={group} className="w-[240px] min-w-[240px] shrink-0">
          <div className="flex items-center justify-between px-0.5 pb-2.5">
            <div className="flex items-center gap-2">
              <StatusPill label={group} tone={classifyTone(group)} compact />
              <span className="text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>{groupRows.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onAddRow} className="h-[22px] w-[22px] rounded-[5px] text-sm leading-none" style={{ color: 'var(--leaf-text-muted)' }}>+</button>
              <button type="button" className="h-[22px] w-[22px] rounded-[5px] text-sm leading-none" style={{ color: 'var(--leaf-text-muted)' }}>...</button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {groupRows.map((row) => (
              <RowPreview
                key={row.id}
                row={row}
                columns={columns}
                coverTone={hashTone(row.id, DB_CARD_COVER_TONES)}
                onUpdateName={onUpdateName}
                onDeleteRow={onDeleteRow}
              />
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
          style={{ color: 'var(--leaf-text-muted)', borderColor: 'var(--leaf-db-board-add-border)', background: 'var(--leaf-db-board-add-bg)' }}
        >
          + New
        </button>
      </div>
    </div>
  )
}

const GALLERY_CONFIG: Record<GallerySize, { cols: string; coverH: number; minH: number }> = {
  small: { cols: 'sm:grid-cols-3 xl:grid-cols-4', coverH: 60, minH: 120 },
  medium: { cols: 'sm:grid-cols-2 xl:grid-cols-3', coverH: 88, minH: 152 },
  large: { cols: 'sm:grid-cols-1 xl:grid-cols-2', coverH: 140, minH: 200 },
}

export function GalleryView({
  rows,
  columns,
  onUpdateName,
  onAddRow,
  gallerySize = 'medium',
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  gallerySize?: GallerySize
}) {
  const statusColumn = getStatusColumn(columns)
  const tagColumn = getTagColumn(columns)
  const estimateColumn = getEstimateColumn(columns)
  const sameStatusTag = statusColumnSameAsTagColumn(statusColumn, tagColumn)
  const config = GALLERY_CONFIG[gallerySize]

  return (
    <div className={`grid gap-3 px-2 py-3 ${config.cols}`}>
      {rows.map((row, index) => {
        const status = statusColumn ? (row.properties || {})[statusColumn.key] : null
        const tone = DB_CARD_COVER_TONES[index % DB_CARD_COVER_TONES.length]
        return (
          <div
            key={row.id}
            className="group overflow-hidden rounded-xl border transition-colors duration-150"
            style={{
              borderColor: 'var(--leaf-border-soft)',
              boxShadow: '0 1px 2px color-mix(in srgb, var(--foreground) 4%, transparent)',
              background: 'var(--leaf-bg-elevated)',
            }}
          >
            <GalleryCover banner={row.leaf_header_banner} fallbackTone={tone} height={config.coverH} />
            <div className="px-3 py-2.5">
              <div className="mb-1.5">
                <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
              </div>
              <div className="flex items-center gap-1.5">
                {sameStatusTag ? (
                  statusColumn!.type === 'tags' ? (
                    <TagChips value={status} compact />
                  ) : (
                    status ? <StatusValue value={status} compact /> : null
                  )
                ) : (
                  <>
                    {status ? <StatusValue value={status} compact /> : null}
                    {tagColumn ? <TagChips value={(row.properties || {})[tagColumn.key]} compact /> : null}
                  </>
                )}
                {estimateColumn ? (
                  <span className="ml-auto text-[10.5px]" style={{ color: 'var(--leaf-text-muted)' }}>
                    # {String((row.properties || {})[estimateColumn.key] || '—')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAddRow}
        className="flex items-center justify-center rounded-xl border border-dashed"
        style={{ minHeight: config.minH, borderColor: 'var(--leaf-border-soft)', background: 'var(--leaf-bg-app)' }}
      >
        <div className="flex flex-col items-center gap-1 text-[11.5px]" style={{ color: 'var(--leaf-text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          New Page
        </div>
      </button>
    </div>
  )
}

export function ListView({
  rows,
  columns,
  onDeleteRow,
  onAddRow,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
}) {
  const { startNavigation } = useNavigationProgress()
  const statusColumn = getStatusColumn(columns)
  const tagColumn = getTagColumn(columns)
  const sameStatusTag = statusColumnSameAsTagColumn(statusColumn, tagColumn)

  return (
    <div className="px-2">
      {rows.map((row) => {
        const status = statusColumn ? (row.properties || {})[statusColumn.key] : null
        return (
          <div
            key={row.id}
            className="group flex items-center gap-3 border-b px-2 py-2.5 transition-colors duration-150"
            style={{ borderBottomColor: 'var(--leaf-border-soft)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50">
              <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
              <path d="M8.9 2.75V5.55H11.75" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
            </svg>
            <Link
              href={row.leaf_id ? `/editor/${row.leaf_id}` : '#'}
              className="flex-1 truncate text-sm font-medium"
              style={{ color: 'var(--leaf-text-title)' }}
              onClick={() => startNavigation()}
              onMouseEnter={() => { void warmEditorRoute() }}
            >
              {row.leaf_title || 'Untitled'}
            </Link>
            <div className="flex items-center gap-2">
              {sameStatusTag ? (
                statusColumn!.type === 'tags' ? (
                  <TagChips value={status} compact />
                ) : (
                  status ? <StatusValue value={status} compact /> : null
                )
              ) : (
                <>
                  {tagColumn ? <TagChips value={(row.properties || {})[tagColumn.key]} compact /> : null}
                  {status ? <StatusValue value={status} compact /> : null}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDeleteRow(row.id)}
              className="text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--leaf-text-muted)' }}
            >
              ...
            </button>
          </div>
        )
      })}
      <div className="px-2 py-2.5">
        <button
          type="button"
          onClick={onAddRow}
          className="text-[12.5px]"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          + New
        </button>
      </div>
    </div>
  )
}
