'use client'

/**
 * Slash-command suggestion for TipTap.
 * No tippy.js — feeds menu state back to the Editor as React state.
 */

import type { Dispatch, SetStateAction } from 'react'
import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'
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

export type SlashMenuState = {
  items: SlashItem[]
  selectedIndex: number
  rect: DOMRect
  select: (item: SlashItem) => void
  onKeyDown: (e: KeyboardEvent) => boolean
} | null

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
  { label: 'Sub-page',      description: 'New child page',          action: 'subpage', group: 'Insert',    keywords: ['page', 'subpage'] },
  { label: 'Database',      description: 'New table database',      action: 'database',group: 'Insert',    keywords: ['database', 'db', 'table'] },
]

// ─── Extension factory ────────────────────────────────────────────────────────

export function buildSlashExtension(
  setMenu: Dispatch<SetStateAction<SlashMenuState>>,
): Extension {
  const suggestion: Partial<SuggestionOptions<SlashItem>> = {
    char: '/',
    startOfLine: false,

    command({ editor, range, props: item }) {
      editor.chain().focus().deleteRange(range).run()
      window.dispatchEvent(new CustomEvent('slash-action', { detail: item.action }))
    },

    items({ query }) {
      const q = query.toLowerCase()
      if (!q) return SLASH_ITEMS
      return SLASH_ITEMS.filter(
        (i) => i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q)),
      )
    },

    render() {
      let idx = 0

      const publish = (items: SlashItem[], rect: DOMRect, selectFn: (item: SlashItem) => void) => {
        setMenu({
          items,
          selectedIndex: idx,
          rect,
          select: selectFn,
          onKeyDown(e) {
            if (e.key === 'ArrowUp')   { idx = (idx - 1 + items.length) % items.length; setMenu((m) => m ? { ...m, selectedIndex: idx } : null); return true }
            if (e.key === 'ArrowDown') { idx = (idx + 1) % items.length;                setMenu((m) => m ? { ...m, selectedIndex: idx } : null); return true }
            if (e.key === 'Enter')     { selectFn(items[idx]); return true }
            return false
          },
        })
      }

      return {
        onStart(props) {
          idx = 0
          const rect = props.clientRect?.()
          if (!rect) return
          publish(props.items, rect, (item) => props.command(item))
        },
        onUpdate(props) {
          idx = 0
          const rect = props.clientRect?.()
          if (!rect) return
          publish(props.items, rect, (item) => props.command(item))
        },
        onKeyDown({ event }) {
          if (event.key === 'Escape') { setMenu(null); return true }
          let consumed = false
          setMenu((m) => {
            if (!m) return m
            consumed = m.onKeyDown(event)
            return m
          })
          return consumed
        },
        onExit() {
          setMenu(null)
        },
      }
    },
  }

  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      return [Suggestion({ editor: this.editor, ...suggestion })]
    },
  })
}

// ─── Menu renderer (used in Editor.tsx) ──────────────────────────────────────

const GROUPS: SlashGroup[] = ['Text', 'Structure', 'Insert']

export function SlashMenuPanel({
  menu,
  globalIdx,
}: {
  menu: SlashMenuState
  globalIdx: number
}) {
  if (!menu || !menu.items.length) return null

  // Group items, preserving global index for keyboard selection
  let runningIdx = 0
  const grouped: { group: SlashGroup; items: { item: SlashItem; idx: number }[] }[] = []

  for (const group of GROUPS) {
    const groupItems = menu.items
      .map((item, i) => ({ item, globalI: i }))
      .filter(({ item }) => item.group === group)

    if (groupItems.length === 0) continue
    grouped.push({
      group,
      items: groupItems.map(({ item, globalI }) => ({ item, idx: globalI })),
    })
    runningIdx += groupItems.length
  }
  void runningIdx

  return (
    <div
      className="fixed z-50 rounded-lg overflow-hidden"
      style={{
        top: menu.rect.bottom + 6,
        left: Math.min(menu.rect.left, window.innerWidth - 272),
        width: 260,
        background: '#fff',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
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
            const isSelected = idx === globalIdx
            return (
              <button
                key={item.action}
                type="button"
                onMouseDown={() => menu.select(item)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors duration-100"
                style={{
                  backgroundColor: isSelected ? 'var(--color-hover)' : undefined,
                }}
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
}
