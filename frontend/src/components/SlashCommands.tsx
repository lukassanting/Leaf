'use client'

/**
 * Slash-command suggestion for TipTap.
 * No tippy.js — feeds menu state back to the Editor as React state.
 */

import type { Dispatch, SetStateAction } from 'react'
import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlashItem = {
  label: string
  action: string
  keywords: string[]
}

export type SlashMenuState = {
  items: SlashItem[]
  selectedIndex: number
  rect: DOMRect
  /** Call this with the chosen item to apply it and dismiss. */
  select: (item: SlashItem) => void
  /** Pass keydown events here; returns true if consumed. */
  onKeyDown: (e: KeyboardEvent) => boolean
} | null

// ─── Menu items ───────────────────────────────────────────────────────────────

export const SLASH_ITEMS: SlashItem[] = [
  { label: 'Heading 1',     action: 'h1',      keywords: ['h1', 'heading', 'title'] },
  { label: 'Heading 2',     action: 'h2',      keywords: ['h2', 'heading'] },
  { label: 'Heading 3',     action: 'h3',      keywords: ['h3', 'heading'] },
  { label: 'Bold',          action: 'bold',    keywords: ['bold', 'strong'] },
  { label: 'Italic',        action: 'italic',  keywords: ['italic', 'em'] },
  { label: 'Strikethrough', action: 'strike',  keywords: ['strike', 'strikethrough'] },
  { label: 'Code',          action: 'code',    keywords: ['code', 'inline'] },
  { label: 'Bullet list',   action: 'bullet',  keywords: ['bullet', 'list', 'ul'] },
  { label: 'Numbered list', action: 'ordered', keywords: ['numbered', 'ordered', 'ol'] },
  { label: 'To-Do list',    action: 'todo',    keywords: ['todo', 'task', 'checkbox'] },
  { label: 'Quote',         action: 'quote',   keywords: ['quote', 'blockquote'] },
  { label: '🍃 Sub-page',   action: 'subpage', keywords: ['page', 'subpage'] },
  { label: '🌳 Database',   action: 'database',keywords: ['database', 'db', 'table'] },
]

// ─── Extension factory ────────────────────────────────────────────────────────

export function buildSlashExtension(
  setMenu: Dispatch<SetStateAction<SlashMenuState>>,
): Extension {
  const suggestion: Partial<SuggestionOptions<SlashItem>> = {
    char: '/',
    startOfLine: false,

    // Called when user selects an item — delete the "/query" range, then fire action
    command({ editor, range, props: item }) {
      editor.chain().focus().deleteRange(range).run()
      // The action is dispatched via the window event so Editor.tsx can handle it
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
      // Mutable index local to this suggestion session
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
