'use client'

/**
 * Shared slash-command metadata and UI panel.
 */

import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { STORY_TAG_PRESETS, storyTagAction } from '@/lib/editorRichText'
import { BLOCK_ICONS } from './Icons'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlashGroup = 'Text' | 'Style' | 'Structure' | 'Table' | 'Insert' | 'Flags' | 'Toggle Cards'

export type SlashItem = {
  label: string
  description: string
  action: string
  group: SlashGroup
  keywords: string[]
  /** When set, the item is only shown if the cursor is inside a TipTap table. */
  requiresTable?: boolean
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

const STORY_TAG_SLASH_ITEMS: SlashItem[] = STORY_TAG_PRESETS.map((p) => ({
  label: p.slashLabel,
  description: p.slashDescription,
  action: storyTagAction(p.variant),
  group: 'Flags' as const,
  keywords: p.keywords,
}))

export const SLASH_ITEMS: SlashItem[] = [
  // Text group
  { label: 'Heading 1',     description: 'Large section heading',   action: 'h1',      group: 'Text',      keywords: ['h1', 'heading', 'title'] },
  { label: 'Heading 2',     description: 'Medium section heading',  action: 'h2',      group: 'Text',      keywords: ['h2', 'heading'] },
  { label: 'Heading 3',     description: 'Small section heading',   action: 'h3',      group: 'Text',      keywords: ['h3', 'heading'] },
  { label: 'Bold',          description: 'Bold text',               action: 'bold',    group: 'Text',      keywords: ['bold', 'strong'] },
  { label: 'Italic',        description: 'Italic text',             action: 'italic',  group: 'Text',      keywords: ['italic', 'em'] },
  { label: 'Strikethrough', description: 'Strikethrough text',      action: 'strike',  group: 'Text',      keywords: ['strike', 'strikethrough'] },
  { label: 'Code',          description: 'Inline code snippet',     action: 'code',    group: 'Text',      keywords: ['code', 'inline'] },
  // Style group
  { label: 'Align left',    description: 'Left-align paragraph or heading', action: 'align_left',   group: 'Style', keywords: ['align', 'left'] },
  { label: 'Align center',  description: 'Center paragraph or heading',     action: 'align_center', group: 'Style', keywords: ['align', 'center', 'middle'] },
  { label: 'Align right',   description: 'Right-align paragraph or heading', action: 'align_right', group: 'Style', keywords: ['align', 'right'] },
  { label: 'Reset text color', description: 'Remove inline colour from selection', action: 'textColor_clear', group: 'Style', keywords: ['color', 'reset', 'default', 'clear'] },
  // Structure group
  { label: 'Bullet list',   description: 'Unordered list',          action: 'bullet',  group: 'Structure', keywords: ['bullet', 'list', 'ul'] },
  { label: 'Numbered list', description: 'Ordered list',            action: 'ordered', group: 'Structure', keywords: ['numbered', 'ordered', 'ol'] },
  { label: 'To-Do list',    description: 'Checkbox task list',      action: 'todo',    group: 'Structure', keywords: ['todo', 'task', 'checkbox'] },
  { label: 'Quote',         description: 'Block quotation',         action: 'quote',   group: 'Structure', keywords: ['quote', 'blockquote'] },
  { label: 'Table', description: 'Markdown-style grid — drag column edges to resize', action: 'table', group: 'Structure', keywords: ['table', 'grid', 'rows', 'columns', 'markdown'] },
  // Table group (only while cursor is inside a table — see `requiresTable`)
  { label: 'Add row below', description: 'New row under the current cell', action: 'table_add_row_after', group: 'Table', keywords: ['row', 'below', 'add'], requiresTable: true },
  { label: 'Add row above', description: 'New row above the current cell', action: 'table_add_row_before', group: 'Table', keywords: ['row', 'above'], requiresTable: true },
  { label: 'Add column right', description: 'New column after the current one', action: 'table_add_column_after', group: 'Table', keywords: ['column', 'right', 'col'], requiresTable: true },
  { label: 'Add column left', description: 'New column before the current one', action: 'table_add_column_before', group: 'Table', keywords: ['column', 'left'], requiresTable: true },
  { label: 'Delete row', description: 'Remove the row you are in', action: 'table_delete_row', group: 'Table', keywords: ['row', 'delete', 'remove'], requiresTable: true },
  { label: 'Delete column', description: 'Remove the column you are in', action: 'table_delete_column', group: 'Table', keywords: ['column', 'delete', 'remove'], requiresTable: true },
  { label: 'Header row', description: 'Toggle header styling on this row (column titles)', action: 'table_toggle_header_row', group: 'Table', keywords: ['header', 'th', 'title', 'heading'], requiresTable: true },
  { label: 'Delete table', description: 'Remove the whole table', action: 'table_delete_table', group: 'Table', keywords: ['table', 'delete', 'remove'], requiresTable: true },
  // Insert group
  { label: '2 columns',     description: 'Two blocks side by side',   action: 'columns2', group: 'Insert', keywords: ['columns', '2 columns', 'layout'] },
  { label: '3 columns',     description: 'Three blocks side by side', action: 'columns3', group: 'Insert', keywords: ['columns', '3 columns', 'layout'] },
  { label: '4 columns',     description: 'Four blocks side by side',  action: 'columns4', group: 'Insert', keywords: ['columns', '4 columns', 'layout'] },
  { label: '5 columns',     description: 'Five blocks side by side',  action: 'columns5', group: 'Insert', keywords: ['columns', '5 columns', 'layout'] },
  { label: 'Stat strip',    description: '2–6 kicker + value stat cards', action: 'statStrip', group: 'Insert', keywords: ['stat', 'strip', 'stats', 'dc', 'hp', 'ac', 'cards'] },
  { label: 'Link to page',  description: 'Wiki-style link to a page or database ([[…]])', action: 'wikilink', group: 'Insert', keywords: ['link', 'page', 'wikilink', 'mention', 'internal'] },
  { label: 'Web link', description: 'External URL on selected text or at cursor', action: 'weblink', group: 'Insert', keywords: ['url', 'http', 'https', 'external', 'web'] },
  { label: 'Code block', description: 'Syntax-highlighted fenced block', action: 'code_block', group: 'Insert', keywords: ['code', 'snippet', 'pre', 'fence'] },
  { label: 'Image', description: 'URL or upload from device (resize when selected)', action: 'image', group: 'Insert', keywords: ['img', 'picture', 'photo', 'upload'] },
  { label: 'Link card', description: 'Preview card with URL, title, text, optional image', action: 'link_card', group: 'Insert', keywords: ['bookmark', 'preview', 'card', 'embed'] },
  { label: 'Sub-page',      description: 'New child page',          action: 'subpage', group: 'Insert',    keywords: ['page', 'subpage'] },
  { label: 'Database',      description: 'New table database',      action: 'database',group: 'Insert',    keywords: ['database', 'db', 'table'] },
  { label: 'Callout', description: 'Highlighted panel — change colour after inserting', action: 'callout', group: 'Structure', keywords: ['callout', 'panel', 'note', 'aside', 'box', 'info', 'warning', 'danger'] },
  { label: 'Toggle Cards', description: 'Full-width card, collapsible body', action: 'toggleCard', group: 'Toggle Cards', keywords: ['toggle', 'card', 'collapse', 'accordion', 'episode', 'dnd', 'campaign'] },
  ...STORY_TAG_SLASH_ITEMS,
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

const GROUPS: SlashGroup[] = ['Text', 'Style', 'Structure', 'Table', 'Insert', 'Flags', 'Toggle Cards']

export const SLASH_MENU_PANEL_WIDTH = 260

const MENU_VERTICAL_GAP = 6
const VIEWPORT_MARGIN = 8

function slashMenuMaxHeightPx(): number {
  if (typeof window === 'undefined') return 420
  return Math.min(window.innerHeight * 0.52, 420)
}

/** Fixed `top` / `left` for a menu panel; opens upward when the anchor sits in the lower third or when there is more room above. */
export function computeFixedMenuTopLeft(anchor: { top: number; bottom: number; left: number; right?: number }): { top: number; left: number } {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const maxH = slashMenuMaxHeightPx()
  const spaceBelow = vh - anchor.bottom - MENU_VERTICAL_GAP
  const spaceAbove = anchor.top - MENU_VERTICAL_GAP
  const inBottomThird = anchor.bottom > (vh * 2) / 3

  const preferAbove =
    (inBottomThird && spaceAbove >= 80) ||
    (spaceBelow < Math.min(maxH, 280) && spaceAbove > spaceBelow && spaceAbove >= 80)

  let top: number
  if (preferAbove) {
    top = anchor.top - MENU_VERTICAL_GAP - maxH
    top = Math.max(VIEWPORT_MARGIN, top)
  } else {
    top = anchor.bottom + MENU_VERTICAL_GAP
    if (top + maxH > vh - VIEWPORT_MARGIN) {
      top = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - maxH)
    }
    top = Math.max(VIEWPORT_MARGIN, top)
  }

  const left = Math.min(anchor.left, vw - SLASH_MENU_PANEL_WIDTH - VIEWPORT_MARGIN)
  return { top, left: Math.max(VIEWPORT_MARGIN, left) }
}

export function SlashCommandList({
  items,
  selectedIndex,
  onSelect,
  scrollRef,
}: {
  items: SlashItem[]
  selectedIndex: number
  onSelect: (item: SlashItem) => void
  scrollRef?: RefObject<HTMLDivElement | null>
}) {
  const grouped: { group: SlashGroup; items: { item: SlashItem; idx: number }[] }[] = []
  for (const group of GROUPS) {
    const groupItems = items
      .map((item, i) => ({ item, globalI: i }))
      .filter(({ item }) => item.group === group)
    if (groupItems.length === 0) continue
    grouped.push({ group, items: groupItems.map(({ item, globalI }) => ({ item, idx: globalI })) })
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-0.5"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {grouped.map(({ group, items: groupItems }) => (
        <div key={group}>
          <div
            className="px-3 pt-2.5 pb-1 text-[10px] font-medium tracking-wider uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {group}
          </div>
          {groupItems.map(({ item, idx }) => {
            const isSelected = idx === selectedIndex
            return (
              <button
                key={`${item.action}-${idx}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-slash-idx={idx}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(item)
                }}
                className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors duration-100"
                style={{ backgroundColor: isSelected ? 'var(--color-hover)' : undefined }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected ? 'var(--color-hover)' : ''
                }}
              >
                {BLOCK_ICONS[item.action] ?? null}
                <span className="min-w-0 flex-1">
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
}

export function SlashMenuPanel({
  menu,
  onSelect,
}: {
  menu: SlashMenuState
  onSelect: (item: SlashItem) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { top, left } = computeFixedMenuTopLeft({
    top: menu.rect.top,
    bottom: menu.rect.bottom,
    left: menu.rect.left,
  })

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector(`[data-slash-idx="${menu.selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [menu.selectedIndex, menu.items.length])

  const panel = (
    <div
      className="fixed z-[9999] flex flex-col rounded-lg"
      style={{
        top,
        left,
        width: SLASH_MENU_PANEL_WIDTH,
        maxHeight: 'min(52vh, 420px)',
        background: 'var(--leaf-bg-elevated)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 20px color-mix(in srgb, var(--foreground) 12%, transparent)',
        overflow: 'hidden',
      }}
      onMouseDown={(e) => e.preventDefault()}
      role="listbox"
      aria-label="Slash commands"
    >
      <SlashCommandList items={menu.items} selectedIndex={menu.selectedIndex} onSelect={onSelect} scrollRef={scrollRef} />
    </div>
  )

  return createPortal(panel, document.body)
}
