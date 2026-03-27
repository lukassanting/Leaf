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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import type { DatabaseRow, GallerySize, LeafHeaderBanner, PropertyDefinition, ViewType } from '@/lib/api'
import { TagsOptionCell, StatusOptionCell, chipVar, normalizeChipColor, type OptionColumnActions } from '@/components/database/optionPickers'

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

/** Board group label may come from status or tags column — pick the one that defines this label in `options`. */
function columnForBoardGroup(columns: PropertyDefinition[], group: string): PropertyDefinition | null {
  const statusColumn = getStatusColumn(columns)
  const tagColumn = getTagColumn(columns)
  if (statusColumn?.options?.some((o) => o.label === group)) return statusColumn
  if (tagColumn?.options?.some((o) => o.label === group)) return tagColumn
  return statusColumn ?? tagColumn
}


function classifyTone(raw: string): 'green' | 'blue' | 'amber' | 'red' | 'muted' {
  const value = raw.toLowerCase()
  if (/(done|complete|completed|published)/.test(value)) return 'green'
  if (/(in progress|progress|doing|review|blocked)/.test(value)) return 'blue'
  if (/(soon|planned|todo|to do)/.test(value)) return 'amber'
  if (/(risk|urgent|stuck|bug|ai|cancelled)/.test(value)) return 'red'
  return 'muted'
}

/** Maps tag label → slot 0–7; colours are `globals.css` `--leaf-db-tag-{n}-{bg,fg,border}` (classic + campaign). */
function tagChipSlot(label: string): number {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return h % 8
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
function TagPill({ label, column, compact = false }: { label: string; column?: PropertyDefinition; compact?: boolean }) {
  const opt = column?.options?.find((o) => o.label === label)
  if (opt) {
    const c = normalizeChipColor(opt.color)
    return (
      <span
        className="inline-flex items-center border"
        style={{
          background: chipVar(c, 'bg'),
          color: chipVar(c, 'fg'),
          borderColor: chipVar(c, 'border'),
          fontSize: compact ? 10 : 10.5,
          padding: compact ? '1px 6px' : '2px 8px',
          borderRadius: 4,
        }}
      >
        {label}
      </span>
    )
  }
  const slot = tagChipSlot(label)
  const v = (suffix: string) => `var(--leaf-db-tag-${slot}-${suffix})`
  return (
    <span
      className="inline-flex items-center border"
      style={{
        background: v('bg'),
        color: v('fg'),
        borderColor: v('border'),
        fontSize: compact ? 10 : 10.5,
        padding: compact ? '1px 6px' : '2px 8px',
        borderRadius: 4,
      }}
    >
      {label}
    </span>
  )
}

function TagChips({ value, column, compact = false }: { value: unknown; column?: PropertyDefinition; compact?: boolean }) {
  const tags = parseTagValues(value)
  if (!tags.length) return <span className="text-xs" style={{ color: 'var(--leaf-text-hint)' }}>—</span>

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <TagPill key={tag} label={tag} column={column} compact={compact} />
      ))}
    </div>
  )
}

function StatusValue({ value, column, compact = false }: { value: unknown; column?: PropertyDefinition; compact?: boolean }) {
  if (!value) return <span className="text-xs" style={{ color: 'var(--leaf-text-hint)' }}>—</span>
  const label = String(value)
  const opt = column?.options?.find((o) => o.label === label)
  if (opt) {
    const c = normalizeChipColor(opt.color)
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border"
        style={{
          background: chipVar(c, 'bg'),
          color: chipVar(c, 'fg'),
          borderColor: chipVar(c, 'border'),
          fontSize: compact ? 10 : 10.5,
          padding: compact ? '1px 8px 1px 6px' : '2px 10px 2px 7px',
        }}
      >
        <span className="inline-block shrink-0 rounded-full" style={{ width: 6, height: 6, background: chipVar(c, 'fg') }} />
        {label}
      </span>
    )
  }
  const tone = classifyTone(label)
  return <StatusPill label={label} tone={tone} compact={compact} />
}

/** Board column header: use schema option colour when the group label matches an option. */
function GroupHeaderPill({ label, column }: { label: string; column: PropertyDefinition | null }) {
  const opt = column?.options?.find((o) => o.label === label)
  if (opt) {
    const c = normalizeChipColor(opt.color)
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border"
        style={{
          background: chipVar(c, 'bg'),
          color: chipVar(c, 'fg'),
          borderColor: chipVar(c, 'border'),
          fontSize: 10,
          padding: '1px 8px 1px 6px',
        }}
      >
        <span className="inline-block shrink-0 rounded-full" style={{ width: 6, height: 6, background: chipVar(c, 'fg') }} />
        {label}
      </span>
    )
  }
  return <StatusPill label={label} tone={classifyTone(label)} compact />
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
  if (column.type === 'tags') return <TagChips value={value} column={column} compact={compact} />
  if (column.type === 'select') return <StatusValue value={value} column={column} compact={compact} />
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
  if (/status/i.test(column.key) || /status/i.test(column.label)) return <StatusValue value={value} column={column} compact={compact} />
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
  rowId,
  onSave,
  optionColumnActions,
}: {
  value: unknown
  propDef: PropertyDefinition
  rowId: string
  onSave: (val: string) => void
  optionColumnActions?: OptionColumnActions | null
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

  if ((propDef.type === 'tags' || propDef.type === 'select') && optionColumnActions) {
    if (propDef.type === 'tags') {
      return (
        <TagsOptionCell column={propDef} value={value} rowId={rowId} actions={optionColumnActions}>
          {renderPropertyValue(propDef, value)}
        </TagsOptionCell>
      )
    }
    return (
      <StatusOptionCell column={propDef} value={value} rowId={rowId} actions={optionColumnActions}>
        {renderPropertyValue(propDef, value)}
      </StatusOptionCell>
    )
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

/** All schema columns with editable cells (matches table semantics). */
function PropertyColumnList({
  row,
  columns,
  onUpdateCell,
  optionColumnActions,
}: {
  row: DatabaseRow
  columns: PropertyDefinition[]
  onUpdateCell: (rowId: string, key: string, val: string) => void
  optionColumnActions?: OptionColumnActions | null
}) {
  if (!columns.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      {columns.map((col) => (
        <div key={col.key} className="flex items-start gap-2">
          <span
            className="shrink-0 text-[10px] font-medium leading-[18px] pt-0.5"
            style={{ color: 'var(--leaf-text-hint)', minWidth: 56, maxWidth: 100 }}
          >
            {col.label}
          </span>
          <div className="min-w-0 flex-1">
            <Cell
              value={(row.properties || {})[col.key]}
              propDef={col}
              rowId={row.id}
              onSave={(v) => onUpdateCell(row.id, col.key, v)}
              optionColumnActions={optionColumnActions}
            />
          </div>
        </div>
      ))}
    </div>
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
  onUpdateCell,
  onDeleteRow,
  optionColumnActions,
}: {
  row: DatabaseRow
  columns: PropertyDefinition[]
  coverTone: string
  coverHeight?: number
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  optionColumnActions?: OptionColumnActions | null
}) {
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
      <PropertyColumnList
        row={row}
        columns={columns}
        onUpdateCell={onUpdateCell}
        optionColumnActions={optionColumnActions}
      />
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

/** Fixed-position portal below `anchorEl` so the menu is not clipped by table overflow-x. */
export function ColumnHeaderMenu({
  column,
  anchorEl,
  onSave,
  onClose,
  onDelete,
}: {
  column: PropertyDefinition
  anchorEl: HTMLElement | null
  onSave: (patch: ColumnDefinitionPatch) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const [label, setLabel] = useState(column.label)
  const [localType, setLocalType] = useState(column.type)
  const [localWrap, setLocalWrap] = useState(column.wrap ?? false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const recomputePos = useCallback(() => {
    if (!anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    const menuWidth = Math.min(280, window.innerWidth - 24)
    let left = r.left
    const top = r.bottom + 4
    left = Math.min(left, window.innerWidth - menuWidth - 8)
    left = Math.max(8, left)
    setPos({ top, left })
  }, [anchorEl])

  useEffect(() => {
    setLabel(column.label)
    setLocalType(column.type)
    setLocalWrap(column.wrap ?? false)
    setShowTypeMenu(false)
  }, [column])

  useLayoutEffect(() => {
    recomputePos()
  }, [recomputePos])

  useEffect(() => {
    if (!anchorEl) return
    window.addEventListener('scroll', recomputePos, true)
    window.addEventListener('resize', recomputePos)
    return () => {
      window.removeEventListener('scroll', recomputePos, true)
      window.removeEventListener('resize', recomputePos)
    }
  }, [anchorEl, recomputePos])

  useEffect(() => { inputRef.current?.select() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchorEl?.contains(t)) return
      if (label.trim() && label.trim() !== column.label) {
        onSave({ label: label.trim(), type: localType, wrap: localWrap })
      }
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [label, column.label, column.key, localType, localWrap, onSave, onClose, anchorEl])

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

  const menu = (
    <div
      ref={ref}
      className="leaf-col-menu fixed z-[9999] w-[min(280px,calc(100vw-24px))] rounded-xl border py-1.5 shadow-lg"
      style={{
        top: pos.top,
        left: pos.left,
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

  if (typeof document === 'undefined' || !anchorEl) return null
  return createPortal(menu, document.body)
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

function bindDbTableColumnResize(
  e: React.PointerEvent,
  onDelta: (dx: number) => void,
  onEnd: () => void,
) {
  e.preventDefault()
  e.stopPropagation()
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  let lastX = e.clientX
  const move = (ev: PointerEvent) => {
    onDelta(ev.clientX - lastX)
    lastX = ev.clientX
  }
  const up = () => {
    target.releasePointerCapture(e.pointerId)
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
    onEnd()
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

function SortableDatabaseTableRow({
  id,
  row,
  columns,
  highlightedRowId,
  onUpdateName,
  onUpdateCell,
  onDeleteRow,
  optionColumnActions,
  nameColumnPx,
  propertyColumnWidths,
}: {
  id: string
  row: DatabaseRow
  columns: PropertyDefinition[]
  highlightedRowId?: string | null
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  optionColumnActions?: OptionColumnActions | null
  nameColumnPx: number
  propertyColumnWidths: Record<string, number>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const isHighlighted = Boolean(highlightedRowId && row.leaf_id === highlightedRowId.replace('dbrow:', ''))
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    borderBottom: '1px solid var(--leaf-border-soft)',
    background: isHighlighted ? 'var(--leaf-bg-active)' as const : undefined,
  }
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="group transition-colors duration-75"
      onMouseEnter={(e) => { if (!isHighlighted) e.currentTarget.style.background = 'var(--leaf-db-row-hover)' }}
      onMouseLeave={(e) => { if (!isHighlighted) e.currentTarget.style.background = '' }}
    >
      <td className="w-8 px-1 align-middle" {...attributes}>
        <button
          type="button"
          className="cursor-grab touch-none rounded px-0.5 py-1 text-[10px] opacity-50 hover:opacity-90"
          style={{ color: 'var(--leaf-text-muted)' }}
          {...listeners}
          aria-label="Drag to reorder row"
        >
          ⋮⋮
        </button>
      </td>
      <td
        className="px-3 py-2 align-middle"
        style={{ width: nameColumnPx, minWidth: 72, maxWidth: 560, verticalAlign: 'middle' }}
      >
        <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
      </td>
      {columns.map((column) => (
        <td
          key={column.key}
          className={`px-3 py-2 align-middle ${column.wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}
          style={{
            color: 'var(--leaf-text-body)',
            width: propertyColumnWidths[column.key] ?? 140,
            minWidth: 72,
            maxWidth: 560,
            verticalAlign: 'middle',
          }}
        >
          <Cell
            value={(row.properties || {})[column.key]}
            propDef={column}
            rowId={row.id}
            onSave={(value) => onUpdateCell(row.id, column.key, value)}
            optionColumnActions={optionColumnActions}
          />
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
}

export function TableView({
  rows, columns, onUpdateName, onUpdateCell, onDeleteRow, onAddRow, onAddColumn, highlightedRowId, saveColumnDefinition, deleteColumn,
  optionColumnActions,
  onReorderRows,
  nameColumnWidth,
  onColumnWidthsCommit,
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
  optionColumnActions?: OptionColumnActions | null
  onReorderRows?: (rowIds: string[]) => void | Promise<void>
  /** Persisted table view width for the Name column (px). */
  nameColumnWidth?: number | null
  /** Persist widths after the user finishes dragging a column edge. */
  onColumnWidthsCommit?: (payload: { nameColumnWidth: number; columnWidths: Record<string, number> }) => void | Promise<void>
}) {
  const [headerMenu, setHeaderMenu] = useState<{ key: string; anchor: HTMLElement } | null>(null)
  const colWidthSig = useMemo(() => columns.map((c) => `${c.key}:${c.width ?? ''}`).join('|'), [columns])
  const [tableWidths, setTableWidths] = useState(() => ({
    name: nameColumnWidth ?? 224,
    cols: Object.fromEntries(columns.map((c) => [c.key, c.width ?? 140])) as Record<string, number>,
  }))
  const schemaWidthsRef = useRef({ name: nameColumnWidth ?? null, sig: '' as string })
  useEffect(() => {
    const sn = nameColumnWidth ?? null
    if (schemaWidthsRef.current.name === sn && schemaWidthsRef.current.sig === colWidthSig) return
    schemaWidthsRef.current = { name: sn, sig: colWidthSig }
    setTableWidths({
      name: nameColumnWidth ?? 224,
      cols: Object.fromEntries(columns.map((c) => [c.key, c.width ?? 140])),
    })
  }, [nameColumnWidth, colWidthSig, columns])

  const tableWidthsLiveRef = useRef(tableWidths)
  tableWidthsLiveRef.current = tableWidths

  const commitWidthsIfNeeded = useCallback(() => {
    if (!onColumnWidthsCommit) return
    const { name, cols: columnWidths } = tableWidthsLiveRef.current
    const schemaName = nameColumnWidth ?? 224
    const schemaCols = Object.fromEntries(columns.map((c) => [c.key, c.width ?? 140]))
    const nameChanged = Math.round(name) !== Math.round(schemaName)
    const colsChanged = columns.some((c) => Math.round(columnWidths[c.key] ?? 140) !== Math.round(schemaCols[c.key] ?? 140))
    if (nameChanged || colsChanged) {
      const roundedCols = Object.fromEntries(
        Object.entries(columnWidths).map(([k, v]) => [k, Math.round(Number(v))]),
      )
      void onColumnWidthsCommit({ nameColumnWidth: Math.round(name), columnWidths: roundedCols })
    }
  }, [columns, nameColumnWidth, onColumnWidthsCommit])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onTableDragEnd = (event: DragEndEvent) => {
    if (!onReorderRows) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = rows.map((r) => r.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(ids, oldIndex, newIndex)
    void onReorderRows(next)
  }

  const openHeaderMenu = (key: string, anchor: HTMLElement) => {
    setHeaderMenu((current) => (current?.key === key ? null : { key, anchor }))
  }

  const headerMenuColumn = headerMenu ? columns.find((c) => c.key === headerMenu.key) : undefined

  const showResize = Boolean(onColumnWidthsCommit)

  const tableInner = (
      <table className="leaf-db-table w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--leaf-border-soft)' }}>
            {onReorderRows ? (
              <th className="w-8 px-1 py-2" aria-hidden style={{ color: 'var(--leaf-text-muted)' }} />
            ) : null}
            <th
              className="relative whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium"
              style={{
                color: 'var(--leaf-text-muted)',
                width: tableWidths.name,
                minWidth: 72,
                maxWidth: 560,
              }}
            >
              <span className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                  <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Name
              </span>
              {showResize ? (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize name column"
                  className="leaf-db-table-resize-handle"
                  onPointerDown={(e) => bindDbTableColumnResize(e, (dx) => {
                    setTableWidths((w) => ({
                      ...w,
                      name: Math.min(560, Math.max(120, w.name + dx)),
                    }))
                  }, commitWidthsIfNeeded)}
                />
              ) : null}
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`group relative px-3 py-2 text-left text-[11px] font-medium ${column.wrap ? 'align-top' : 'whitespace-nowrap'}`}
                style={{
                  color: 'var(--leaf-text-muted)',
                  cursor: 'pointer',
                  width: tableWidths.cols[column.key] ?? 140,
                  minWidth: 72,
                  maxWidth: 560,
                }}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('.leaf-db-table-resize-handle, .leaf-col-header-menu-btn')) return
                  openHeaderMenu(column.key, event.currentTarget)
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
                      const th = (event.currentTarget as HTMLElement).closest('th')
                      if (th) openHeaderMenu(column.key, th)
                    }}
                  >
                    ⋯
                  </button>
                </div>
                {showResize ? (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${column.label} column`}
                    className="leaf-db-table-resize-handle"
                    onPointerDown={(e) => bindDbTableColumnResize(e, (dx) => {
                      setTableWidths((w) => ({
                        ...w,
                        cols: {
                          ...w.cols,
                          [column.key]: Math.min(560, Math.max(72, (w.cols[column.key] ?? 140) + dx)),
                        },
                      }))
                    }, commitWidthsIfNeeded)}
                  />
                ) : null}
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
        {onReorderRows ? (
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {rows.map((row) => (
                <SortableDatabaseTableRow
                  key={row.id}
                  id={row.id}
                  row={row}
                  columns={columns}
                  highlightedRowId={highlightedRowId}
                  onUpdateName={onUpdateName}
                  onUpdateCell={onUpdateCell}
                  onDeleteRow={onDeleteRow}
                  optionColumnActions={optionColumnActions}
                  nameColumnPx={tableWidths.name}
                  propertyColumnWidths={tableWidths.cols}
                />
              ))}
            </tbody>
          </SortableContext>
        ) : (
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
                  <td
                    className="px-3 py-2 align-middle"
                    style={{ width: tableWidths.name, minWidth: 72, maxWidth: 560, verticalAlign: 'middle' }}
                  >
                    <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 align-middle ${column.wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}
                      style={{
                        color: 'var(--leaf-text-body)',
                        width: tableWidths.cols[column.key] ?? 140,
                        minWidth: 72,
                        maxWidth: 560,
                        verticalAlign: 'middle',
                      }}
                    >
                      <Cell
                        value={(row.properties || {})[column.key]}
                        propDef={column}
                        rowId={row.id}
                        onSave={(value) => onUpdateCell(row.id, column.key, value)}
                        optionColumnActions={optionColumnActions}
                      />
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
        )}
        <tfoot>
          <tr>
            <td colSpan={columns.length + 2 + (onReorderRows ? 1 : 0)} className="px-3 py-2">
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
  )

  const scrollShell = (
    <div className="overflow-x-auto px-2 pb-2">
      {headerMenu && headerMenuColumn && saveColumnDefinition ? (
        <ColumnHeaderMenu
          anchorEl={headerMenu.anchor}
          column={headerMenuColumn}
          onSave={(patch) => { void saveColumnDefinition(headerMenuColumn.key, patch) }}
          onClose={() => setHeaderMenu(null)}
          onDelete={deleteColumn ? () => { void deleteColumn(headerMenuColumn.key) } : undefined}
        />
      ) : null}
      {tableInner}
    </div>
  )

  if (onReorderRows) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTableDragEnd}>
        {scrollShell}
      </DndContext>
    )
  }

  return scrollShell
}

const BOARD_COL_PREFIX = 'board-col:'

function boardColumnDropId(group: string) {
  return `${BOARD_COL_PREFIX}${encodeURIComponent(group)}`
}

function parseBoardColumnDropId(overId: string): string | null {
  if (!overId.startsWith(BOARD_COL_PREFIX)) return null
  return decodeURIComponent(overId.slice(BOARD_COL_PREFIX.length))
}

function BoardDraggableCard({
  row,
  columns,
  coverTone,
  onUpdateName,
  onUpdateCell,
  onDeleteRow,
  optionColumnActions,
}: {
  row: DatabaseRow
  columns: PropertyDefinition[]
  coverTone: string
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  optionColumnActions?: OptionColumnActions | null
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id })
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="flex gap-0.5">
        <button
          type="button"
          className="mt-2 h-6 w-5 shrink-0 cursor-grab touch-none rounded text-[10px] opacity-35 hover:opacity-70"
          style={{ color: 'var(--leaf-text-muted)' }}
          {...listeners}
          {...attributes}
          aria-label="Drag to another column"
        >
          ⋮⋮
        </button>
        <div className="min-w-0 flex-1">
          <RowPreview
            row={row}
            columns={columns}
            coverTone={coverTone}
            onUpdateName={onUpdateName}
            onUpdateCell={onUpdateCell}
            onDeleteRow={onDeleteRow}
            optionColumnActions={optionColumnActions}
          />
        </div>
      </div>
    </div>
  )
}

function BoardKanbanColumn({ group, children }: { group: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: boardColumnDropId(group) })
  return (
    <div
      ref={setNodeRef}
      className="rounded-lg px-0.5 py-0.5 transition-colors"
      style={{
        background: isOver ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : undefined,
        minHeight: 24,
      }}
    >
      {children}
    </div>
  )
}

export function BoardView({
  rows, columns, onUpdateName, onUpdateCell, onUpdateCellValue, onDeleteRow, onAddRow, optionColumnActions,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onUpdateCellValue: (rowId: string, key: string, value: unknown) => void | Promise<void>
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  optionColumnActions?: OptionColumnActions | null
}) {
  const statusColumn = getStatusColumn(columns)
  const tagColumn = getTagColumn(columns)
  const boardDnDEnabled = Boolean(statusColumn || tagColumn)
  const boardSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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

  const onBoardDragEnd = (event: DragEndEvent) => {
    if (!boardDnDEnabled) return
    const { active, over } = event
    if (!over) return
    const group = parseBoardColumnDropId(String(over.id))
    if (group === null) return
    const rowId = String(active.id)
    if (statusColumn) {
      void onUpdateCellValue(rowId, statusColumn.key, group)
    } else if (tagColumn) {
      void onUpdateCellValue(rowId, tagColumn.key, [group])
    }
  }

  const boardBody = (
    <div className="flex gap-4 overflow-x-auto px-2 py-3 pb-3">
      {groups.map(([group, groupRows]) => (
        <div key={group} className="w-[240px] min-w-[240px] shrink-0">
          <div className="flex items-center justify-between px-0.5 pb-2.5">
            <div className="flex items-center gap-2">
              <GroupHeaderPill label={group} column={columnForBoardGroup(columns, group)} />
              <span className="text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>{groupRows.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onAddRow} className="h-[22px] w-[22px] rounded-[5px] text-sm leading-none" style={{ color: 'var(--leaf-text-muted)' }}>+</button>
              <button type="button" className="h-[22px] w-[22px] rounded-[5px] text-sm leading-none" style={{ color: 'var(--leaf-text-muted)' }}>...</button>
            </div>
          </div>
          <BoardKanbanColumn group={group}>
            <div className="flex flex-col gap-2">
              {groupRows.map((row) =>
                boardDnDEnabled ? (
                  <BoardDraggableCard
                    key={row.id}
                    row={row}
                    columns={columns}
                    coverTone={hashTone(row.id, DB_CARD_COVER_TONES)}
                    onUpdateName={onUpdateName}
                    onUpdateCell={onUpdateCell}
                    onDeleteRow={onDeleteRow}
                    optionColumnActions={optionColumnActions}
                  />
                ) : (
                  <RowPreview
                    key={row.id}
                    row={row}
                    columns={columns}
                    coverTone={hashTone(row.id, DB_CARD_COVER_TONES)}
                    onUpdateName={onUpdateName}
                    onUpdateCell={onUpdateCell}
                    onDeleteRow={onDeleteRow}
                    optionColumnActions={optionColumnActions}
                  />
                )
              )}
              <button
                type="button"
                onClick={onAddRow}
                className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-xs"
                style={{ color: 'var(--leaf-text-muted)' }}
              >
                + New
              </button>
            </div>
          </BoardKanbanColumn>
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

  if (boardDnDEnabled) {
    return (
      <DndContext sensors={boardSensors} collisionDetection={closestCorners} onDragEnd={onBoardDragEnd}>
        {boardBody}
      </DndContext>
    )
  }
  return boardBody
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
  onUpdateCell,
  onAddRow,
  optionColumnActions,
  gallerySize = 'medium',
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  optionColumnActions?: OptionColumnActions | null
  gallerySize?: GallerySize
}) {
  const config = GALLERY_CONFIG[gallerySize]

  return (
    <div className={`grid gap-3 px-2 py-3 ${config.cols}`}>
      {rows.map((row, index) => {
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
              <PropertyColumnList
                row={row}
                columns={columns}
                onUpdateCell={onUpdateCell}
                optionColumnActions={optionColumnActions}
              />
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

function SortableDatabaseListRow({
  id,
  row,
  columns,
  onUpdateName,
  onUpdateCell,
  onDeleteRow,
  optionColumnActions,
}: {
  id: string
  row: DatabaseRow
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  optionColumnActions?: OptionColumnActions | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    borderBottom: '1px solid var(--leaf-border-soft)',
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group px-2 py-3 transition-colors duration-150"
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none rounded px-0.5 py-1 text-[10px] opacity-50 hover:opacity-90"
          style={{ color: 'var(--leaf-text-muted)' }}
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder row"
        >
          ⋮⋮
        </button>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50">
          <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
          <path d="M8.9 2.75V5.55H11.75" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
        </div>
        <button
          type="button"
          onClick={() => onDeleteRow(row.id)}
          className="shrink-0 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          ...
        </button>
      </div>
      <PropertyColumnList
        row={row}
        columns={columns}
        onUpdateCell={onUpdateCell}
        optionColumnActions={optionColumnActions}
      />
    </div>
  )
}

export function ListView({
  rows,
  columns,
  onUpdateName,
  onUpdateCell,
  onDeleteRow,
  onAddRow,
  optionColumnActions,
  onReorderRows,
}: {
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  onUpdateName: (rowId: string, title: string) => void
  onUpdateCell: (rowId: string, key: string, val: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  optionColumnActions?: OptionColumnActions | null
  onReorderRows?: (rowIds: string[]) => void | Promise<void>
}) {
  const listSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onListDragEnd = (event: DragEndEvent) => {
    if (!onReorderRows) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = rows.map((r) => r.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    void onReorderRows(arrayMove(ids, oldIndex, newIndex))
  }

  const footer = (
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
  )

  if (onReorderRows) {
    return (
      <div className="px-2">
        <DndContext sensors={listSensors} collisionDetection={closestCenter} onDragEnd={onListDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            {rows.map((row) => (
              <SortableDatabaseListRow
                key={row.id}
                id={row.id}
                row={row}
                columns={columns}
                onUpdateName={onUpdateName}
                onUpdateCell={onUpdateCell}
                onDeleteRow={onDeleteRow}
                optionColumnActions={optionColumnActions}
              />
            ))}
          </SortableContext>
        </DndContext>
        {footer}
      </div>
    )
  }

  return (
    <div className="px-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="group border-b px-2 py-3 transition-colors duration-150"
          style={{ borderBottomColor: 'var(--leaf-border-soft)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
        >
          <div className="mb-2 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50">
              <path d="M4.5 2.75H9.1L11.75 5.38V13.25H4.5V2.75Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
              <path d="M8.9 2.75V5.55H11.75" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
            </svg>
            <div className="min-w-0 flex-1">
              <NameCell row={row} onSave={(title) => onUpdateName(row.id, title)} />
            </div>
            <button
              type="button"
              onClick={() => onDeleteRow(row.id)}
              className="shrink-0 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--leaf-text-muted)' }}
            >
              ...
            </button>
          </div>
          <PropertyColumnList
            row={row}
            columns={columns}
            onUpdateCell={onUpdateCell}
            optionColumnActions={optionColumnActions}
          />
        </div>
      ))}
      {footer}
    </div>
  )
}
