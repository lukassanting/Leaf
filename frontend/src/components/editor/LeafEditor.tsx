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

import 'tippy.js/dist/tippy.css'

import { useRouter } from 'next/navigation'
import { BubbleMenu, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react'
import { Node, mergeAttributes, InputRule, isTextSelection } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Link from '@tiptap/extension-link'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'
import { tables as turndownTables } from 'turndown-plugin-gfm'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { LeafTableView } from '@/components/editor/LeafTableView'
import { leavesApi, type Database, type LeafTreeItem, type LeafDocument } from '@/lib/api'
import { DatabaseIcon, LeafIcon } from '@/components/Icons'
import { EditorSelectionBubble } from './EditorSelectionBubble'
import { CodeBlockLangBubble } from '@/components/editor/CodeBlockLangBubble'
import { ImageInsertDialog } from '@/components/editor/ImageInsertDialog'
import { leafCodeLowlight } from '@/components/editor/codeLowlight'
import { LeafImage, LinkCard } from '@/components/editor/editorBlocks'
import { EmbeddedDatabaseBlock } from '@/components/database/EmbeddedDatabaseBlock'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { ensureTagEntries } from '@/lib/workspaceDefaults'
import { databasesApi } from '@/lib/api'

import { LEAF_TEXT_COLOR_SWATCHES, STORY_TAG_PRESETS, parseStoryTagAction } from '@/lib/editorRichText'
import { createEmptyLeafDocument, getLeafContentText, normalizeLeafDocument } from '@/lib/leafDocument'
import { rankSlashItems, SLASH_ITEMS, type SlashMenuState, SlashMenuPanel } from '@/components/SlashCommands'
import { StoryTag } from '@/components/editor/storyTagExtension'
import { computeSlashMatch, computeWikilinkMatch, type EditorSlashMatch } from '@/components/editor/slashMatchUtils'

import { Callout, CALLOUT_VARIANTS, CALLOUT_VARIANT_META, type CalloutVariant } from '@/components/editor/calloutExtension'

function selectionBubbleShouldShow({
  editor,
  view,
  state,
  from,
  to,
  element,
}: {
  editor: import('@tiptap/core').Editor
  view: import('@tiptap/pm/view').EditorView
  state: import('@tiptap/pm/state').EditorState
  from: number
  to: number
  element: HTMLElement
}): boolean {
  const { doc, selection } = state
  const { empty } = selection
  if (!editor.isEditable) return false
  // Align/colour bubble only applies to text — not embeds, images, etc.
  if (selection instanceof NodeSelection) return false
  const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(selection)
  const isChildOfMenu = element.contains(document.activeElement)
  const hasEditorFocus = view.hasFocus() || isChildOfMenu
  if (!hasEditorFocus || empty || isEmptyTextBlock) return false
  if (editor.isActive('code') || editor.isActive('codeBlock')) return false
  return true
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
turndown.use([turndownTables])
turndown.addRule('leafToggleCard', {
  filter(node) {
    return node.nodeName === 'DIV' && (node as HTMLElement).getAttribute('data-type') === 'toggle-card'
  },
  replacement(_content, node) {
    return `\n\n${(node as HTMLElement).outerHTML}\n\n`
  },
})
turndown.addRule('leafStoryTag', {
  filter(node) {
    return node.nodeName === 'SPAN' && (node as HTMLElement).getAttribute('data-type') === 'story-tag'
  },
  replacement(_content, node) {
    const el = node as HTMLElement
    return `[${el.getAttribute('data-label') || el.textContent || ''}]`
  },
})
turndown.addRule('leafStatStrip', {
  filter(node) {
    return node.nodeName === 'DIV' && (node as HTMLElement).getAttribute('data-type') === 'stat-strip'
  },
  replacement(_content, node) {
    return `\n\n${(node as HTMLElement).outerHTML}\n\n`
  },
})
turndown.addRule('leafCallout', {
  filter(node) {
    return node.nodeName === 'DIV' && (node as HTMLElement).getAttribute('data-type') === 'callout'
  },
  replacement(_content, node) {
    return `\n\n${(node as HTMLElement).outerHTML}\n\n`
  },
})
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

type WikilinkMenuState = {
  items: LeafTreeItem[]
  query: string
  selectedIndex: number
  rect: SlashMenuState['rect']
}

type BlockMenuState = {
  top: number
  height: number
  endPos: number
  nodeStart: number
  nodeType: string
} | null

type EmbedNodeAttrs = {
  id: string
  title: string
  kind: 'page' | 'database'
  tempId: string | null
  status: 'pending' | 'ready' | 'error'
  view?: Database['view_type']
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
          borderColor: status === 'error' ? '#f2c4bc' : 'var(--leaf-border-soft)',
          background: status === 'pending' ? 'var(--leaf-segment-bg)' : 'var(--leaf-bg-elevated)',
          cursor: canNavigate ? 'pointer' : 'default',
          boxShadow: '0 1px 2px color-mix(in srgb, var(--foreground) 4%, transparent)',
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
          style={{ background: 'var(--leaf-segment-bg)', color: 'var(--leaf-text-title)' }}
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

  const handleDelete = useCallback(() => {
    if (!confirm('Move this database to Trash? You can restore it from Settings → Trash.')) return
    if (id) {
      void databasesApi.delete(id).then(() => {
        deleteNode()
        window.dispatchEvent(new CustomEvent('leaf-tree-changed'))
      }).catch(console.error)
    } else {
      deleteNode()
    }
  }, [deleteNode, id])

  if (status !== 'ready' || !id) {
    return (
      <NodeViewWrapper className="my-2">
        <div
          contentEditable={false}
          className="group flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: status === 'error' ? '#f2c4bc' : 'var(--leaf-border-soft)',
            background: status === 'pending' ? 'var(--leaf-segment-bg)' : 'var(--leaf-bg-elevated)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--foreground) 4%, transparent)',
          }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--leaf-segment-bg)', color: 'var(--leaf-text-title)' }}
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
            onClick={(event) => { event.stopPropagation(); handleDelete() }}
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
      <div contentEditable={false}>
        <EmbeddedDatabaseBlock id={id} onDeleteDatabase={handleDelete} />
      </div>
    </NodeViewWrapper>
  )
}

function ColumnListView({
  node,
  editor,
  getPos,
}: {
  node: import('@tiptap/pm/model').Node
  editor: import('@tiptap/core').Editor
  getPos: () => number | undefined
  deleteNode: () => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [handles, setHandles] = useState<{ left: number; height: number }[]>([])
  const resizingRef = useRef(false)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const measure = () => {
      if (resizingRef.current) return
      const contentEl = el.querySelector('[data-node-view-content]') as HTMLElement | null
      if (!contentEl) return

      const cols = Array.from(contentEl.querySelectorAll(':scope > [data-type="column"], :scope > [data-node-view-content-react] > [data-type="column"]')) as HTMLElement[]

      if (cols.length < 2) { setHandles([]); return }

      const wrapperRect = el.getBoundingClientRect()
      const next: { left: number; height: number }[] = []
      for (let i = 0; i < cols.length - 1; i++) {
        const leftRect = cols[i].getBoundingClientRect()
        const rightRect = cols[i + 1].getBoundingClientRect()
        next.push({
          left: (leftRect.right + rightRect.left) / 2 - wrapperRect.left,
          height: Math.max(leftRect.height, rightRect.height, 40),
        })
      }
      setHandles(next)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const onUpdate = () => requestAnimationFrame(measure)
    editor.on('update', onUpdate)
    return () => { ro.disconnect(); editor.off('update', onUpdate) }
  }, [editor, node.childCount])

  const startResize = useCallback((event: React.MouseEvent, handleIndex: number) => {
    event.preventDefault()
    event.stopPropagation()

    const pos = getPos()
    if (typeof pos !== 'number') return
    const el = wrapperRef.current
    if (!el) return
    const contentEl = el.querySelector('[data-node-view-content]') as HTMLElement | null
    if (!contentEl) return

    const colEls = Array.from(contentEl.querySelectorAll(':scope > [data-type="column"], :scope > [data-node-view-content-react] > [data-type="column"]')) as HTMLElement[]
    const gapPx = 16
    const containerWidth = el.getBoundingClientRect().width - (colEls.length - 1) * gapPx

    const numCols = node.childCount
    const startX = event.clientX
    const leftCol = node.child(handleIndex)
    const rightCol = node.child(handleIndex + 1)
    const lw = (leftCol.attrs.width as number | null) || (1 / numCols)
    const rw = (rightCol.attrs.width as number | null) || (1 / numCols)
    const total = lw + rw

    resizingRef.current = true
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX
      const dFrac = dx / containerWidth
      const newLW = Math.max(0.15, Math.min(total - 0.15, lw + dFrac))
      const newRW = total - newLW
      if (colEls[handleIndex]) colEls[handleIndex].style.flex = `0 0 ${(newLW * 100).toFixed(1)}%`
      if (colEls[handleIndex + 1]) colEls[handleIndex + 1].style.flex = `0 0 ${(newRW * 100).toFixed(1)}%`
    }

    const onUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizingRef.current = false
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const dx = e.clientX - startX
      const dFrac = dx / containerWidth
      const newLW = Math.max(0.15, Math.min(total - 0.15, lw + dFrac))
      const newRW = total - newLW

      const currentPos = getPos()
      if (typeof currentPos !== 'number') return
      const columnListNode = editor.state.doc.nodeAt(currentPos)
      if (!columnListNode || columnListNode.type.name !== 'columnList') return

      const { tr } = editor.state
      let childPos = currentPos + 1
      for (let i = 0; i < numCols; i++) {
        const child = columnListNode.child(i)
        if (i === handleIndex) {
          tr.setNodeMarkup(childPos, undefined, { ...child.attrs, width: parseFloat(newLW.toFixed(4)) })
        } else if (i === handleIndex + 1) {
          tr.setNodeMarkup(childPos, undefined, { ...child.attrs, width: parseFloat(newRW.toFixed(4)) })
        }
        childPos += child.nodeSize
      }
      editor.view.dispatch(tr)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [node, editor, getPos])

  /* Unwrap the column list: move all column children into the parent doc as
     sequential blocks, then delete the now-empty columnList shell. */
  const unwrapColumns = useCallback(() => {
    const pos = getPos()
    if (typeof pos !== 'number') return
    const colList = editor.state.doc.nodeAt(pos)
    if (!colList) return

    const blocks: import('@tiptap/pm/model').Node[] = []
    colList.forEach((col) => {
      col.forEach((block) => blocks.push(block))
    })

    const { tr } = editor.state
    tr.replaceWith(pos, pos + colList.nodeSize, blocks)
    editor.view.dispatch(tr)
  }, [editor, getPos])

  return (
    <NodeViewWrapper ref={wrapperRef} className="column-list-wrapper group/cols my-2 relative" data-type="column-list">
      <div contentEditable={false} className="absolute -top-3 right-0 z-10">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation(); unwrapColumns() }}
          className="rounded-md px-2 py-0.5 text-[11px] opacity-0 transition-opacity group-hover/cols:opacity-100"
          style={{
            color: 'var(--leaf-text-muted)',
            background: 'var(--leaf-bg-editor)',
            border: '1px solid var(--leaf-border-soft)',
          }}
        >
          Remove columns
        </button>
      </div>
      <NodeViewContent className="column-list-inner" />
      {handles.map((h, i) => (
        <div
          key={i}
          contentEditable={false}
          className={`column-resize-handle${isResizing ? ' is-resizing' : ''}`}
          style={{ left: h.left, top: 0, height: h.height }}
          onMouseDown={(e) => startResize(e, i)}
        />
      ))}
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
      kind: { default: 'page' },
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
      'data-kind': node.attrs.kind || 'page',
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

const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,
  addAttributes() {
    return {
      width: {
        default: null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {}
          return {
            'data-col-width': String(attributes.width),
            style: `flex: 0 0 ${((attributes.width as number) * 100).toFixed(1)}%; min-width: 100px;`,
          }
        },
        parseHTML: (element: HTMLElement) => {
          const w = element.getAttribute('data-col-width')
          return w ? parseFloat(w) : null
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'column' }, HTMLAttributes), 0]
  },
})

const ColumnList = Node.create({
  name: 'columnList',
  group: 'block',
  content: 'column{2,6}',
  defining: true,
  isolating: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column-list"]' }]
  },
  renderHTML() {
    return ['div', { 'data-type': 'column-list' }, 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnListView as never)
  },
})

function ToggleCardView({ node, updateAttributes }: NodeViewProps) {
  const open = node.attrs.open !== false && node.attrs.open !== 'false'
  const accent = ((Number(node.attrs.accent) || 0) % 5 + 5) % 5

  return (
    <NodeViewWrapper className="leaf-toggle-card-node">
      <div
        className={`leaf-toggle-card leaf-toggle-card--accent-${accent}`}
        data-open={open ? 'true' : 'false'}
      >
        <button
          type="button"
          className="leaf-toggle-card-chevron"
          aria-expanded={open}
          aria-label={open ? 'Collapse card' : 'Expand card'}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation()
            updateAttributes({ open: !open })
          }}
        >
          ▾
        </button>
        <NodeViewContent className="leaf-toggle-card-content" />
      </div>
    </NodeViewWrapper>
  )
}

const ToggleCardEyebrow = Node.create({
  name: 'toggleCardEyebrow',
  group: '',
  content: 'inline*',
  defining: true,
  selectable: false,
  parseHTML() {
    return [{ tag: 'div[data-type="toggleCardEyebrow"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'toggleCardEyebrow', class: 'leaf-toggle-card-eyebrow' }, HTMLAttributes), 0]
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => false,
    }
  },
})

const ToggleCardTitle = Node.create({
  name: 'toggleCardTitle',
  group: '',
  content: 'inline*',
  defining: true,
  selectable: false,
  parseHTML() {
    return [{ tag: 'div[data-type="toggleCardTitle"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'toggleCardTitle', class: 'leaf-toggle-card-title' }, HTMLAttributes), 0]
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => false,
    }
  },
})

const ToggleCardSubtitle = Node.create({
  name: 'toggleCardSubtitle',
  group: '',
  content: 'inline*',
  defining: true,
  selectable: false,
  parseHTML() {
    return [{ tag: 'div[data-type="toggleCardSubtitle"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'toggleCardSubtitle', class: 'leaf-toggle-card-subtitle' }, HTMLAttributes), 0]
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => false,
    }
  },
})

const ToggleCard = Node.create({
  name: 'toggleCard',
  group: 'block',
  content: 'toggleCardEyebrow toggleCardTitle toggleCardSubtitle block+',
  defining: true,
  isolating: true,
  draggable: true,
  addAttributes() {
    return {
      open: { default: true },
      accent: { default: 0 },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle-card"]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false
          return {
            open: element.getAttribute('data-open') !== 'false',
            accent: parseInt(element.getAttribute('data-accent') || '0', 10) || 0,
          }
        },
        contentElement: '[data-toggle-card-content]',
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'toggle-card',
          'data-open': node.attrs.open === false ? 'false' : 'true',
          'data-accent': String(node.attrs.accent ?? 0),
        },
        HTMLAttributes,
      ),
      ['div', { 'data-toggle-card-content': '' }, 0],
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleCardView as never)
  },
})

function StatStripView({ node, updateAttributes }: NodeViewProps) {
  const cols = Math.min(4, Math.max(2, Number(node.attrs.columns) || 3))
  const variant = (node.attrs.variant as CalloutVariant) || 'gray'
  const allPairs: [string, string][] = [
    ['kicker0', 'title0'],
    ['kicker1', 'title1'],
    ['kicker2', 'title2'],
    ['kicker3', 'title3'],
  ]
  const pairs = allPairs.slice(0, cols)
  return (
    <NodeViewWrapper className={`leaf-stat-strip leaf-stat-strip--${variant}`}>
      <div className="leaf-stat-strip-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {pairs.map(([k, t]) => (
          <div key={k} className="leaf-stat-strip-cell">
            <input
              type="text"
              className="leaf-stat-strip-kicker"
              placeholder="Kicker"
              value={String((node.attrs as Record<string, string>)[k] ?? '')}
              onChange={(e) => updateAttributes({ [k]: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <input
              type="text"
              className="leaf-stat-strip-title"
              placeholder="Value"
              value={String((node.attrs as Record<string, string>)[t] ?? '')}
              onChange={(e) => updateAttributes({ [t]: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    </NodeViewWrapper>
  )
}

const StatStrip = Node.create({
  name: 'statStrip',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      columns: { default: 3 },
      variant: { default: 'gray' },
      kicker0: { default: '' },
      title0: { default: '' },
      kicker1: { default: '' },
      title1: { default: '' },
      kicker2: { default: '' },
      title2: { default: '' },
      kicker3: { default: '' },
      title3: { default: '' },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="stat-strip"]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false
          const g = (name: string) => element.getAttribute(`data-${name}`) ?? ''
          return {
            columns: parseInt(g('columns') || '3', 10) || 3,
            variant: g('variant') || 'gray',
            kicker0: g('kicker0'), title0: g('title0'),
            kicker1: g('kicker1'), title1: g('title1'),
            kicker2: g('kicker2'), title2: g('title2'),
            kicker3: g('kicker3'), title3: g('title3'),
          }
        },
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs as Record<string, string>
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'stat-strip',
          'data-columns': String(a.columns ?? 3),
          'data-variant': a.variant ?? 'gray',
          'data-kicker0': a.kicker0 ?? '', 'data-title0': a.title0 ?? '',
          'data-kicker1': a.kicker1 ?? '', 'data-title1': a.title1 ?? '',
          'data-kicker2': a.kicker2 ?? '', 'data-title2': a.title2 ?? '',
          'data-kicker3': a.kicker3 ?? '', 'data-title3': a.title3 ?? '',
          class: 'leaf-stat-strip-host',
        },
        HTMLAttributes,
      ),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(StatStripView as never)
  },
})

/* ── Callout node view ─────── */
function CalloutView({ node }: NodeViewProps) {
  const variant = (node.attrs.variant as CalloutVariant) || 'gray'
  return (
    <NodeViewWrapper
      className={`leaf-callout leaf-callout--${variant}`}
      data-type="callout"
      data-variant={variant}
    >
      <NodeViewContent className="leaf-callout-content" />
    </NodeViewWrapper>
  )
}

function BlockDropdown({ blockMenu, editor, onSelect, onClose }: {
  blockMenu: NonNullable<BlockMenuState>
  editor: import('@tiptap/core').Editor | null
  onSelect: (action: string) => void
  onClose: () => void
}) {
  const groups = ['Text', 'Style', 'Structure', 'Insert', 'Toggle Cards'] as const
  const hasColour = blockMenu.nodeType === 'callout' || blockMenu.nodeType === 'statStrip'
  const blockNode = hasColour && editor ? editor.state.doc.nodeAt(blockMenu.nodeStart) : null
  const currentVariant = (blockNode?.attrs.variant as CalloutVariant) || 'gray'
  const isStatStrip = blockMenu.nodeType === 'statStrip'
  const currentColumns = isStatStrip ? (Number(blockNode?.attrs.columns) || 3) : 0

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        className="absolute z-50 overflow-y-auto rounded-lg"
        style={{
          top: 28,
          left: 0,
          width: 240,
          maxHeight: 420,
          background: 'var(--leaf-bg-elevated)',
          border: '1px solid var(--leaf-border-strong)',
          boxShadow: '0 4px 20px color-mix(in srgb, var(--foreground) 10%, transparent)',
        }}
      >
        {/* ── Contextual: colour picker (callout + stat strip) ─── */}
        {hasColour && editor && blockNode && (
          <div>
            <div className="px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--leaf-text-muted)' }}>
              Colour
            </div>
            <div className="flex flex-wrap gap-1 px-2.5 pb-2">
              {CALLOUT_VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  title={CALLOUT_VARIANT_META[v].label}
                  style={{
                    background: CALLOUT_VARIANT_META[v].dot,
                    width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                    outline: v === currentVariant ? '2px solid var(--leaf-green)' : 'none',
                    outlineOffset: 1,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const tr = editor.state.tr.setNodeMarkup(blockMenu.nodeStart, undefined, { ...blockNode.attrs, variant: v })
                    editor.view.dispatch(tr)
                    onClose()
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Contextual: stat strip column count ─── */}
        {isStatStrip && editor && blockNode && (
          <div>
            <div className="px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--leaf-text-muted)' }}>
              Columns
            </div>
            <div className="flex gap-1 px-2.5 pb-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="flex items-center justify-center rounded-md text-xs font-medium transition-colors duration-100"
                  style={{
                    width: 32, height: 28, cursor: 'pointer',
                    border: n === currentColumns ? '1.5px solid var(--leaf-green)' : '1px solid var(--leaf-border-soft)',
                    background: n === currentColumns ? 'color-mix(in srgb, var(--leaf-green) 12%, transparent)' : 'transparent',
                    color: n === currentColumns ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const tr = editor.state.tr.setNodeMarkup(blockMenu.nodeStart, undefined, { ...blockNode.attrs, columns: n })
                    editor.view.dispatch(tr)
                    onClose()
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Delete ─── */}
        <div>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-100 hover:bg-red-500/10"
            style={{ color: 'var(--leaf-text-title)' }}
            onMouseDown={(e) => {
              e.preventDefault()
              if (!editor) return
              try {
                editor.chain().focus().deleteRange({ from: blockMenu.nodeStart, to: blockMenu.endPos }).run()
              } catch { /* ignore */ }
              onClose()
            }}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--leaf-text-muted)' }}>
              <path d="M5.5 2h5M2.5 4h11M6 4v8M10 4v8M3.5 4l.75 9.5a1 1 0 001 .5h5.5a1 1 0 001-.5L12.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete
          </button>
        </div>

        {/* ── Separator ─── */}
        <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--leaf-border-soft)' }} />

        {/* ── Insert block types ─── */}
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
        background: 'var(--leaf-bg-elevated)',
        borderColor: 'var(--leaf-border-strong)',
        boxShadow: '0 12px 32px color-mix(in srgb, var(--foreground) 14%, transparent)',
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div
        className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-[0.09em]"
        style={{ color: 'var(--leaf-text-muted)', borderColor: 'var(--leaf-border-soft)' }}
      >
        Link to page or database
      </div>
      {menu.items.map((item, index) => {
        const isSelected = index === menu.selectedIndex
        const isDb = item.kind === 'database'
        return (
          <button
            key={item.id}
            type="button"
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-100"
            style={{ backgroundColor: isSelected ? 'var(--leaf-bg-hover)' : 'var(--leaf-bg-elevated)' }}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(item)
            }}
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--leaf-bg-tag)', color: 'var(--leaf-green)' }}
            >
              {isDb ? <DatabaseIcon size={13} /> : <LeafIcon size={14} />}
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
            backgroundColor: isCreateSelected ? 'var(--leaf-bg-hover)' : 'var(--leaf-bg-elevated)',
            borderTop: menu.items.length > 0 ? '1px solid var(--leaf-border-soft)' : undefined,
          }}
          onMouseDown={(event) => {
            event.preventDefault()
            onCreate(menu.query.trim())
          }}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--leaf-green) 12%, transparent)', color: 'var(--leaf-green)' }}
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
  const imageInsertPosRef = useRef(1)
  const [imageInsertOpen, setImageInsertOpen] = useState(false)
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
  const slashMatchRef = useRef<EditorSlashMatch | null>(null)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashSelectActionRef = useRef<(action: string) => void>(() => {})
  const wikilinkMatchRef = useRef<EditorSlashMatch | null>(null)
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

    const items = rankSlashItems(match.query).filter(
      (item) => !item.requiresTable || instance.isActive('table'),
    )
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
      codeBlock: false,
      dropcursor: {
        color: 'var(--leaf-green)',
        width: 2,
      },
    }),
    CodeBlockLowlight.configure({
      lowlight: leafCodeLowlight,
      defaultLanguage: 'plaintext',
      HTMLAttributes: { class: 'leaf-code-block hljs' },
    }),
    Link.configure({
      openOnClick: true,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        class: 'leaf-external-link',
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    LeafImage,
    LinkCard,
    TextStyle,
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph', 'blockquote', 'callout', 'tableCell', 'tableHeader'] }),
    WikilinkNode,
    HashtagNode,
    StoryTag,
    Column,
    ColumnList,
    ToggleCardEyebrow,
    ToggleCardTitle,
    ToggleCardSubtitle,
    ToggleCard,
    Callout.extend({ addNodeView() { return ReactNodeViewRenderer(CalloutView as never) } }),
    StatStrip,
    PageEmbed,
    DatabaseEmbed,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({
      resizable: true,
      HTMLAttributes: { class: 'leaf-prose-table' },
      cellMinWidth: 48,
      handleWidth: 6,
      View: LeafTableView,
    }),
    TableRow,
    TableHeader,
    TableCell,
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
          const kind = wikilink.getAttribute('data-kind')
          routerRef.current.push(kind === 'database' ? `/databases/${id}` : `/editor/${id}`)
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
    handleDrop: (view: import('@tiptap/pm/view').EditorView, event: DragEvent) => {
      // ProseMirror sets view.dragging = null BEFORE calling this handler,
      // so we rely on our own refs to detect column-zone drops.
      const dropInfo = columnDropRef.current
      const source = dragSourceRef.current
      if (!dropInfo || !source) return false

      // Column-zone drop — handle it here so ProseMirror doesn't process it
      event.preventDefault()
      setColumnDropZone(null)
      columnDropRef.current = null
      dragSourceRef.current = null

      const { targetNodePos, targetNodeEnd, side } = dropInfo
      const { pos: sourcePos, end: sourceEnd } = source

      if (sourcePos === targetNodePos) {
        return true
      }

      const targetNode = view.state.doc.nodeAt(targetNodePos)
      const sourceNode = view.state.doc.nodeAt(sourcePos)
      if (!targetNode || !sourceNode) {
        return true
      }

      const schema = view.state.schema
      const leftContent = side === 'left' ? sourceNode : targetNode
      const rightContent = side === 'left' ? targetNode : sourceNode
      const leftColumn = schema.nodes.column.create(null, [leftContent.copy(leftContent.content)])
      const rightColumn = schema.nodes.column.create(null, [rightContent.copy(rightContent.content)])
      const columnListNode = schema.nodes.columnList.create(null, [leftColumn, rightColumn])

      const { tr } = view.state
      if (sourcePos > targetNodePos) {
        tr.delete(sourcePos, sourceEnd)
        tr.replaceWith(targetNodePos, targetNodeEnd, columnListNode)
      } else {
        tr.replaceWith(targetNodePos, targetNodeEnd, columnListNode)
        tr.delete(sourcePos, sourceEnd)
      }

      view.dispatch(tr)
      return true
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
    if (!editor) return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ ordinal?: number }>).detail
      if (typeof detail?.ordinal !== 'number') return
      let i = 0
      let foundPos: number | null = null
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          if (i === detail.ordinal) {
            foundPos = pos
            return false
          }
          i++
        }
        return true
      })
      if (foundPos === null) return
      const inner = foundPos + 1
      editor.chain().focus().setTextSelection(inner).run()
      // Use DOM scrolling — ProseMirror's scrollIntoView doesn't reach the outer scroll container
      const domAtPos = editor.view.domAtPos(foundPos)
      const el = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener('leaf-outline-jump', handler as EventListener)
    return () => window.removeEventListener('leaf-outline-jump', handler as EventListener)
  }, [editor])

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      leavesApi.getTree({ includeDbRows: false }),
      databasesApi.list(),
    ]).then(([treeItems, databases]) => {
      if (cancelled) return
      const pages: LeafTreeItem[] = treeItems
        .filter((item) => item.type === 'page')
        .map((item) => ({ ...item, kind: 'page' as const }))
      const dbItems: LeafTreeItem[] = databases.map((db) => ({
        id: db.id,
        title: db.title || 'Untitled database',
        path: db.title || 'Untitled database',
        type: 'page' as const,
        kind: 'database' as const,
        parent_id: null,
        children_ids: [],
        tags: [],
        order: 0,
      }))
      linkableLeavesRef.current = [...pages, ...dbItems]
      if (editor) updateWikilinkMenu(editor)
    }).catch(() => {
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
            kind: item.kind ?? 'page',
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
      const parentId = leafId && leafId.trim() ? leafId : null
      const leaf = await leavesApi.create({ title, parent_id: parentId, tags: [] })
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

  const handleImageInsertConfirm = useCallback((src: string, alt: string) => {
    if (!editor) return
    const pos = imageInsertPosRef.current
    editor.chain().focus().setTextSelection(pos).insertContent([
      { type: 'image', attrs: { src, alt: alt || null } },
      { type: 'paragraph' },
    ]).run()
    setImageInsertOpen(false)
  }, [editor])

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
      case 'align_left':
        editor.chain().focus().setTextSelection(selectionPos).setTextAlign('left').run()
        return
      case 'align_center':
        editor.chain().focus().setTextSelection(selectionPos).setTextAlign('center').run()
        return
      case 'align_right':
        editor.chain().focus().setTextSelection(selectionPos).setTextAlign('right').run()
        return
      case 'textColor_clear':
        editor.chain().focus().setTextSelection(selectionPos).unsetColor().run()
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
      case 'columns3':
      case 'columns4':
      case 'columns5': {
        // Prevent nesting columns inside columns
        const $pos = editor.state.doc.resolve(selectionPos)
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === 'column') return
        }
        const count = parseInt(action.replace('columns', ''))
        const columns = Array.from({ length: count }, () => ({
          type: 'column',
          content: [{ type: 'paragraph' }],
        }))
        editor.chain().focus().insertContentAt(selectionPos, [
          { type: 'columnList', content: columns },
          { type: 'paragraph' },
        ]).run()
        return
      }
      case 'wikilink':
        editor.chain().focus().setTextSelection(selectionPos).insertContent('[[').run()
        return
      case 'weblink': {
        if (typeof window === 'undefined') return
        const url = window.prompt('URL', 'https://')
        if (!url?.trim()) return
        const u = url.trim()
        const { from, to } = editor.state.selection
        const hasSel = from !== to
        if (hasSel) {
          editor.chain().focus().extendMarkRange('link').setLink({ href: u }).run()
        } else {
          editor.chain().focus().setTextSelection(selectionPos).insertContent({
            type: 'text',
            text: u,
            marks: [{ type: 'link', attrs: { href: u, target: '_blank', rel: 'noopener noreferrer' } }],
          }).insertContent(' ').run()
        }
        return
      }
      case 'code_block':
        editor.chain().focus().setTextSelection(selectionPos).toggleCodeBlock({ language: 'plaintext' }).run()
        return
      case 'image': {
        if (typeof window === 'undefined') return
        imageInsertPosRef.current = selectionPos
        setImageInsertOpen(true)
        return
      }
      case 'link_card': {
        if (typeof window === 'undefined') return
        const cardUrl = window.prompt('URL', 'https://')
        if (!cardUrl?.trim()) return
        const cardTitle = window.prompt('Title', cardUrl.trim()) || cardUrl.trim()
        const cardDesc = window.prompt('Description (optional)', '') ?? ''
        const cardImg = window.prompt('Image URL (optional)', '') ?? ''
        editor.chain().focus().setTextSelection(selectionPos).insertContent([
          {
            type: 'linkCard',
            attrs: {
              url: cardUrl.trim(),
              title: cardTitle.trim(),
              description: cardDesc.trim(),
              image: cardImg.trim(),
            },
          },
          { type: 'paragraph' },
        ]).run()
        return
      }
      case 'subpage':
        await insertEmbedPlaceholder('page', selectionPos)
        return
      case 'database':
        await insertEmbedPlaceholder('database', selectionPos)
        return
      case 'statStrip': {
        const $posStrip = editor.state.doc.resolve(selectionPos)
        for (let d = $posStrip.depth; d > 0; d--) {
          if ($posStrip.node(d).type.name === 'column') return
        }
        editor.chain().focus().insertContentAt(selectionPos, [
          {
            type: 'statStrip',
            attrs: {
              columns: 3,
              variant: 'gray',
              kicker0: '',
              title0: '',
              kicker1: '',
              title1: '',
              kicker2: '',
              title2: '',
              kicker3: '',
              title3: '',
            },
          },
          { type: 'paragraph' },
        ]).run()
        return
      }
      case 'toggleCard':
        editor.chain().focus().insertContentAt(selectionPos, [
          {
            type: 'toggleCard',
            attrs: {
              open: true,
              accent: Math.floor(Math.random() * 5),
            },
            content: [
              { type: 'toggleCardEyebrow' },
              { type: 'toggleCardTitle', content: [{ type: 'text', text: 'Toggle card' }] },
              { type: 'toggleCardSubtitle', content: [{ type: 'text', text: 'Use the arrow to expand or collapse' }] },
              { type: 'paragraph' },
            ],
          },
          { type: 'paragraph' },
        ]).run()
        return
      case 'callout': {
        const $posCallout = editor.state.doc.resolve(selectionPos)
        for (let d = $posCallout.depth; d > 0; d--) {
          if ($posCallout.node(d).type.name === 'column') return
        }
        editor.chain().focus().insertContentAt(selectionPos, [
          { type: 'callout', attrs: { variant: 'gray' }, content: [{ type: 'paragraph' }] },
          { type: 'paragraph' },
        ]).run()
        return
      }
      case 'table': {
        const $posTable = editor.state.doc.resolve(selectionPos)
        for (let d = $posTable.depth; d > 0; d--) {
          if ($posTable.node(d).type.name === 'column') return
        }
        editor.chain().focus().setTextSelection(selectionPos).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        return
      }
      case 'table_add_row_after':
        editor.chain().focus().setTextSelection(selectionPos).addRowAfter().run()
        return
      case 'table_add_row_before':
        editor.chain().focus().setTextSelection(selectionPos).addRowBefore().run()
        return
      case 'table_add_column_after':
        editor.chain().focus().setTextSelection(selectionPos).addColumnAfter().run()
        return
      case 'table_add_column_before':
        editor.chain().focus().setTextSelection(selectionPos).addColumnBefore().run()
        return
      case 'table_delete_row':
        editor.chain().focus().setTextSelection(selectionPos).deleteRow().run()
        return
      case 'table_delete_column':
        editor.chain().focus().setTextSelection(selectionPos).deleteColumn().run()
        return
      case 'table_toggle_header_row':
        editor.chain().focus().setTextSelection(selectionPos).toggleHeaderRow().run()
        return
      case 'table_delete_table':
        editor.chain().focus().setTextSelection(selectionPos).deleteTable().run()
        return
    }

    const storyVariant = parseStoryTagAction(action)
    if (storyVariant) {
      const preset = STORY_TAG_PRESETS.find((p) => p.variant === storyVariant)
      editor.chain().focus().setTextSelection(selectionPos).insertContent([
        {
          type: 'storyTag',
          attrs: { label: preset?.label ?? 'FLAG', variant: storyVariant },
        },
        { type: 'text', text: ' ' },
      ]).run()
      return
    }

    for (const sw of LEAF_TEXT_COLOR_SWATCHES) {
      if (action === `textColor_${sw.id}`) {
        editor.chain().focus().setTextSelection(selectionPos).setColor(sw.value).run()
        return
      }
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
  }, [editor, applyAction, insertWikilink, createAndInsertWikilink, updateSlashMenu, updateWikilinkMenu])

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

  const menuOpenRef = useRef(false)
  menuOpenRef.current = menuOpen

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (menuOpenRef.current) return
    if (!editor || mode !== 'rich') {
      setBlockMenu(null)
      return
    }

    const container = containerRef.current
    if (!container) return

    const view = editor.view
    const proseMirror = view.dom

    // Walk up from target to the direct child of .ProseMirror (block root). More reliable than
    // closest('.ProseMirror > *') inside React node views (atom blocks like statStrip).
    let element: HTMLElement | null = null
    let cur: HTMLElement | null = event.target as HTMLElement
    while (cur && cur.parentElement) {
      if (cur.parentElement === proseMirror || cur.parentElement.classList.contains('ProseMirror')) {
        element = cur
        break
      }
      cur = cur.parentElement
    }

    if (!element) {
      const result = view.posAtCoords({ left: event.clientX, top: event.clientY })
      if (!result) return
      const domInfo = view.domAtPos(result.pos)
      let nodeEl = (domInfo.node.nodeType === 3 ? domInfo.node.parentElement : domInfo.node) as HTMLElement | null
      while (nodeEl && nodeEl.parentElement && !nodeEl.parentElement.classList.contains('ProseMirror')) {
        nodeEl = nodeEl.parentElement
      }
      element = nodeEl
    }

    if (!element || !element.parentElement?.classList.contains('ProseMirror')) return

    const containerRect = container.getBoundingClientRect()
    const doc = editor.state.doc
    const pmChildren = Array.from(proseMirror.children) as HTMLElement[]

    let blockEl: HTMLElement = element
    let blockRect = blockEl.getBoundingClientRect()
    let childIndex = pmChildren.indexOf(blockEl)

    if (childIndex < 0) {
      for (const n of document.elementsFromPoint(event.clientX, event.clientY)) {
        if (!(n instanceof HTMLElement)) continue
        if (n.parentElement !== proseMirror) continue
        const idx = pmChildren.indexOf(n)
        if (idx >= 0) {
          childIndex = idx
          blockEl = n
          blockRect = n.getBoundingClientRect()
          break
        }
      }
    }

    const applyMenuFromPmPos = (pmPos: number) => {
      const $resolved = editor.state.doc.resolve(pmPos)
      const depth = $resolved.depth > 0 ? 1 : 0
      const nodeStart = $resolved.before(depth)
      const endPos = $resolved.after(depth)
      const nodeType = $resolved.node(depth).type.name
      setBlockMenu({ top: blockRect.top - containerRect.top, height: blockRect.height, endPos, nodeStart, nodeType })
    }

    // Atom React node views (stat strip, embeds) often return null from posAtCoords over inner DOM.
    // Map the ProseMirror block wrapper to doc.child(index) — DOM order matches document order here.
    if (childIndex >= 0 && childIndex < doc.childCount) {
      // Doc content positions are 0 .. doc.content.size; child i starts at sum of prior nodeSizes (not 1).
      let nodeStart = 0
      for (let i = 0; i < childIndex; i++) nodeStart += doc.child(i).nodeSize
      const node = doc.child(childIndex)
      const endPos = nodeStart + node.nodeSize
      setBlockMenu({
        top: blockRect.top - containerRect.top,
        height: blockRect.height,
        endPos,
        nodeStart,
        nodeType: node.type.name,
      })
      return
    }

    const innerX = Math.min(blockRect.left + 4, blockRect.right - 1)
    const innerY = blockRect.top + Math.min(Math.max(blockRect.height / 2, 1), blockRect.height - 1)

    const coordsHit = view.posAtCoords({ left: innerX, top: innerY })
    if (coordsHit) {
      try {
        applyMenuFromPmPos(coordsHit.pos)
        return
      } catch {
        /* fall through */
      }
    }

    const centerHit = view.posAtCoords({
      left: blockRect.left + blockRect.width / 2,
      top: blockRect.top + blockRect.height / 2,
    })
    if (centerHit) {
      try {
        applyMenuFromPmPos(centerHit.pos)
        return
      } catch {
        /* fall through */
      }
    }

    try {
      const pmPos = view.posAtDOM(element, 0)
      applyMenuFromPmPos(pmPos)
    } catch {
      setBlockMenu(null)
    }
  }, [editor, mode])

  useEffect(() => {
    if (!editor || mode !== 'rich') return
    const syncBlockMenuFromNodeSelection = () => {
      if (menuOpenRef.current) return
      const sel = editor.state.selection
      if (!(sel instanceof NodeSelection)) return
      const { node, from, to } = sel
      if (!node.type.isBlock) return
      const container = containerRef.current
      if (!container) return
      try {
        const view = editor.view
        const c1 = view.coordsAtPos(from)
        const c2 = view.coordsAtPos(Math.max(from, to - 1))
        const topClient = Math.min(c1.top, c2.top)
        const bottomClient = Math.max(c1.bottom, c2.bottom)
        const containerRect = container.getBoundingClientRect()
        setBlockMenu({
          top: topClient - containerRect.top,
          height: Math.max(bottomClient - topClient, 28),
          nodeStart: from,
          endPos: to,
          nodeType: node.type.name,
        })
      } catch {
        /* ignore */
      }
    }
    syncBlockMenuFromNodeSelection()
    editor.on('selectionUpdate', syncBlockMenuFromNodeSelection)
    return () => {
      editor.off('selectionUpdate', syncBlockMenuFromNodeSelection)
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
    // Only handle when a block drag is in progress (our ref or ProseMirror's tracker)
    if (!dragSourceRef.current && !editor.view.dragging) return

    const container = containerRef.current
    const proseMirror = container.querySelector('.ProseMirror')
    if (!proseMirror) return

    const EDGE_ZONE = 60 // px from left/right edge of block to trigger column drop

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

      // Don't allow dropping on columnList or embed nodes
      const targetNode = editor.state.doc.nodeAt(nodeStart)
      if (targetNode && (
        targetNode.type.name === 'columnList' ||
        targetNode.type.name === 'toggleCard' ||
        targetNode.type.name === 'callout' ||
        targetNode.type.name === 'statStrip' ||
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
      <ImageInsertDialog
        open={imageInsertOpen}
        onClose={() => setImageInsertOpen(false)}
        onInsert={handleImageInsertConfirm}
      />

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
          >
            {editor ? (
              <BubbleMenu
                editor={editor}
                pluginKey="leafSelectionBubble"
                tippyOptions={{
                  duration: 150,
                  placement: 'top',
                  zIndex: 10050,
                  appendTo: () => document.body,
                  popperOptions: { strategy: 'fixed' },
                }}
                shouldShow={selectionBubbleShouldShow}
              >
                <EditorSelectionBubble editor={editor} />
              </BubbleMenu>
            ) : null}
            {editor ? <CodeBlockLangBubble editor={editor} /> : null}
            {columnDropZone && (
              <div
                className="column-drop-indicator"
                style={{
                  position: 'absolute',
                  top: columnDropZone.top,
                  left: columnDropZone.left - 1,
                  width: 4,
                  height: columnDropZone.height,
                  background: 'var(--leaf-green)',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  zIndex: 20,
                  transition: 'top 0.12s ease, left 0.12s ease, height 0.12s ease',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
                }}
              />
            )}
            {blockMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: blockMenu.top - 2,
                  left: -56,
                  height: Math.max(blockMenu.height, 28),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: blockMenu.height > 60 ? 'flex-start' : 'flex-start',
                  paddingTop: blockMenu.height > 60 ? 4 : 0,
                }}
                onMouseEnter={() => {
                  if (hideTimer.current) {
                    clearTimeout(hideTimer.current)
                    hideTimer.current = null
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                    title="Drag to move · Click for options"
                    draggable
                    onClick={(e) => {
                      e.preventDefault()
                      pendingInsertPos.current = blockMenu.endPos
                      setMenuOpen((current) => !current)
                    }}
                    onDragStart={(event) => {
                      if (!editor) return
                      try {
                        const $pos = editor.state.doc.resolve(Math.max(0, blockMenu.endPos - 1))
                        const depth = $pos.depth > 0 ? 1 : 0
                        const nodeStart = $pos.before(depth)
                        const nodeEnd = $pos.after(depth)

                        // Select the block so ProseMirror knows what to delete on move-drop
                        editor.view.dispatch(
                          editor.state.tr.setSelection(TextSelection.create(editor.state.doc, nodeStart, nodeEnd)),
                        )

                        const slice = editor.state.doc.slice(nodeStart, nodeEnd)
                        const serializer = DOMSerializer.fromSchema(editor.state.schema)
                        const fragment = serializer.serializeFragment(slice.content)

                        // Create a compact drag ghost
                        const ghost = document.createElement('div')
                        ghost.style.cssText =
                          'position:fixed;top:-9999px;left:-9999px;max-width:300px;max-height:60px;overflow:hidden;padding:6px 12px;background:var(--leaf-bg-elevated);border:1px solid var(--leaf-border-strong);border-radius:8px;box-shadow:var(--leaf-shadow-soft);font-size:13px;color:var(--leaf-text-body);'
                        ghost.textContent = fragment.textContent?.slice(0, 80) || 'Block'
                        document.body.appendChild(ghost)
                        event.dataTransfer.setDragImage(ghost, 16, 16)
                        requestAnimationFrame(() => ghost.remove())

                        event.dataTransfer.clearData()
                        event.dataTransfer.setData('text/html', (() => {
                          const wrapper = document.createElement('div')
                          wrapper.appendChild(fragment)
                          return wrapper.innerHTML
                        })())
                        event.dataTransfer.setData('text/plain', fragment.textContent || '')
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
                </div>
                {menuOpen && <BlockDropdown blockMenu={blockMenu} editor={editor} onSelect={handleBlockAction} onClose={() => { setMenuOpen(false); setBlockMenu(null) }} />}
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
