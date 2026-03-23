/**
 * Leaf UI: TipTap editor core (`frontend/src/components/editor/LeafEditor.tsx`).
 *
 * Purpose:
 * - Implements the rich-text editor experience for a Leaf page:
 *   - Rich mode (TipTap document)
 *   - Markdown mode (HTML/Markdown conversion helpers)
 *   - Block-level slash commands (via `SlashCommands.tsx`)
 *   - Wiki link menus (inline `[[...]]` matching) and embeds (pages/databases)
 *   - Emits editor updates upward (`onUpdate`, `onStatusChange`)
 *   - Exposes imperative actions via `actionsRef` (export/import mode switching)
 *
 * How to read:
 * - The top imports show the building blocks:
 *   - TipTap + extensions (`@tiptap/react`, `StarterKit`, task list items)
 *   - Conversion:
 *     - `turndown` and `markdown-it` for Markdown<->HTML-ish transformations
 *     - `lib/leafDocument.ts` for parsing/normalizing LeafDocument structures
 *   - UI integrations:
 *     - `EmbeddedDatabaseBlock`
 *     - slash/wikilink match helpers + `SlashMenuPanel`
 *
 * Update:
 * - To add a new slash command:
 *   1) update `SLASH_ITEMS` in `frontend/src/components/SlashCommands.tsx`
 *   2) update LeafEditor command handling for the new action key
 * - To change editor block rendering/parsing:
 *   - update TipTap node/extension configuration in this file
 *   - update document parsing logic in `lib/leafDocument.ts`
 *
 * Debug:
 * - If content is mangled between modes:
 *   - inspect `htmlToMarkdown` / `markdownToHtml`
 *   - verify `parseLeafContent` + normalization expectations
 * - If wikilinks/embeds don’t appear:
 *   - check the regex match helpers (`computeWikilinkMatch`)
 *   - verify the selected menu result updates editor state.
 */


'use client'

import { useRouter } from 'next/navigation'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'
import { leavesApi, type Database, type LeafTreeItem, type LeafColumn, type LeafDocument } from '@/lib/api'
import { DatabaseIcon, LeafIcon } from '@/components/Icons'
import { EmbeddedDatabaseBlock } from '@/components/database/EmbeddedDatabaseBlock'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { ensureTagEntries } from '@/lib/workspaceDefaults'
import { databasesApi } from '@/lib/api'

import { createEmptyLeafDocument, getLeafContentText, normalizeLeafDocument } from '@/lib/leafDocument'
import { rankSlashItems, SLASH_ITEMS, type SlashMenuState, SlashMenuPanel } from '@/components/SlashCommands'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
const markdown = new MarkdownIt({ html: true })

type EmbedCreateResult = {
  id: string
  title: string
  view?: Database['view_type']
}

export type EditorActions = {
  exportMd: () => void
  importMd: () => void
  setMode: (mode: 'rich' | 'markdown') => void
}

type Props = {
  content: LeafDocument
  leafId?: string
  onUpdate: (document: LeafDocument) => void
  onCreateSubPage?: () => Promise<EmbedCreateResult>
  onCreateDatabase?: () => Promise<EmbedCreateResult>
  onStatusChange?: (mode: 'rich' | 'markdown', wordCount: number) => void
  onTagAdd?: (tag: string) => void
  mode: 'rich' | 'markdown'
  onModeChange: (mode: 'rich' | 'markdown') => void
  actionsRef?: React.MutableRefObject<EditorActions | null>
}

type SlashMatch = {
  range: { from: number; to: number }
  query: string
  rect: SlashMenuState['rect']
}

type WikilinkMenuState = {
  items: LeafTreeItem[]
  query: string
  selectedIndex: number
  rect: SlashMenuState['rect']
}

type BlockMenuState = {
  top: number
  endPos: number
} | null

type EmbedNodeAttrs = {
  id: string
  title: string
  kind: 'page' | 'database'
  tempId: string | null
  status: 'pending' | 'ready' | 'error'
  view?: Database['view_type']
}

type ColumnLayoutAttrs = {
  layout: 2 | 3
  columns: LeafColumn[]
}

function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return ''
  return turndown.turndown(html)
}

function markdownToHtml(mdText: string): string {
  if (!mdText.trim()) return '<p></p>'
  return markdown.render(mdText)
}

function createTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createColumnData(layout: 2 | 3): LeafColumn[] {
  return Array.from({ length: layout }, () => ({
    id: createTempId(),
    content: createEmptyLeafDocument(),
  }))
}

function normalizeColumns(attrs: ColumnLayoutAttrs): ColumnLayoutAttrs {
  const columns = attrs.columns.slice(0, attrs.layout)
  while (columns.length < attrs.layout) {
    columns.push({ id: createTempId(), content: createEmptyLeafDocument() })
  }
  return {
    ...attrs,
    columns: columns.map((column) => ({
      ...column,
      content: column.content ?? normalizeLeafDocument({
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: column.text ? [{ type: 'text', text: column.text }] : [] }],
      }),
    })),
  }
}

function computeSlashMatch(editor: NonNullable<ReturnType<typeof useEditor>>): SlashMatch | null {
  const { state, view } = editor
  const { selection } = state

  if (!selection.empty) return null

  const $from = selection.$from
  if (!$from.parent.isTextblock) return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0')
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore)

  if (!match) return null

  const slashIndex = textBefore.length - match[0].length + match[0].lastIndexOf('/')
  const from = selection.from - (textBefore.length - slashIndex)
  const rect = view.coordsAtPos(selection.from)

  return {
    range: { from, to: selection.from },
    query: match[1] ?? '',
    rect: {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
    },
  }
}

function computeWikilinkMatch(editor: NonNullable<ReturnType<typeof useEditor>>): SlashMatch | null {
  const { state, view } = editor
  const { selection } = state

  if (!selection.empty) return null

  const $from = selection.$from
  if (!$from.parent.isTextblock) return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0')
  const match = /(?:^|[\s(])\[\[([^\]]*)$/.exec(textBefore)

  if (!match) return null

  const token = `[[${match[1] ?? ''}`
  const from = selection.from - token.length
  const rect = view.coordsAtPos(selection.from)

  return {
    range: { from, to: selection.from },
    query: match[1] ?? '',
    rect: {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
    },
  }
}

function rankWikilinkItems(items: LeafTreeItem[], query: string): LeafTreeItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return items
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 12)
  }

  return items
    .map((item) => {
      const title = item.title.toLowerCase()
      const path = item.path.toLowerCase()
      const exact = title === normalizedQuery || path === normalizedQuery
      const starts = title.startsWith(normalizedQuery) || path.startsWith(normalizedQuery)
      const includes = title.includes(normalizedQuery) || path.includes(normalizedQuery)
      const score = exact ? 0 : starts ? 1 : includes ? 2 : 3
      return { item, score }
    })
    .filter((entry) => entry.score < 3)
    .sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title))
    .map((entry) => entry.item)
    .slice(0, 12)
}

function EmbeddedPageCard({
  node,
  deleteNode,
}: {
  node: { attrs: EmbedNodeAttrs }
  deleteNode: () => void
}) {
  const router = useRouter()
  const { startNavigation } = useNavigationProgress()
  const { id, title, status } = node.attrs
  const href = `/editor/${id}`
  const label = 'Page'
  const canNavigate = status === 'ready' && Boolean(id)

  return (
    <NodeViewWrapper className="my-1.5" data-drag-handle="">
      <div
        contentEditable={false}
        className="group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-150"
        style={{
          borderColor: status === 'error' ? '#f2c4bc' : 'rgba(0,0,0,0.07)',
          background: status === 'pending' ? '#f4f4f5' : '#fff',
          cursor: canNavigate ? 'pointer' : 'default',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
        onClick={() => {
          if (!canNavigate) return
          startNavigation()
          void warmEditorRoute()
          router.push(href)
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: '#f4f4f5', color: 'var(--leaf-text-title)' }}
        >
          <LeafIcon size={16} />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
            {title || 'Untitled'}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
            {status === 'pending'
              ? `Creating ${label.toLowerCase()}…`
              : status === 'error'
                ? `Could not create ${label.toLowerCase()}`
                : label}
          </div>
        </div>
        {canNavigate ? (
          <span className="text-xs opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--leaf-text-muted)' }}>
            ↗
          </span>
        ) : null}
        <button
          type="button"
          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
          onClick={(event) => { event.stopPropagation(); deleteNode() }}
          className="text-xs opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          ✕
        </button>
      </div>
    </NodeViewWrapper>
  )
}

function EmbeddedDatabaseView({
  node,
  deleteNode,
}: {
  node: { attrs: EmbedNodeAttrs }
  deleteNode: () => void
}) {
  const { id, title, status, view } = node.attrs

  if (status !== 'ready' || !id) {
    return (
      <NodeViewWrapper className="my-2">
        <div
          contentEditable={false}
          className="group flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: status === 'error' ? '#f2c4bc' : 'rgba(0,0,0,0.07)',
            background: status === 'pending' ? '#f4f4f5' : '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: '#f4f4f5', color: 'var(--leaf-text-title)' }}
          >
            <DatabaseIcon size={16} />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
              {title || 'Untitled database'}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
              {status === 'pending' ? 'Creating database…' : status === 'error' ? 'Could not create database' : `Database · ${view} view`}
            </div>
          </div>
          <button
            type="button"
            onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
            onClick={(event) => { event.stopPropagation(); deleteNode() }}
            className="text-xs opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--leaf-text-muted)' }}
          >
            ✕
          </button>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="group my-2" data-drag-handle="">
      <div contentEditable={false} className="relative">
        <div className="absolute right-14 top-3 z-10">
          <button
            type="button"
            onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
            onClick={(event) => { event.stopPropagation(); deleteNode() }}
            className="rounded-md px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--leaf-text-muted)', background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            Remove
          </button>
        </div>
        <EmbeddedDatabaseBlock id={id} />
      </div>
    </NodeViewWrapper>
  )
}

function ColumnRichEditor({
  content,
  placeholder,
  onChange,
}: {
  content: LeafDocument
  placeholder: string
  onChange: (content: LeafDocument) => void
}) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nestedEditor = useEditor({
    extensions: [
      StarterKit.configure({ gapcursor: false, dropcursor: false }),
      WikilinkNode,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'leaf-prose max-w-none min-h-[120px] focus:outline-none' },
    },
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        onChange(normalizeLeafDocument(editor.getJSON() as LeafDocument))
      }, 250)
    },
    onBlur: ({ editor }) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      onChange(normalizeLeafDocument(editor.getJSON() as LeafDocument))
    },
  }, [onChange])

  useEffect(() => {
    if (!nestedEditor) return
    const next = normalizeLeafDocument(content)
    const current = normalizeLeafDocument(nestedEditor.getJSON() as LeafDocument)
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      nestedEditor.commands.setContent(next, false)
    }
  }, [content, nestedEditor])

  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div className="leaf-column-editor">
      <EditorContent editor={nestedEditor} />
      {!getLeafContentText(content).trim() ? (
        <div className="pointer-events-none -mt-[118px] px-1 text-sm" style={{ color: 'var(--leaf-text-muted)' }}>
          {placeholder}
        </div>
      ) : null}
    </div>
  )
}

function ColumnLayoutView({
  node,
  updateAttributes,
  deleteNode,
}: {
  node: { attrs: ColumnLayoutAttrs }
  updateAttributes: (attrs: Partial<ColumnLayoutAttrs>) => void
  deleteNode: () => void
}) {
  const attrs = normalizeColumns(node.attrs)
  const dragIndexRef = useRef<number | null>(null)

  const setColumnContent = (index: number, content: LeafDocument) => {
    const nextColumns = attrs.columns.map((column, currentIndex) => (
      currentIndex === index ? { ...column, content, text: undefined } : column
    ))
    updateAttributes({ columns: nextColumns })
  }

  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const nextColumns = [...attrs.columns]
    const [moved] = nextColumns.splice(fromIndex, 1)
    nextColumns.splice(toIndex, 0, moved)
    updateAttributes({ columns: nextColumns })
  }

  return (
    <NodeViewWrapper className="group my-2">
      <div contentEditable={false} className="relative">
        <button
          type="button"
          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
          onClick={(event) => { event.stopPropagation(); deleteNode() }}
          className="absolute -top-3 right-0 z-10 rounded-md px-2 py-0.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--leaf-text-muted)', background: 'var(--leaf-bg-editor, #fff)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          Remove columns
        </button>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${attrs.layout}, minmax(0, 1fr))` }}
        >
          {attrs.columns.map((column, index) => (
            <div
              key={column.id}
              className="min-w-0"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const fromIndex = dragIndexRef.current
                if (fromIndex === null) return
                moveColumn(fromIndex, index)
                dragIndexRef.current = null
              }}
            >
              <ColumnRichEditor
                content={column.content ?? createEmptyLeafDocument()}
                placeholder={`Column ${index + 1}…`}
                onChange={(content) => setColumnContent(index, content)}
              />
            </div>
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

function createEmbedNode(name: 'pageEmbed' | 'databaseEmbed', kind: 'page' | 'database') {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,
    defining: true,
    isolating: true,
    allowGapCursor: false,
    addAttributes() {
      return {
        id: { default: '' },
        title: { default: kind === 'database' ? 'Untitled database' : 'Untitled' },
        kind: { default: kind },
        tempId: { default: null },
        status: { default: 'ready' },
        view: { default: kind === 'database' ? 'table' : null },
      }
    },
    parseHTML() {
      return [{ tag: `div[data-type="${name}"]` }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes({ 'data-type': name }, HTMLAttributes)]
    },
    addNodeView() {
      return ReactNodeViewRenderer((kind === 'database' ? EmbeddedDatabaseView : EmbeddedPageCard) as never)
    },
  })
}

const PageEmbed = createEmbedNode('pageEmbed', 'page')
const DatabaseEmbed = createEmbedNode('databaseEmbed', 'database')

const WikilinkNode = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      id: { default: '' },
      label: { default: 'Untitled' },
      path: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-type="wikilink"]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    const label = node.attrs.label || node.attrs.path || node.attrs.id || 'Untitled'
    return ['span', mergeAttributes({
      'data-type': 'wikilink',
      'data-id': node.attrs.id,
      'data-path': node.attrs.path,
      'data-label': node.attrs.label,
      class: 'leaf-wikilink',
    }, HTMLAttributes), label]
  },
})
const HashtagNode = Node.create({
  name: 'hashtag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      tag: { default: '' },
      id: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-type="hashtag"]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    const tag = node.attrs.tag || ''
    return ['span', mergeAttributes({
      'data-type': 'hashtag',
      'data-tag': tag,
      'data-id': node.attrs.id,
      class: 'leaf-hashtag',
    }, HTMLAttributes), `#${tag}`]
  },
  addInputRules() {
    return [
      new InputRule({
        find: /#([\w\u00C0-\u024F][\w\u00C0-\u024F-]*)\s$/,
        handler: ({ state, range, match }) => {
          const tag = match[1]
          if (!tag) return

          // Don't convert if # is at the very start of the textblock (that's a heading)
          const $from = state.doc.resolve(range.from)
          if ($from.parentOffset === 0) return

          const node = state.schema.nodes.hashtag.create({ tag })
          const space = state.schema.text(' ')
          state.tr
            .delete(range.from, range.to)
            .insert(range.from, [node, space])
        },
      }),
    ]
  },
})
const ColumnLayout = Node.create({
  name: 'columnLayout',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  defining: true,
  isolating: true,
  allowGapCursor: false,
  addAttributes() {
    return {
      layout: { default: 2 },
      columns: { default: createColumnData(2) },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="column-layout"]' }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-type': 'column-layout', 'data-layout': String(node.attrs.layout) }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnLayoutView as never)
  },
})

function BlockDropdown({ onSelect, onClose }: { onSelect: (action: string) => void; onClose: () => void }) {
  const groups = ['Text', 'Structure', 'Insert'] as const

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        className="absolute z-50 overflow-hidden rounded-lg"
        style={{
          top: 28,
          left: 0,
          width: 240,
          background: '#fff',
          border: '1px solid var(--leaf-border-strong)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
        }}
      >
        {groups.map((group) => {
          const items = SLASH_ITEMS.filter((item) => item.group === group)
          return (
            <div key={group}>
              <div className="px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--leaf-text-muted)' }}>
                {group}
              </div>
              {items.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-100"
                  style={{ color: 'var(--leaf-text-title)' }}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(item.action)
                  }}
                >
                  <span className="w-6 text-xs" style={{ color: 'var(--leaf-text-muted)' }}>{item.label.slice(0, 2)}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}

function WikilinkPanel({
  menu,
  onSelect,
  onCreate,
}: {
  menu: WikilinkMenuState
  onSelect: (item: LeafTreeItem) => void
  onCreate: (title: string) => void
}) {
  if (!menu) return null

  const spaceBelow = window.innerHeight - menu.rect.bottom
  const top = spaceBelow < 260 ? menu.rect.top - 6 - Math.min(260, window.innerHeight * 0.4) : menu.rect.bottom + 6
  const left = Math.min(menu.rect.left, window.innerWidth - 320)

  const createIndex = menu.items.length
  const isCreateSelected = menu.selectedIndex === createIndex
  const showCreate = menu.query.trim().length > 0

  return (
    <div
      className="fixed z-[9999] overflow-hidden rounded-xl border"
      style={{
        top,
        left,
        width: 308,
        background: '#fff',
        borderColor: 'var(--leaf-border-strong)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-[0.09em]" style={{ color: 'var(--leaf-text-muted)', borderColor: 'rgba(0,0,0,0.05)' }}>
        Link a page
      </div>
      {menu.items.map((item, index) => {
        const isSelected = index === menu.selectedIndex
        return (
          <button
            key={item.id}
            type="button"
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-100"
            style={{ backgroundColor: isSelected ? 'var(--leaf-bg-hover)' : '#fff' }}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(item)
            }}
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--leaf-bg-tag)', color: 'var(--leaf-green)' }}
            >
              <LeafIcon size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
                {item.title || 'Untitled'}
              </span>
              <span className="block truncate text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
                {item.path}
              </span>
            </span>
          </button>
        )
      })}
      {showCreate && (
        <button
          type="button"
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100"
          style={{
            backgroundColor: isCreateSelected ? 'var(--leaf-bg-hover)' : '#fff',
            borderTop: menu.items.length > 0 ? '1px solid rgba(0,0,0,0.05)' : undefined,
          }}
          onMouseDown={(event) => {
            event.preventDefault()
            onCreate(menu.query.trim())
          }}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--leaf-green)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M7 3v8M3 7h8" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
              Create &ldquo;{menu.query.trim()}&rdquo;
            </span>
            <span className="block text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
              New page
            </span>
          </span>
        </button>
      )}
      {!showCreate && menu.items.length === 0 && (
        <div className="px-3 py-3 text-sm" style={{ color: 'var(--leaf-text-muted)' }}>
          Type a name to link or create a page.
        </div>
      )}
    </div>
  )
}

export default function LeafEditor({
  content,
  leafId,
  onUpdate,
  onCreateSubPage,
  onCreateDatabase,
  onStatusChange,
  onTagAdd,
  mode,
  onModeChange,
  actionsRef,
}: Props) {
  const router = useRouter()
  const [markdownValue, setMarkdownValue] = useState('')
  const [blockMenu, setBlockMenu] = useState<BlockMenuState>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [wikilinkMenu, setWikilinkMenu] = useState<WikilinkMenuState | null>(null)
  const [columnDropZone, setColumnDropZone] = useState<{ top: number; left: number; width: number; height: number; side: 'left' | 'right' } | null>(null)
  const columnDropRef = useRef<{ targetNodePos: number; targetNodeEnd: number; side: 'left' | 'right' } | null>(null)
  const dragSourceRef = useRef<{ pos: number; end: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pendingInsertPos = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modeRef = useRef(mode)
  const onUpdateRef = useRef(onUpdate)
  const onStatusChangeRef = useRef(onStatusChange)
  const onCreateSubPageRef = useRef(onCreateSubPage)
  const onCreateDatabaseRef = useRef(onCreateDatabase)
  const onModeChangeRef = useRef(onModeChange)
  const onTagAddRef = useRef(onTagAdd)
  const initialContentRef = useRef(normalizeLeafDocument(content))
  const lastSyncedRef = useRef(JSON.stringify(normalizeLeafDocument(content)))
  const slashMatchRef = useRef<SlashMatch | null>(null)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashSelectActionRef = useRef<(action: string) => void>(() => {})
  const wikilinkMatchRef = useRef<SlashMatch | null>(null)
  const wikilinkMenuRef = useRef<WikilinkMenuState | null>(null)
  const wikilinkSelectRef = useRef<(item: LeafTreeItem) => void>(() => {})
  const wikilinkCreateRef = useRef<(title: string) => void>(() => {})
  const linkableLeavesRef = useRef<LeafTreeItem[]>([])
  const pendingEmbedPositionsRef = useRef<Record<string, number>>({})

  modeRef.current = mode
  onUpdateRef.current = onUpdate
  onStatusChangeRef.current = onStatusChange
  onCreateSubPageRef.current = onCreateSubPage
  onCreateDatabaseRef.current = onCreateDatabase
  onModeChangeRef.current = onModeChange
  onTagAddRef.current = onTagAdd
  slashMenuRef.current = slashMenu
  wikilinkMenuRef.current = wikilinkMenu

  const updateSlashMenu = useCallback((instance: NonNullable<ReturnType<typeof useEditor>>) => {
    if (modeRef.current !== 'rich') {
      slashMatchRef.current = null
      setSlashMenu(null)
      return
    }

    const match = computeSlashMatch(instance)
    slashMatchRef.current = match

    if (!match) {
      setSlashMenu(null)
      return
    }

    const items = rankSlashItems(match.query)
    setSlashMenu((current) => ({
      items,
      selectedIndex: current?.items.length === items.length ? Math.min(current.selectedIndex, Math.max(0, items.length - 1)) : 0,
      rect: match.rect,
    }))
  }, [])

  const updateWikilinkMenu = useCallback((instance: NonNullable<ReturnType<typeof useEditor>>) => {
    if (modeRef.current !== 'rich') {
      wikilinkMatchRef.current = null
      setWikilinkMenu(null)
      return
    }

    const match = computeWikilinkMatch(instance)
    wikilinkMatchRef.current = match

    if (!match) {
      setWikilinkMenu(null)
      return
    }

    const items = rankWikilinkItems(linkableLeavesRef.current, match.query)
    const hasCreate = match.query.trim().length > 0
    const totalCount = items.length + (hasCreate ? 1 : 0)
    setWikilinkMenu((current) => ({
      items,
      query: match.query,
      selectedIndex: current?.items.length === items.length ? Math.min(current.selectedIndex, Math.max(0, totalCount - 1)) : 0,
      rect: match.rect,
    }))
  }, [])

  const extensions = useMemo(() => [
    StarterKit.configure({
      dropcursor: {
        color: 'var(--leaf-green)',
        width: 2,
      },
    }),
    WikilinkNode,
    HashtagNode,
    ColumnLayout,
    PageEmbed,
    DatabaseEmbed,
    TaskList,
    TaskItem.configure({ nested: true }),
  ], [])

  const syncedTagsRef = useRef<Set<string>>(new Set())
  const tagSyncTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleEditorUpdate = useCallback(({ editor }: { editor: import('@tiptap/core').Editor }) => {
    const document = normalizeLeafDocument(editor.getJSON() as LeafDocument)
    lastSyncedRef.current = JSON.stringify(document)
    onUpdateRef.current(document)
    const words = getLeafContentText(document).trim().split(/\s+/).filter(Boolean).length
    onStatusChangeRef.current?.(modeRef.current, words)

    // Collect hashtag names from the document and sync new ones to the Tags DB
    const tags: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'hashtag' && node.attrs.tag) tags.push(node.attrs.tag)
    })
    const newTags = tags.filter((t) => !syncedTagsRef.current.has(t.toLowerCase()))
    if (newTags.length > 0) {
      // Add to page-level tags metadata
      for (const t of newTags) onTagAddRef.current?.(t)

      if (tagSyncTimerRef.current) clearTimeout(tagSyncTimerRef.current)
      tagSyncTimerRef.current = setTimeout(() => {
        for (const t of newTags) syncedTagsRef.current.add(t.toLowerCase())
        void Promise.resolve().then(async () => {
          // Refresh the tag→leafId map after creation
          try {
            const databases = await databasesApi.list()
            const tagsDb = databases.find((db) => db.title === 'Tags')
            if (!tagsDb) return
            const rows = await databasesApi.listRows(tagsDb.id)
            const map: Record<string, string> = { ...tagLeafMapRef.current }
            for (const row of rows) {
              const name = String(row.properties?.name ?? '')
              if (name && row.leaf_id) map[name.toLowerCase()] = row.leaf_id
            }
            tagLeafMapRef.current = map
          } catch { /* ignore */ }
        })
      }, 500)
    }
  }, [])

  const routerRef = useRef(router)
  routerRef.current = router

  // Tag name → leaf_id map for hashtag navigation
  const tagLeafMapRef = useRef<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const databases = await databasesApi.list()
        const tagsDb = databases.find((db) => db.title === 'Tags')
        if (!tagsDb || cancelled) return
        const rows = await databasesApi.listRows(tagsDb.id)
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const row of rows) {
          const name = String(row.properties?.name ?? '')
          if (name && row.leaf_id) map[name.toLowerCase()] = row.leaf_id
        }
        tagLeafMapRef.current = map
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  const editorProps = useMemo(() => ({
    attributes: { class: 'leaf-prose max-w-none min-h-[50vh] focus:outline-none' },
    handleClick: (_view: unknown, _pos: number, event: MouseEvent) => {
      const target = event.target as HTMLElement

      // Wikilink click
      const wikilink = target.closest('[data-type="wikilink"]') as HTMLElement | null
      if (wikilink) {
        const id = wikilink.getAttribute('data-id')
        if (id) {
          event.preventDefault()
          routerRef.current.push(`/editor/${id}`)
          return true
        }
      }

      // Hashtag click
      const hashtag = target.closest('[data-type="hashtag"]') as HTMLElement | null
      if (hashtag) {
        const tag = hashtag.getAttribute('data-tag')
        if (tag) {
          event.preventDefault()
          const leafId = tagLeafMapRef.current[tag.toLowerCase()]
          if (leafId) {
            routerRef.current.push(`/editor/${leafId}`)
          } else {
            // Create the tag entry then navigate
            void ensureTagEntries([tag]).then(async () => {
              const databases = await databasesApi.list()
              const tagsDb = databases.find((db) => db.title === 'Tags')
              if (!tagsDb) return
              const rows = await databasesApi.listRows(tagsDb.id)
              const row = rows.find((r) => String(r.properties?.name ?? '').toLowerCase() === tag.toLowerCase())
              if (row?.leaf_id) {
                tagLeafMapRef.current[tag.toLowerCase()] = row.leaf_id
                routerRef.current.push(`/editor/${row.leaf_id}`)
              }
            })
          }
          return true
        }
      }

      return false
    },
    handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
      const activeWikilinkMenu = wikilinkMenuRef.current
      const activeSlashMenu = slashMenuRef.current

      if (activeWikilinkMenu) {
        const hasCreate = activeWikilinkMenu.query.trim().length > 0
        const totalCount = activeWikilinkMenu.items.length + (hasCreate ? 1 : 0)
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setWikilinkMenu((current) => current ? { ...current, selectedIndex: (current.selectedIndex - 1 + totalCount) % totalCount } : current)
          return true
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setWikilinkMenu((current) => current ? { ...current, selectedIndex: (current.selectedIndex + 1) % totalCount } : current)
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          if (hasCreate && activeWikilinkMenu.selectedIndex === activeWikilinkMenu.items.length) {
            wikilinkCreateRef.current(activeWikilinkMenu.query.trim())
          } else {
            const item = activeWikilinkMenu.items[activeWikilinkMenu.selectedIndex]
            if (item) {
              wikilinkSelectRef.current(item)
            }
          }
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          wikilinkMatchRef.current = null
          setWikilinkMenu(null)
          return true
        }
      }

      if (activeSlashMenu) {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSlashMenu((current) => current ? { ...current, selectedIndex: (current.selectedIndex - 1 + current.items.length) % current.items.length } : current)
          return true
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSlashMenu((current) => current ? { ...current, selectedIndex: (current.selectedIndex + 1) % current.items.length } : current)
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          const item = activeSlashMenu.items[activeSlashMenu.selectedIndex]
          if (item) {
            void slashSelectActionRef.current(item.action)
          }
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          slashMatchRef.current = null
          setSlashMenu(null)
          return true
        }
      }

      return false
    },
  }), [])

  const editor = useEditor({
    extensions,
    content: initialContentRef.current,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps,
    onUpdate: handleEditorUpdate,
  }, [extensions, editorProps, handleEditorUpdate])

  useEffect(() => {
    let cancelled = false

    void leavesApi.getTree()
      .then((items) => {
        if (cancelled) return
        linkableLeavesRef.current = items.filter((item) => item.type === 'page')
        if (editor) {
          updateWikilinkMenu(editor)
        }
      })
      .catch(() => {
        if (cancelled) return
        linkableLeavesRef.current = []
      })

    return () => {
      cancelled = true
    }
  }, [editor, updateWikilinkMenu])

  const updateEmbedNode = useCallback((tempId: string, kind: 'page' | 'database', attrs: Partial<EmbedNodeAttrs>) => {
    if (!editor) return

    let targetPos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if ((node.type.name === 'pageEmbed' || node.type.name === 'databaseEmbed') && node.attrs.tempId === tempId) {
        targetPos = pos
        return false
      }
      return true
    })

    if (targetPos === null) {
      const fallbackPos = pendingEmbedPositionsRef.current[tempId]
      const candidatePositions = [fallbackPos, fallbackPos - 1, fallbackPos + 1].filter((value): value is number => typeof value === 'number' && value >= 0)
      for (const candidate of candidatePositions) {
        const node = editor.state.doc.nodeAt(candidate)
        if (node && node.type.name === (kind === 'database' ? 'databaseEmbed' : 'pageEmbed')) {
          targetPos = candidate
          break
        }
      }
    }

    if (targetPos === null) return

    const node = editor.state.doc.nodeAt(targetPos)
    if (!node) return

    editor.view.dispatch(editor.state.tr.setNodeMarkup(targetPos, undefined, {
      ...node.attrs,
      ...attrs,
    }))
    delete pendingEmbedPositionsRef.current[tempId]
  }, [editor])

  const insertEmbedPlaceholder = useCallback(async (
    kind: 'page' | 'database',
    insertPos: number,
  ) => {
    if (!editor) return

    const tempId = createTempId()
    const type = kind === 'database' ? 'databaseEmbed' : 'pageEmbed'
    pendingEmbedPositionsRef.current[tempId] = insertPos
    editor.chain().focus().insertContentAt(insertPos, [
      {
        type,
        attrs: {
          id: '',
          title: kind === 'database' ? 'Untitled database' : 'Untitled',
          kind,
          tempId,
          status: 'pending',
          ...(kind === 'database' ? { view: 'table' } : {}),
        },
      },
      { type: 'paragraph' },
    ]).run()

    try {
      const created = kind === 'database'
        ? await onCreateDatabaseRef.current?.()
        : await onCreateSubPageRef.current?.()

      if (!created) return

      updateEmbedNode(tempId, kind, {
        id: created.id,
        title: created.title,
        tempId: null,
        status: 'ready',
        ...(kind === 'database' ? { view: created.view ?? 'table' } : {}),
      })
    } catch {
      updateEmbedNode(tempId, kind, {
        title: `Failed to create ${kind}`,
        status: 'error',
      })
    }
  }, [editor, updateEmbedNode])

  const insertWikilink = useCallback((item: LeafTreeItem) => {
    if (!editor) return
    const match = wikilinkMatchRef.current
    if (!match) return

    editor.chain()
      .focus()
      .deleteRange(match.range)
      .insertContentAt(match.range.from, [
        {
          type: 'wikilink',
          attrs: {
            id: item.id,
            label: item.title || 'Untitled',
            path: item.path,
          },
        },
        { type: 'text', text: ' ' },
      ])
      .run()

    wikilinkMatchRef.current = null
    setWikilinkMenu(null)
  }, [editor])

  const createAndInsertWikilink = useCallback(async (title: string) => {
    if (!editor) return
    const match = wikilinkMatchRef.current
    if (!match) return

    try {
      const leaf = await leavesApi.create({ title, parent_id: leafId ?? null })
      editor.chain()
        .focus()
        .deleteRange(match.range)
        .insertContentAt(match.range.from, [
          {
            type: 'wikilink',
            attrs: {
              id: leaf.id,
              label: leaf.title || title,
              path: leaf.title || title,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run()

      linkableLeavesRef.current = [...linkableLeavesRef.current, {
        id: leaf.id,
        title: leaf.title,
        path: leaf.title,
        type: leaf.type,
        parent_id: leaf.parent_id,
        children_ids: [],
        tags: leaf.tags || [],
        order: 0,
      }]
      window.dispatchEvent(new CustomEvent('leaf-tree-changed'))
    } catch {
      // silently fail — the user can retry
    }

    wikilinkMatchRef.current = null
    setWikilinkMenu(null)
  }, [editor, leafId])

  const applyAction = useCallback(async (
    action: string,
    options: { selectionPos: number; deleteRange?: { from: number; to: number } },
  ) => {
    if (!editor) return

    if (options.deleteRange) {
      editor.chain().focus().deleteRange(options.deleteRange).run()
    }

    const selectionPos = Math.max(1, options.selectionPos)

    switch (action) {
      case 'h1':
        editor.chain().focus().setTextSelection(selectionPos).setHeading({ level: 1 }).run()
        return
      case 'h2':
        editor.chain().focus().setTextSelection(selectionPos).setHeading({ level: 2 }).run()
        return
      case 'h3':
        editor.chain().focus().setTextSelection(selectionPos).setHeading({ level: 3 }).run()
        return
      case 'bold':
        editor.chain().focus().setTextSelection(selectionPos).toggleBold().run()
        return
      case 'italic':
        editor.chain().focus().setTextSelection(selectionPos).toggleItalic().run()
        return
      case 'strike':
        editor.chain().focus().setTextSelection(selectionPos).toggleStrike().run()
        return
      case 'code':
        editor.chain().focus().setTextSelection(selectionPos).toggleCode().run()
        return
      case 'bullet':
        editor.chain().focus().setTextSelection(selectionPos).toggleBulletList().run()
        return
      case 'ordered':
        editor.chain().focus().setTextSelection(selectionPos).toggleOrderedList().run()
        return
      case 'todo':
        editor.chain().focus().setTextSelection(selectionPos).toggleTaskList().run()
        return
      case 'quote':
        editor.chain().focus().setTextSelection(selectionPos).toggleBlockquote().run()
        return
      case 'columns2':
        editor.chain().focus().insertContentAt(selectionPos, [
          { type: 'columnLayout', attrs: { layout: 2, columns: createColumnData(2) } },
          { type: 'paragraph' },
        ]).run()
        return
      case 'columns3':
        editor.chain().focus().insertContentAt(selectionPos, [
          { type: 'columnLayout', attrs: { layout: 3, columns: createColumnData(3) } },
          { type: 'paragraph' },
        ]).run()
        return
      case 'subpage':
        await insertEmbedPlaceholder('page', selectionPos)
        return
      case 'database':
        await insertEmbedPlaceholder('database', selectionPos)
        return
    }
  }, [editor, insertEmbedPlaceholder])

  useEffect(() => {
    if (!editor) return

    const syncSlashMenu = () => updateSlashMenu(editor)
    const syncWikilinkMenu = () => updateWikilinkMenu(editor)
    const handleBlur = () => setTimeout(() => {
      syncSlashMenu()
      syncWikilinkMenu()
    }, 0)
    slashSelectActionRef.current = async (action: string) => {
      const match = slashMatchRef.current
      setSlashMenu(null)
      slashMatchRef.current = null
      if (!match) return
      await applyAction(action, { selectionPos: match.range.from, deleteRange: match.range })
    }
    wikilinkSelectRef.current = (item: LeafTreeItem) => {
      insertWikilink(item)
    }
    wikilinkCreateRef.current = (title: string) => {
      void createAndInsertWikilink(title)
    }

    editor.on('selectionUpdate', syncSlashMenu)
    editor.on('selectionUpdate', syncWikilinkMenu)
    editor.on('update', syncSlashMenu)
    editor.on('update', syncWikilinkMenu)
    editor.on('focus', syncSlashMenu)
    editor.on('focus', syncWikilinkMenu)
    editor.on('blur', handleBlur)

    syncSlashMenu()
    syncWikilinkMenu()

    return () => {
      editor.off('selectionUpdate', syncSlashMenu)
      editor.off('selectionUpdate', syncWikilinkMenu)
      editor.off('update', syncSlashMenu)
      editor.off('update', syncWikilinkMenu)
      editor.off('focus', syncSlashMenu)
      editor.off('focus', syncWikilinkMenu)
      editor.off('blur', handleBlur)
    }
  }, [editor, applyAction, insertWikilink, updateSlashMenu, updateWikilinkMenu])

  useEffect(() => {
    if (!editor) return
    const nextContent = normalizeLeafDocument(content)
    const serializedNext = JSON.stringify(nextContent)
    const currentContent = normalizeLeafDocument(editor.getJSON() as LeafDocument)
    const serializedCurrent = JSON.stringify(currentContent)

    if (serializedNext === lastSyncedRef.current || serializedNext === serializedCurrent) {
      lastSyncedRef.current = serializedNext
      return
    }

    editor.commands.setContent(nextContent, false)
    lastSyncedRef.current = serializedNext
  }, [editor, content])

  useEffect(() => {
    if (mode !== 'rich') {
      setSlashMenu(null)
      setWikilinkMenu(null)
    }
  }, [mode])

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || mode !== 'rich') {
      setBlockMenu(null)
      return
    }

    const container = containerRef.current
    if (!container) return

    const result = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    if (!result) return

    const domInfo = editor.view.domAtPos(result.pos)
    let element = (domInfo.node.nodeType === 3 ? domInfo.node.parentElement : domInfo.node) as HTMLElement | null

    while (element && element.parentElement && !element.parentElement.classList.contains('ProseMirror')) {
      element = element.parentElement
    }

    if (!element || !element.parentElement?.classList.contains('ProseMirror')) return

    const containerRect = container.getBoundingClientRect()
    const blockRect = element.getBoundingClientRect()

    try {
      const $pos = editor.state.doc.resolve(result.pos)
      const depth = $pos.depth > 0 ? 1 : 0
      const endPos = $pos.after(depth)
      setBlockMenu({ top: blockRect.top - containerRect.top, endPos })
    } catch {
      setBlockMenu(null)
    }
  }, [editor, mode])

  const handleBlockAction = useCallback((action: string) => {
    setMenuOpen(false)
    setBlockMenu(null)
    const pos = pendingInsertPos.current ?? editor?.state.doc.content.size ?? 1
    void applyAction(action, { selectionPos: Math.max(1, pos - 1) })
  }, [editor, applyAction])

  // ─── Drag-to-create-columns ────────────────────────────────────────────────
  const handleEditorDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!editor || !containerRef.current) return
    // Only handle when TipTap is dragging a block
    if (!editor.view.dragging) return

    const container = containerRef.current
    const proseMirror = container.querySelector('.ProseMirror')
    if (!proseMirror) return

    const EDGE_ZONE = 40 // px from left/right edge of block to trigger column drop

    // Find the top-level block element under the cursor
    let targetEl: HTMLElement | null = null
    for (const child of proseMirror.children) {
      const rect = (child as HTMLElement).getBoundingClientRect()
      if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
        targetEl = child as HTMLElement
        break
      }
    }

    if (!targetEl) {
      setColumnDropZone(null)
      columnDropRef.current = null
      return
    }

    const blockRect = targetEl.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const relX = event.clientX - blockRect.left
    const side: 'left' | 'right' | null =
      relX <= EDGE_ZONE ? 'left' :
      relX >= blockRect.width - EDGE_ZONE ? 'right' : null

    if (!side) {
      setColumnDropZone(null)
      columnDropRef.current = null
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    // Resolve the ProseMirror position of this target block
    const pos = editor.view.posAtDOM(targetEl, 0)
    try {
      const $pos = editor.state.doc.resolve(pos)
      const depth = $pos.depth > 0 ? 1 : 0
      const nodeStart = $pos.before(depth)
      const nodeEnd = $pos.after(depth)

      // Don't allow dropping onto itself
      if (dragSourceRef.current && dragSourceRef.current.pos === nodeStart) {
        setColumnDropZone(null)
        columnDropRef.current = null
        return
      }

      // Don't allow dropping on columnLayout or embed nodes
      const targetNode = editor.state.doc.nodeAt(nodeStart)
      if (targetNode && (
        targetNode.type.name === 'columnLayout' ||
        targetNode.type.name === 'databaseEmbed' ||
        targetNode.type.name === 'pageEmbed'
      )) {
        setColumnDropZone(null)
        columnDropRef.current = null
        return
      }

      columnDropRef.current = { targetNodePos: nodeStart, targetNodeEnd: nodeEnd, side }

      // Show indicator
      const indicatorWidth = 3
      setColumnDropZone({
        top: blockRect.top - containerRect.top,
        left: side === 'left' ? blockRect.left - containerRect.left - 1 : blockRect.right - containerRect.left - 1,
        width: indicatorWidth,
        height: blockRect.height,
        side,
      })
    } catch {
      setColumnDropZone(null)
      columnDropRef.current = null
    }
  }, [editor])

  const handleEditorDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const dropInfo = columnDropRef.current
    const source = dragSourceRef.current
    if (!dropInfo || !source || !editor || !editor.view.dragging) return

    event.preventDefault()
    event.stopPropagation()
    setColumnDropZone(null)
    columnDropRef.current = null
    dragSourceRef.current = null

    const { targetNodePos, targetNodeEnd, side } = dropInfo
    const { pos: sourcePos, end: sourceEnd } = source

    // Don't drop a block onto itself
    if (sourcePos === targetNodePos) {
      editor.view.dragging = null
      return
    }

    const targetNode = editor.state.doc.nodeAt(targetNodePos)
    const sourceNode = editor.state.doc.nodeAt(sourcePos)
    if (!targetNode || !sourceNode) {
      editor.view.dragging = null
      return
    }

    // Serialize both nodes as LeafDocument content for columns
    const serializeNodeToDoc = (node: import('@tiptap/pm/model').Node): LeafDocument => {
      return normalizeLeafDocument({ type: 'doc', version: 1, content: [node.toJSON()] } as LeafDocument)
    }

    const targetDoc = serializeNodeToDoc(targetNode)
    const sourceDoc = serializeNodeToDoc(sourceNode)

    // Determine column order based on drop side
    const leftDoc = side === 'left' ? sourceDoc : targetDoc
    const rightDoc = side === 'left' ? targetDoc : sourceDoc

    const columns: LeafColumn[] = [
      { id: createTempId(), content: leftDoc },
      { id: createTempId(), content: rightDoc },
    ]

    // Clear TipTap's dragging state to prevent default drop
    editor.view.dragging = null

    const { tr } = editor.state
    const columnNode = editor.state.schema.nodes.columnLayout.create({ layout: 2, columns })

    // Process the later position first so earlier positions remain valid
    if (sourcePos > targetNodePos) {
      tr.delete(sourcePos, sourceEnd)
      tr.replaceWith(targetNodePos, targetNodeEnd, columnNode)
    } else {
      tr.replaceWith(targetNodePos, targetNodeEnd, columnNode)
      tr.delete(sourcePos, sourceEnd)
    }

    editor.view.dispatch(tr)
  }, [editor])

  const handleEditorDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    // Only clear if actually leaving the container, not entering a child
    const container = containerRef.current
    if (container && event.relatedTarget && container.contains(event.relatedTarget as globalThis.Node)) return
    setColumnDropZone(null)
    columnDropRef.current = null
  }, [])

  const handleEditorDragEnd = useCallback(() => {
    setColumnDropZone(null)
    columnDropRef.current = null
    dragSourceRef.current = null
  }, [])

  const handleModeChange = useCallback((nextMode: 'rich' | 'markdown') => {
    if (nextMode === mode) return

    if (nextMode === 'markdown' && editor) {
      setMarkdownValue(htmlToMarkdown(editor.getHTML()))
    }

    if (nextMode === 'rich' && editor) {
      editor.commands.setContent(markdownToHtml(markdownValue))
      const document = normalizeLeafDocument(editor.getJSON() as LeafDocument)
      lastSyncedRef.current = JSON.stringify(document)
      onUpdateRef.current(document)
    }

    onModeChangeRef.current(nextMode)
    const sourceDocument = editor ? normalizeLeafDocument(editor.getJSON() as LeafDocument) : createEmptyLeafDocument()
    const words = getLeafContentText(sourceDocument).trim().split(/\s+/).filter(Boolean).length
    onStatusChangeRef.current?.(nextMode, words)
  }, [editor, markdownValue, mode])

  const handleExport = useCallback(() => {
    const text = mode === 'rich' && editor ? htmlToMarkdown(editor.getHTML()) : markdownValue
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'leaf-export.md' }).click()
    URL.revokeObjectURL(url)
  }, [editor, markdownValue, mode])

  const handleImport = useCallback(() => fileInputRef.current?.click(), [])

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      if (mode === 'markdown') {
        setMarkdownValue(text)
      } else if (editor) {
        editor.commands.setContent(markdownToHtml(text))
        const document = normalizeLeafDocument(editor.getJSON() as LeafDocument)
        lastSyncedRef.current = JSON.stringify(document)
        onUpdateRef.current(document)
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }, [editor, mode])

  useEffect(() => {
    if (actionsRef) {
      actionsRef.current = {
        exportMd: handleExport,
        importMd: handleImport,
        setMode: handleModeChange,
      }
    }
  }, [actionsRef, handleExport, handleImport, handleModeChange])

  return (
    <div className="flex flex-col">
      <input ref={fileInputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={onFileChange} />

      {mode === 'rich' ? (
        <div
          className="relative"
          style={{ paddingLeft: 60 }}
          onMouseMove={(event) => {
            if (hideTimer.current) {
              clearTimeout(hideTimer.current)
              hideTimer.current = null
            }
            handleMouseMove(event)
          }}
          onMouseLeave={() => {
            if (menuOpen) return
            hideTimer.current = setTimeout(() => setBlockMenu(null), 300)
          }}
        >
          <div
            ref={containerRef}
            className="relative"
            onDragOver={handleEditorDragOver}
            onDragLeave={handleEditorDragLeave}
            onDrop={handleEditorDrop}
          >
            {columnDropZone && (
              <div
                style={{
                  position: 'absolute',
                  top: columnDropZone.top,
                  left: columnDropZone.left,
                  width: columnDropZone.width,
                  height: columnDropZone.height,
                  background: 'var(--leaf-green)',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  zIndex: 20,
                  transition: 'top 0.1s, left 0.1s, height 0.1s',
                }}
              />
            )}
            {blockMenu && (
              <div
                style={{ position: 'absolute', top: blockMenu.top - 2, left: -56, display: 'flex', alignItems: 'center', gap: 2 }}
                onMouseEnter={() => {
                  if (hideTimer.current) {
                    clearTimeout(hideTimer.current)
                    hideTimer.current = null
                  }
                }}
              >
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pendingInsertPos.current = blockMenu.endPos
                    setMenuOpen((current) => !current)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 hover:bg-black/5"
                  style={{ color: 'var(--leaf-text-muted)' }}
                  title="Insert block"
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md cursor-grab transition-colors duration-150 hover:bg-black/5 active:cursor-grabbing"
                  style={{ color: 'var(--leaf-text-muted)' }}
                  title="Drag to move"
                  draggable
                  onDragStart={(event) => {
                    if (!editor) return
                    try {
                      const $pos = editor.state.doc.resolve(Math.max(0, blockMenu.endPos - 1))
                      const depth = $pos.depth > 0 ? 1 : 0
                      const nodeStart = $pos.before(depth)
                      const nodeEnd = $pos.after(depth)
                      const slice = editor.state.doc.slice(nodeStart, nodeEnd)
                      const serializer = DOMSerializer.fromSchema(editor.state.schema)
                      const fragment = serializer.serializeFragment(slice.content)
                      const wrapper = document.createElement('div')
                      wrapper.appendChild(fragment)
                      event.dataTransfer.clearData()
                      event.dataTransfer.setData('text/html', wrapper.innerHTML)
                      event.dataTransfer.setData('text/plain', wrapper.textContent || '')
                      event.dataTransfer.effectAllowed = 'move'
                      editor.view.dragging = { slice, move: true }
                      dragSourceRef.current = { pos: nodeStart, end: nodeEnd }
                    } catch {
                      // fallback: let browser handle
                      dragSourceRef.current = null
                    }
                  }}
                  onDragEnd={handleEditorDragEnd}
                >
                  <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                    <circle cx="5" cy="3" r="1.2" fill="currentColor" />
                    <circle cx="9" cy="3" r="1.2" fill="currentColor" />
                    <circle cx="5" cy="7" r="1.2" fill="currentColor" />
                    <circle cx="9" cy="7" r="1.2" fill="currentColor" />
                    <circle cx="5" cy="11" r="1.2" fill="currentColor" />
                    <circle cx="9" cy="11" r="1.2" fill="currentColor" />
                  </svg>
                </button>
                {menuOpen && <BlockDropdown onSelect={handleBlockAction} onClose={() => setMenuOpen(false)} />}
              </div>
            )}
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : (
        <textarea
          className="min-h-[50vh] w-full resize-none bg-transparent font-mono text-sm leading-relaxed focus:outline-none"
          style={{ color: 'var(--leaf-text-body)' }}
          value={markdownValue}
          onChange={(event) => setMarkdownValue(event.target.value)}
          placeholder="Write markdown here…"
        />
      )}

      {slashMenu && (
        <SlashMenuPanel
          menu={slashMenu}
          onSelect={(item) => {
            const match = slashMatchRef.current
            setSlashMenu(null)
            slashMatchRef.current = null
            if (!match) return
            void applyAction(item.action, { selectionPos: match.range.from, deleteRange: match.range })
          }}
        />
      )}

      {wikilinkMenu && (
        <WikilinkPanel
          menu={wikilinkMenu}
          onSelect={(item) => {
            insertWikilink(item)
          }}
          onCreate={(title) => {
            void createAndInsertWikilink(title)
          }}
        />
      )}
    </div>
  )
}
