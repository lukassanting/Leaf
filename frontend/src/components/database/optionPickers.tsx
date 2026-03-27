/**
 * Notion-style tag (multi) and status (single) pickers with option rename, delete, and chip colours.
 * Option metadata lives on `PropertyDefinition.options` in the database schema.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { DatabaseChipColor, PropertyDefinition, PropertyOption } from '@/lib/api'

/** Computes fixed position for a dropdown below its trigger element. */
function useDropdownPosition(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const recompute = useCallback(() => {
    if (!open || !triggerRef.current) { setPos(null); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
  }, [open, triggerRef])
  useEffect(() => { recompute() }, [recompute])
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', recompute, true)
    window.addEventListener('resize', recompute)
    return () => { window.removeEventListener('scroll', recompute, true); window.removeEventListener('resize', recompute) }
  }, [open, recompute])
  return pos
}

export const DATABASE_CHIP_COLORS: { key: DatabaseChipColor; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'gray', label: 'Gray' },
  { key: 'brown', label: 'Brown' },
  { key: 'orange', label: 'Orange' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'blue', label: 'Blue' },
  { key: 'purple', label: 'Purple' },
  { key: 'pink', label: 'Pink' },
  { key: 'red', label: 'Red' },
]

export function normalizeChipColor(c: string | undefined): DatabaseChipColor {
  if (c && DATABASE_CHIP_COLORS.some((x) => x.key === c)) return c as DatabaseChipColor
  return 'default'
}

export function chipVar(color: DatabaseChipColor, part: 'bg' | 'fg' | 'border'): string {
  return `var(--leaf-db-chip-${color}-${part})`
}

export type OptionColumnActions = {
  setColumnOptions: (columnKey: string, options: PropertyOption[]) => Promise<void>
  renameColumnOption: (columnKey: string, optionId: string, newLabel: string) => Promise<void>
  deleteColumnOption: (columnKey: string, optionId: string) => Promise<void>
  updateCellValue: (rowId: string, columnKey: string, value: unknown) => Promise<void>
}

function parseTagValues(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string' && value) {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  }
  return []
}

function MiniTagChip({ label, color }: { label: string; color: DatabaseChipColor }) {
  return (
    <span
      className="inline-flex max-w-full items-center truncate border"
      style={{
        background: chipVar(color, 'bg'),
        color: chipVar(color, 'fg'),
        borderColor: chipVar(color, 'border'),
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 4,
      }}
    >
      {label}
    </span>
  )
}

function MiniStatusChip({ label, color }: { label: string; color: DatabaseChipColor }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 truncate rounded-full border"
      style={{
        background: chipVar(color, 'bg'),
        color: chipVar(color, 'fg'),
        borderColor: chipVar(color, 'border'),
        fontSize: 10,
        padding: '1px 8px 1px 6px',
      }}
    >
      <span className="inline-block shrink-0 rounded-full" style={{ width: 6, height: 6, background: chipVar(color, 'fg') }} />
      {label}
    </span>
  )
}

function OptionEditorPanel({
  columnKey,
  option,
  allOptions,
  onClose,
  actions,
}: {
  columnKey: string
  option: PropertyOption
  allOptions: PropertyOption[]
  onClose: () => void
  actions: OptionColumnActions
}) {
  const [labelDraft, setLabelDraft] = useState(option.label)
  const color = normalizeChipColor(option.color)

  useEffect(() => {
    setLabelDraft(option.label)
  }, [option.id, option.label])

  const applyColor = async (next: DatabaseChipColor) => {
    const nextOpts = allOptions.map((o) => (o.id === option.id ? { ...o, color: next } : o))
    await actions.setColumnOptions(columnKey, nextOpts)
  }

  const commitRename = async () => {
    const t = labelDraft.trim()
    if (t && t !== option.label) await actions.renameColumnOption(columnKey, option.id, t)
  }

  const remove = async () => {
    await actions.deleteColumnOption(columnKey, option.id)
    onClose()
  }

  return (
    <div
      className="flex w-[200px] shrink-0 flex-col border-l py-2 pl-2 pr-1"
      style={{ borderColor: 'var(--leaf-border-soft)' }}
    >
      <div className="mb-2 flex items-center gap-1 px-1">
        <input
          className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-[12px] focus:outline-none"
          style={{ borderColor: 'var(--leaf-border-strong)', background: 'var(--leaf-bg-subtle)', color: 'var(--leaf-text-title)' }}
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => { void commitRename() }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') onClose()
          }}
        />
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-semibold"
          style={{ color: 'var(--leaf-text-muted)', border: '1px solid var(--leaf-border-soft)' }}
          title={`Option id: ${option.id}`}
        >
          i
        </span>
      </div>
      <button
        type="button"
        className="mb-2 rounded-md px-2 py-1.5 text-left text-[12px]"
        style={{ color: '#dc2626' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
        onClick={() => { void remove() }}
      >
        Delete
      </button>
      <div className="px-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>
        Colours
      </div>
      <div className="mt-1 max-h-[200px] overflow-y-auto pr-0.5">
        {DATABASE_CHIP_COLORS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className="mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]"
            style={{ color: 'var(--leaf-text-body)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
            onClick={() => { void applyColor(key) }}
          >
            <span
              className="h-4 w-4 shrink-0 rounded border"
              style={{
                background: chipVar(key, 'bg'),
                borderColor: chipVar(key, 'border'),
              }}
            />
            <span className="flex-1">{label}</span>
            {key === color ? <span style={{ color: 'var(--color-primary)' }}>✓</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TagsOptionCell({
  column,
  value,
  rowId,
  actions,
  children,
}: {
  column: PropertyDefinition
  value: unknown
  rowId: string
  actions: OptionColumnActions
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const options = useMemo(() => column.options ?? [], [column.options])
  const selected = useMemo(() => parseTagValues(value), [value])
  const pos = useDropdownPosition(rootRef, open)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setOpen(false)
      setEditingId(null)
      setFilter('')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, filter])

  const canCreate = filter.trim() && !options.some((o) => o.label.toLowerCase() === filter.trim().toLowerCase())

  const ensureAndToggle = async (label: string, add: boolean) => {
    let opts = [...options]
    if (!opts.some((o) => o.label === label)) {
      opts = [...opts, { id: crypto.randomUUID(), label, color: 'default' }]
      await actions.setColumnOptions(column.key, opts)
    }
    const cur = parseTagValues(value)
    const next = add ? (cur.includes(label) ? cur : [...cur, label]) : cur.filter((t) => t !== label)
    await actions.updateCellValue(rowId, column.key, next)
  }

  const addFromFilter = async () => {
    const t = filter.trim()
    if (!t) return
    await ensureAndToggle(t, true)
    setFilter('')
  }

  const editing = editingId ? options.find((o) => o.id === editingId) : null

  return (
    <div ref={rootRef} className="relative min-h-[1.5rem] w-full">
      <button type="button" className="block w-full cursor-pointer text-left" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && pos ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] flex rounded-xl border shadow-lg"
          style={{
            top: pos.top,
            left: pos.left,
            background: 'var(--leaf-bg-elevated)',
            borderColor: 'var(--leaf-border-strong)',
            boxShadow: 'var(--leaf-shadow-soft)',
          }}
        >
          <div className="flex w-56 flex-col py-2 pl-2 pr-1">
            <div className="mb-2 flex flex-wrap gap-1 px-1">
              {selected.map((tag) => {
                const opt = options.find((o) => o.label === tag)
                const col = normalizeChipColor(opt?.color)
                return (
                  <span key={tag} className="inline-flex items-center gap-0.5">
                    <MiniTagChip label={tag} color={col} />
                    <button
                      type="button"
                      className="rounded px-0.5 text-[10px] leading-none"
                      style={{ color: 'var(--leaf-text-muted)' }}
                      aria-label={`Remove ${tag}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        void ensureAndToggle(tag, false)
                      }}
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
            <input
              className="mb-2 rounded-md border px-2 py-1.5 text-[12px] focus:outline-none"
              style={{ borderColor: 'var(--leaf-border-soft)', background: 'var(--leaf-bg-subtle)' }}
              placeholder="Select an option or create one"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canCreate) void addFromFilter()
                  else if (filtered.length === 1) void ensureAndToggle(filtered[0].label, !selected.includes(filtered[0].label))
                }
              }}
            />
            <div className="max-h-52 overflow-y-auto">
              {canCreate ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]"
                  style={{ color: 'var(--leaf-text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                  onClick={() => { void addFromFilter() }}
                >
                  Create &ldquo;{filter.trim()}&rdquo;
                </button>
              ) : null}
              {filtered.map((opt) => {
                const on = selected.includes(opt.label)
                const col = normalizeChipColor(opt.color)
                return (
                  <div
                    key={opt.id}
                    className="flex items-center gap-1 rounded-md px-1 py-0.5"
                    style={{ background: editingId === opt.id ? 'var(--leaf-db-chrome-hover)' : undefined }}
                  >
                    <span className="w-4 shrink-0 cursor-grab text-[10px] opacity-35" aria-hidden>⋮⋮</span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => { void ensureAndToggle(opt.label, !on) }}
                    >
                      <MiniTagChip label={opt.label} color={col} />
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded px-1 py-0.5 text-[12px]"
                      style={{ color: 'var(--leaf-text-muted)' }}
                      aria-label={`Edit ${opt.label}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId((id) => (id === opt.id ? null : opt.id))
                      }}
                    >
                      ⋯
                    </button>
                  </div>
                )
              })}
              {!filtered.length && !canCreate ? (
                <div className="px-2 py-2 text-[11px]" style={{ color: 'var(--leaf-text-hint)' }}>No options yet — type a name and press Enter.</div>
              ) : null}
            </div>
          </div>
          {editing ? (
            <OptionEditorPanel
              columnKey={column.key}
              option={editing}
              allOptions={options}
              onClose={() => setEditingId(null)}
              actions={actions}
            />
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

export function StatusOptionCell({
  column,
  value,
  rowId,
  actions,
  children,
}: {
  column: PropertyDefinition
  value: unknown
  rowId: string
  actions: OptionColumnActions
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const options = useMemo(() => column.options ?? [], [column.options])
  const current = value != null && value !== '' ? String(value) : ''
  const pos = useDropdownPosition(rootRef, open)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setOpen(false)
      setEditingId(null)
      setFilter('')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, filter])

  const canCreate = filter.trim() && !options.some((o) => o.label.toLowerCase() === filter.trim().toLowerCase())

  const pick = async (label: string | null) => {
    await actions.updateCellValue(rowId, column.key, label)
    setOpen(false)
    setEditingId(null)
    setFilter('')
  }

  const ensureOption = async (label: string): Promise<PropertyOption[]> => {
    if (options.some((o) => o.label === label)) return options
    const next = [...options, { id: crypto.randomUUID(), label, color: 'default' as const }]
    await actions.setColumnOptions(column.key, next)
    return next
  }

  const createAndPick = async () => {
    const t = filter.trim()
    if (!t) return
    await ensureOption(t)
    await pick(t)
    setFilter('')
  }

  const editing = editingId ? options.find((o) => o.id === editingId) : null

  return (
    <div ref={rootRef} className="relative min-h-[1.5rem] w-full">
      <button type="button" className="block w-full cursor-pointer text-left" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && pos ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] flex rounded-xl border shadow-lg"
          style={{
            top: pos.top,
            left: pos.left,
            background: 'var(--leaf-bg-elevated)',
            borderColor: 'var(--leaf-border-strong)',
            boxShadow: 'var(--leaf-shadow-soft)',
          }}
        >
          <div className="flex w-56 flex-col py-2 pl-2 pr-1">
            <button
              type="button"
              className="mb-1 rounded-md px-2 py-1.5 text-left text-[11px]"
              style={{ color: 'var(--leaf-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
              onClick={() => { void pick(null) }}
            >
              Clear status
            </button>
            <input
              className="mb-2 rounded-md border px-2 py-1.5 text-[12px] focus:outline-none"
              style={{ borderColor: 'var(--leaf-border-soft)', background: 'var(--leaf-bg-subtle)' }}
              placeholder="Search or create…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canCreate) void createAndPick()
                  else if (filtered.length === 1) void pick(filtered[0].label)
                }
              }}
            />
            <div className="max-h-52 overflow-y-auto">
              {canCreate ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]"
                  style={{ color: 'var(--leaf-text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                  onClick={() => { void createAndPick() }}
                >
                  Create &ldquo;{filter.trim()}&rdquo;
                </button>
              ) : null}
              {filtered.map((opt) => {
                const col = normalizeChipColor(opt.color)
                const on = current === opt.label
                return (
                  <div
                    key={opt.id}
                    className="flex items-center gap-1 rounded-md px-1 py-0.5"
                    style={{ background: editingId === opt.id ? 'var(--leaf-db-chrome-hover)' : undefined }}
                  >
                    <span className="w-4 shrink-0 cursor-grab text-[10px] opacity-35" aria-hidden>⋮⋮</span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => { void pick(opt.label) }}
                    >
                      <MiniStatusChip label={opt.label} color={col} />
                    </button>
                    {on ? <span className="text-[10px]" style={{ color: 'var(--color-primary)' }}>✓</span> : null}
                    <button
                      type="button"
                      className="shrink-0 rounded px-1 py-0.5 text-[12px]"
                      style={{ color: 'var(--leaf-text-muted)' }}
                      aria-label={`Edit ${opt.label}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId((id) => (id === opt.id ? null : opt.id))
                      }}
                    >
                      ⋯
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          {editing ? (
            <OptionEditorPanel
              columnKey={column.key}
              option={editing}
              allOptions={options}
              onClose={() => setEditingId(null)}
              actions={actions}
            />
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
