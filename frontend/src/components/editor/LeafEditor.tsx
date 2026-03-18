'use client'

import { useRouter } from 'next/navigation'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'
import type { Database, LeafDocument } from '@/lib/api'
import { DatabaseIcon, LeafIcon } from '@/components/Icons'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { warmDatabaseRoute, warmEditorRoute } from '@/lib/warmEditorRoute'
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
  onUpdate: (document: LeafDocument) => void
  onCreateSubPage?: () => Promise<EmbedCreateResult>
  onCreateDatabase?: () => Promise<EmbedCreateResult>
  onStatusChange?: (mode: 'rich' | 'markdown', wordCount: number) => void
  mode: 'rich' | 'markdown'
  onModeChange: (mode: 'rich' | 'markdown') => void
  actionsRef?: React.MutableRefObject<EditorActions | null>
}

type SlashMatch = {
  range: { from: number; to: number }
  query: string
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

function LeafEmbedView({
  node,
  deleteNode,
}: {
  node: { type: { name: 'pageEmbed' | 'databaseEmbed' }; attrs: EmbedNodeAttrs }
  deleteNode: () => void
}) {
  const router = useRouter()
  const { startNavigation } = useNavigationProgress()
  const { id, title, status, view } = node.attrs
  const isDatabase = node.type.name === 'databaseEmbed'
  const href = isDatabase ? `/databases/${id}` : `/editor/${id}`
  const label = isDatabase ? 'Database' : 'Page'
  const canNavigate = status === 'ready' && Boolean(id)

  return (
    <NodeViewWrapper className="my-1.5">
      <div
        contentEditable={false}
        className="group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-150"
        style={{
          borderColor: status === 'error' ? '#f2c4bc' : 'var(--leaf-border-strong)',
          background: status === 'pending' ? 'var(--leaf-bg-tag)' : 'var(--leaf-bg-editor)',
          cursor: canNavigate ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (!canNavigate) return
          startNavigation()
          if (isDatabase) {
            void warmDatabaseRoute()
          } else {
            void warmEditorRoute()
          }
          router.push(href)
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--leaf-bg-tag)', color: 'var(--leaf-text-title)' }}
        >
          {isDatabase ? <DatabaseIcon size={16} /> : <LeafIcon size={16} />}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
            {title || (isDatabase ? 'Untitled database' : 'Untitled')}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
            {status === 'pending'
              ? `Creating ${label.toLowerCase()}…`
              : status === 'error'
                ? `Could not create ${label.toLowerCase()}`
                : isDatabase && view
                  ? `${label} · ${view} view`
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
      return ReactNodeViewRenderer(LeafEmbedView as never)
    },
  })
}

const PageEmbed = createEmbedNode('pageEmbed', 'page')
const DatabaseEmbed = createEmbedNode('databaseEmbed', 'database')

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

export default function LeafEditor({
  content,
  onUpdate,
  onCreateSubPage,
  onCreateDatabase,
  onStatusChange,
  mode,
  onModeChange,
  actionsRef,
}: Props) {
  const [markdownValue, setMarkdownValue] = useState('')
  const [blockMenu, setBlockMenu] = useState<BlockMenuState>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
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
  const initialContentRef = useRef(normalizeLeafDocument(content))
  const lastSyncedRef = useRef(JSON.stringify(normalizeLeafDocument(content)))
  const slashMatchRef = useRef<SlashMatch | null>(null)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const slashSelectActionRef = useRef<(action: string) => void>(() => {})

  modeRef.current = mode
  onUpdateRef.current = onUpdate
  onStatusChangeRef.current = onStatusChange
  onCreateSubPageRef.current = onCreateSubPage
  onCreateDatabaseRef.current = onCreateDatabase
  onModeChangeRef.current = onModeChange
  slashMenuRef.current = slashMenu

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

  const extensions = useMemo(() => [
    StarterKit.configure({
      gapcursor: false,
      dropcursor: false,
    }),
    PageEmbed,
    DatabaseEmbed,
    TaskList,
    TaskItem.configure({ nested: true }),
  ], [])

  const handleEditorUpdate = useCallback(({ editor }: { editor: import('@tiptap/core').Editor }) => {
    const document = normalizeLeafDocument(editor.getJSON() as LeafDocument)
    lastSyncedRef.current = JSON.stringify(document)
    onUpdateRef.current(document)
    const words = getLeafContentText(document).trim().split(/\s+/).filter(Boolean).length
    onStatusChangeRef.current?.(modeRef.current, words)
  }, [])

  const editorProps = useMemo(() => ({
    attributes: { class: 'leaf-prose max-w-none min-h-[50vh] focus:outline-none' },
    handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
      const activeSlashMenu = slashMenuRef.current

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

  const updateEmbedNode = useCallback((tempId: string, attrs: Partial<EmbedNodeAttrs>) => {
    if (!editor) return

    let targetPos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if ((node.type.name === 'pageEmbed' || node.type.name === 'databaseEmbed') && node.attrs.tempId === tempId) {
        targetPos = pos
        return false
      }
      return true
    })

    if (targetPos === null) return

    const node = editor.state.doc.nodeAt(targetPos)
    if (!node) return

    editor.view.dispatch(editor.state.tr.setNodeMarkup(targetPos, undefined, {
      ...node.attrs,
      ...attrs,
    }))
  }, [editor])

  const insertEmbedPlaceholder = useCallback(async (
    kind: 'page' | 'database',
    insertPos: number,
  ) => {
    if (!editor) return

    const tempId = createTempId()
    const type = kind === 'database' ? 'databaseEmbed' : 'pageEmbed'
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

      updateEmbedNode(tempId, {
        id: created.id,
        title: created.title,
        tempId: null,
        status: 'ready',
        ...(kind === 'database' ? { view: created.view ?? 'table' } : {}),
      })
    } catch {
      updateEmbedNode(tempId, {
        title: `Failed to create ${kind}`,
        status: 'error',
      })
    }
  }, [editor, updateEmbedNode])

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
    const handleBlur = () => setTimeout(syncSlashMenu, 0)
    slashSelectActionRef.current = async (action: string) => {
      const match = slashMatchRef.current
      setSlashMenu(null)
      slashMatchRef.current = null
      if (!match) return
      await applyAction(action, { selectionPos: match.range.from, deleteRange: match.range })
    }

    editor.on('selectionUpdate', syncSlashMenu)
    editor.on('update', syncSlashMenu)
    editor.on('focus', syncSlashMenu)
    editor.on('blur', handleBlur)

    syncSlashMenu()

    return () => {
      editor.off('selectionUpdate', syncSlashMenu)
      editor.off('update', syncSlashMenu)
      editor.off('focus', syncSlashMenu)
      editor.off('blur', handleBlur)
    }
  }, [editor, applyAction, updateSlashMenu])

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
          style={{ paddingLeft: 36 }}
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
          <div ref={containerRef} className="relative">
            {blockMenu && (
              <div
                style={{ position: 'absolute', top: blockMenu.top, left: -32 }}
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
                  className="flex h-6 w-6 items-center justify-center rounded text-base leading-none transition-colors duration-150"
                  style={{ color: 'var(--leaf-text-muted)' }}
                  title="Insert block"
                >
                  +
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
    </div>
  )
}
