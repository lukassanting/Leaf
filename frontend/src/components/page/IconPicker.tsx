/**
 * Leaf UI: icon picker (`frontend/src/components/page/IconPicker.tsx`).
 *
 * Purpose:
 * - Allows choosing a leaf/database icon:
 *   - emoji icons (from a fixed set)
 *   - built-in SVG shape icons (geometric shapes)
 *   - uploaded image icons (PNG/JPEG/SVG)
 *
 * How to read:
 * - `currentIcon` is the initial selection.
 * - `draftIcon` tracks the in-progress choice before pressing “Apply”.
 * - UI is filtered via the `query` state and `ICON_SECTIONS` list.
 *
 * Update:
 * - Extend `NATURE_ITEMS`/`WORK_ITEMS`/`SHAPE_ITEMS` by editing the option arrays.
 * - To add new icon sources, add another section builder and update the file input handler.
 *
 * Debug:
 * - If uploaded icons don’t apply, verify the `FileReader` `reader.result` becomes the expected
 *   `draftIcon.value` string.
 * - If Apply returns null unexpectedly, check `draftIcon` initialization and Remove handler.
 */


'use client'

import { useMemo, useRef, useState } from 'react'
import type { LeafIcon } from '@/lib/api'
import { type LeafShapeIcon, ShapeIcon } from '@/components/Icons'

type IconOption = {
  label: string
  value: LeafIcon
}

type Section = {
  label: string
  items: IconOption[]
}

const NATURE_ITEMS: IconOption[] = ['🌿', '🌱', '🌳', '🌸', '☀️', '🌙', '⛰️', '🌊'].map((emoji, index) => ({
  label: `Nature ${index + 1}`,
  value: { type: 'emoji', value: emoji },
}))

const WORK_ITEMS: IconOption[] = ['📋', '📁', '📝', '🔎', '⚙️', '🎯', '📊', '💡'].map((emoji, index) => ({
  label: `Work ${index + 1}`,
  value: { type: 'emoji', value: emoji },
}))

const SHAPE_ITEMS: LeafShapeIcon[] = [
  'diamond-fill',
  'circle-fill',
  'triangle-fill',
  'diamond-outline',
  'circle-outline',
  'triangle-outline',
]

const ICON_SECTIONS: Section[] = [
  { label: 'Nature', items: NATURE_ITEMS },
  { label: 'Work', items: WORK_ITEMS },
  {
    label: 'Shapes',
    items: SHAPE_ITEMS.map((shape) => ({ label: shape, value: { type: 'svg', value: shape } })),
  },
]

type Props = {
  currentIcon?: LeafIcon | null
  onApply: (icon: LeafIcon | null) => void
  onClose: () => void
}

function matchesQuery(option: IconOption, query: string) {
  if (!query) return true
  const normalized = query.toLowerCase()
  return option.label.toLowerCase().includes(normalized) || option.value.value.toLowerCase().includes(normalized)
}

function isSameIcon(left: LeafIcon | null | undefined, right: LeafIcon | null | undefined) {
  return (left?.type ?? null) === (right?.type ?? null) && (left?.value ?? null) === (right?.value ?? null)
}

export function IconPicker({ currentIcon, onApply, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [draftIcon, setDraftIcon] = useState<LeafIcon | null>(currentIcon ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredSections = useMemo(() => ICON_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => matchesQuery(item, query)),
  })).filter((section) => section.items.length > 0), [query])

  return (
    <div
      style={{
        width: 260,
        margin: '8px auto 0',
        borderRadius: 10,
        border: '0.5px solid var(--leaf-border-strong)',
        background: 'var(--leaf-bg-editor)',
        overflow: 'hidden',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => setDraftIcon({ type: 'image', value: String(reader.result ?? '') })
          reader.readAsDataURL(file)
          event.target.value = ''
        }}
      />

      <div
        style={{
          padding: '8px 10px',
          borderBottom: '0.5px solid var(--leaf-border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 15 15" fill="none" style={{ color: 'var(--leaf-text-muted)' }}>
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons…"
          className="w-full bg-transparent text-xs outline-none"
          style={{ color: 'var(--leaf-text-body)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, padding: 8 }}>
        {filteredSections.map((section) => (
          <div key={section.label} style={{ display: 'contents' }}>
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '4px 2px 2px',
                fontSize: 10,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--leaf-text-muted)',
              }}
            >
              {section.label}
            </div>
            {section.items.map((item) => {
              const selected = isSameIcon(draftIcon, item.value)
              return (
                <button
                  key={`${section.label}-${item.label}-${item.value.value}`}
                  type="button"
                  onClick={() => setDraftIcon(item.value)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: selected ? '#dff0e0' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {item.value.type === 'svg'
                    ? <ShapeIcon shape={item.value.value as LeafShapeIcon} size={18} />
                    : <span style={{ fontSize: 16 }}>{item.value.value}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 10px',
          borderTop: '0.5px solid var(--leaf-border-soft)',
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 rounded-md px-2.5 py-1.5 text-[11.5px]"
          style={{ border: '0.5px solid var(--leaf-border-strong)', color: '#5a8a6a' }}
        >
          Upload image
        </button>
        <button
          type="button"
          onClick={() => setDraftIcon(null)}
          className="flex-1 rounded-md px-2.5 py-1.5 text-[11.5px]"
          style={{ border: '0.5px solid var(--leaf-border-strong)', color: '#5a8a6a' }}
        >
          Remove
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(draftIcon)
            onClose()
          }}
          className="flex-1 rounded-md px-2.5 py-1.5 text-[11.5px]"
          style={{
            border: '0.5px solid var(--leaf-green)',
            background: 'var(--leaf-green)',
            color: 'var(--leaf-on-accent)',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
