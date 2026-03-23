'use client'

/**
 * Shared slash-command metadata and UI panel.
 */

import { createPortal } from 'react-dom'
import { BLOCK_ICONS } from './Icons'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlashGroup = 'Text' | 'Structure' | 'Insert'

export type SlashItem = {
  label: string
  description: string
  action: string
  group: SlashGroup
  keywords: string[]
}

type SlashMenuPosition = {
  top: number
  left: number
  bottom: number
}

export type SlashMenuState = {
  items: SlashItem[]
  selectedIndex: number
  rect: SlashMenuPosition
}

// ─── Items ───────────────────────────────────────────────────────────────────

export const SLASH_ITEMS: SlashItem[] = [
  // Text group
  { label: 'Heading 1',     description: 'Large section heading',   action: 'h1',      group: 'Text',      keywords: ['h1', 'heading', 'title'] },
  { label: 'Heading 2',     description: 'Medium section heading',  action: 'h2',      group: 'Text',      keywords: ['h2', 'heading'] },
  { label: 'Heading 3',     description: 'Small section heading',   action: 'h3',      group: 'Text',      keywords: ['h3', 'heading'] },
  { label: 'Bold',          description: 'Bold text',               action: 'bold',    group: 'Text',      keywords: ['bold', 'strong'] },
  { label: 'Italic',        description: 'Italic text',             action: 'italic',  group: 'Text',      keywords: ['italic', 'em'] },
  { label: 'Strikethrough', description: 'Strikethrough text',      action: 'strike',  group: 'Text',      keywords: ['strike', 'strikethrough'] },
  { label: 'Code',          description: 'Inline code snippet',     action: 'code',    group: 'Text',      keywords: ['code', 'inline'] },
  // Structure group
  { label: 'Bullet list',   description: 'Unordered list',          action: 'bullet',  group: 'Structure', keywords: ['bullet', 'list', 'ul'] },
  { label: 'Numbered list', description: 'Ordered list',            action: 'ordered', group: 'Structure', keywords: ['numbered', 'ordered', 'ol'] },
  { label: 'To-Do list',    description: 'Checkbox task list',      action: 'todo',    group: 'Structure', keywords: ['todo', 'task', 'checkbox'] },
  { label: 'Quote',         description: 'Block quotation',         action: 'quote',   group: 'Structure', keywords: ['quote', 'blockquote'] },
  // Insert group
  { label: '2 columns',     description: 'Two blocks side by side',   action: 'columns2', group: 'Insert', keywords: ['columns', '2 columns', 'layout'] },
  { label: '3 columns',     description: 'Three blocks side by side', action: 'columns3', group: 'Insert', keywords: ['columns', '3 columns', 'layout'] },
  { label: '4 columns',     description: 'Four blocks side by side',  action: 'columns4', group: 'Insert', keywords: ['columns', '4 columns', 'layout'] },
  { label: '5 columns',     description: 'Five blocks side by side',  action: 'columns5', group: 'Insert', keywords: ['columns', '5 columns', 'layout'] },
  { label: 'Sub-page',      description: 'New child page',          action: 'subpage', group: 'Insert',    keywords: ['page', 'subpage'] },
  { label: 'Database',      description: 'New table database',      action: 'database',group: 'Insert',    keywords: ['database', 'db', 'table'] },
]

function getSlashItemScore(item: SlashItem, query: string): number | null {
  const label = item.label.toLowerCase()
  const keywords = item.keywords.map((keyword) => keyword.toLowerCase())

  if (label === query) return 0
  if (label.startsWith(query)) return 1
  if (keywords.includes(query)) return 2
  if (keywords.some((keyword) => keyword.startsWith(query))) return 3
  if (label.includes(query)) return 4
  if (keywords.some((keyword) => keyword.includes(query))) return 5

  return null
}

export function rankSlashItems(query: string): SlashItem[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return SLASH_ITEMS
  }

  return SLASH_ITEMS
    .map((item) => ({ item, score: getSlashItemScore(item, normalizedQuery) }))
    .filter((entry): entry is { item: SlashItem; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label))
    .map(({ item }) => item)
}

// ─── Menu renderer (used in Editor.tsx) ──────────────────────────────────────

const GROUPS: SlashGroup[] = ['Text', 'Structure', 'Insert']

export function SlashMenuPanel({
  menu,
  onSelect,
}: {
  menu: SlashMenuState
  onSelect: (item: SlashItem) => void
}) {
  if (!menu) return null

  const grouped: { group: SlashGroup; items: { item: SlashItem; idx: number }[] }[] = []
  for (const group of GROUPS) {
    const groupItems = menu.items
      .map((item, i) => ({ item, globalI: i }))
      .filter(({ item }) => item.group === group)
    if (groupItems.length === 0) continue
    grouped.push({ group, items: groupItems.map(({ item, globalI }) => ({ item, idx: globalI })) })
  }

  // Flip above cursor if too close to bottom
  const spaceBelow = window.innerHeight - menu.rect.bottom
  const top = spaceBelow < 240 ? menu.rect.top - 6 - Math.min(240, window.innerHeight * 0.4) : menu.rect.bottom + 6
  const left = Math.min(menu.rect.left, window.innerWidth - 272)

  const panel = (
    <div
      className="fixed z-[9999] rounded-lg overflow-hidden"
      style={{
        top,
        left,
        width: 260,
        background: '#fff',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {grouped.map(({ group, items }) => (
        <div key={group}>
          <div
            className="px-3 pt-2.5 pb-1 text-[10px] font-medium tracking-wider uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {group}
          </div>
          {items.map(({ item, idx }) => {
            const isSelected = idx === menu.selectedIndex
            return (
              <button
                key={item.action}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(item)
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors duration-100"
                style={{ backgroundColor: isSelected ? 'var(--color-hover)' : undefined }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? 'var(--color-hover)' : '')}
              >
                {BLOCK_ICONS[item.action] ?? null}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>
                    {item.label}
                  </span>
                  <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {item.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
      {grouped.length === 0 && (
        <div className="px-3 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No results
        </div>
      )}
    </div>
  )

  return createPortal(panel, document.body)
}
