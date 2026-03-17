'use client'

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TurndownService from 'turndown'
import MarkdownIt from 'markdown-it'
import { buildSlashExtension, SlashMenuState, SlashMenuPanel, SLASH_ITEMS } from './SlashCommands'
import { LeafIcon, DatabaseIcon } from './Icons'

// ─── Page/Database card node ──────────────────────────────────────────────────

function PageCardView({ node, deleteNode }: { node: { attrs: { id: string; title: string; kind: string } }; deleteNode: () => void }) {
  const { id, title, kind } = node.attrs
  const href = kind === 'database' ? `/databases/${id}` : `/editor/${id}`
  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg my-1.5 group select-none cursor-pointer transition-colors duration-150"
        style={{ border: '1px solid var(--color-border)', background: '#fff' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
        onClick={() => { window.location.href = href }}
      >
        <span className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {kind === 'database' ? <DatabaseIcon size={14} /> : <LeafIcon size={14} />}
        </span>
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text-dark)' }}>
          {title || 'Untitled'}
        </span>
        <span
          className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ↗
        </span>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation(); deleteNode() }}
          className="opacity-0 group-hover:opacity-100 text-xs transition-opacity ml-1 leading-none"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        >
          ✕
        </button>
      </div>
    </NodeViewWrapper>
  )
}

const PageCard = Node.create({
  name: 'pageCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      id: { default: null },
      title: { default: 'Untitled' },
      kind: { default: 'page' },
    }
  },
  parseHTML() { return [{ tag: 'div[data-type="page-card"]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'page-card' }, HTMLAttributes)]
  },
  addNodeView() {
    return ReactNodeViewRenderer(PageCardView as Parameters<typeof ReactNodeViewRenderer>[0])
  },
})

// ─── Block + dropdown (same items as slash menu, no groups) ──────────────────

type BlockMenuState = { top: number; endPos: number } | null

function BlockDropdown({ onSelect, onClose }: { onSelect: (action: string) => void; onClose: () => void }) {
  const groups = ['Text', 'Structure', 'Insert'] as const
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        className="absolute z-50 rounded-lg overflow-hidden"
        style={{
          top: 28,
          left: 0,
          width: 240,
          background: '#fff',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
        }}
      >
        {groups.map((group) => {
          const items = SLASH_ITEMS.filter((i) => i.group === group)
          return (
            <div key={group}>
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-medium tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                {group}
              </div>
              {items.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-100"
                  style={{ color: 'var(--color-text-dark)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  onMouseDown={(e) => { e.preventDefault(); onSelect(item.action) }}
                >
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)', width: 24 }}>{item.label.slice(0, 2)}</span>
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

// ─── Converters ───────────────────────────────────────────────────────────────

let Placeholder: ReturnType<typeof import('@tiptap/extension-placeholder')['default']> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Placeholder = require('@tiptap/extension-placeholder').default
} catch {}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
const md = new MarkdownIt({ html: true })

function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return ''
  return turndown.turndown(html)
}
function markdownToHtml(mdText: string): string {
  if (!mdText.trim()) return '<p></p>'
  return md.render(mdText)
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  content: string
  onUpdate: (html: string) => void
  onCreateSubPage?: (insertCard: (id: string, title: string) => void) => void
  onCreateDatabase?: (insertCard: (id: string, title: string) => void) => void
  /** Called when mode or word count changes — for the status bar */
  onStatusChange?: (mode: 'rich' | 'markdown', wordCount: number) => void
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export default function Editor({ content, onUpdate, onCreateSubPage, onCreateDatabase, onStatusChange }: Props) {
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich')
  const [markdown, setMarkdown] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [blockMenu, setBlockMenu] = useState<BlockMenuState>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const pendingInsertPos = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>(null)
  const slashHandlerRef = useRef<(action: string) => void>(() => {})

  const extensions = useMemo(() => [
    StarterKit,
    PageCard,
    TaskList,
    TaskItem.configure({ nested: true }),
    buildSlashExtension(setSlashMenu),
    ...(Placeholder ? [Placeholder.configure({ placeholder: 'Write something… or type / for commands' })] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const editor = useEditor({
    extensions,
    content,
    editorProps: {
      attributes: { class: 'leaf-prose max-w-none min-h-[50vh] focus:outline-none' },
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
      // Word count
      const text = editor.state.doc.textContent
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      onStatusChange?.(mode, words)
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  // Slash-action bridge
  useEffect(() => {
    const handler = (e: Event) => slashHandlerRef.current((e as CustomEvent<string>).detail)
    window.addEventListener('slash-action', handler)
    return () => window.removeEventListener('slash-action', handler)
  }, [])

  useEffect(() => {
    slashHandlerRef.current = (action: string) => {
      if (!editor) return
      const pos = editor.state.selection.from
      const insertCard = (id: string, title: string, kind: 'page' | 'database') => {
        editor.chain().focus().insertContentAt(pos, { type: 'pageCard', attrs: { id, title, kind } }).run()
      }
      switch (action) {
        case 'h1': editor.chain().focus().setHeading({ level: 1 }).run(); break
        case 'h2': editor.chain().focus().setHeading({ level: 2 }).run(); break
        case 'h3': editor.chain().focus().setHeading({ level: 3 }).run(); break
        case 'bold': editor.chain().focus().toggleBold().run(); break
        case 'italic': editor.chain().focus().toggleItalic().run(); break
        case 'strike': editor.chain().focus().toggleStrike().run(); break
        case 'code': editor.chain().focus().toggleCode().run(); break
        case 'bullet': editor.chain().focus().toggleBulletList().run(); break
        case 'ordered': editor.chain().focus().toggleOrderedList().run(); break
        case 'todo': editor.chain().focus().toggleTaskList().run(); break
        case 'quote': editor.chain().focus().toggleBlockquote().run(); break
        case 'subpage': onCreateSubPage?.((id, title) => insertCard(id, title, 'page')); break
        case 'database': onCreateDatabase?.((id, title) => insertCard(id, title, 'database')); break
      }
    }
  }, [editor, onCreateSubPage, onCreateDatabase])

  // ─── Block + menu positioning ─────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || mode !== 'rich') { setBlockMenu(null); return }
    const container = containerRef.current
    if (!container) return

    const result = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (!result) return // keep existing menu visible when in padding gap

    const domInfo = editor.view.domAtPos(result.pos)
    let el = (domInfo.node.nodeType === 3 ? domInfo.node.parentElement : domInfo.node) as HTMLElement | null

    while (el && el.parentElement && !el.parentElement.classList.contains('ProseMirror')) {
      el = el.parentElement
    }
    if (!el || !el.parentElement?.classList.contains('ProseMirror')) return

    const containerRect = container.getBoundingClientRect()
    const blockRect = el.getBoundingClientRect()

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
    if (!editor) return
    const pos = pendingInsertPos.current ?? editor.state.doc.content.size
    const insertCard = (id: string, title: string, kind: 'page' | 'database') => {
      editor.chain().focus().insertContentAt(pos, { type: 'pageCard', attrs: { id, title, kind } }).run()
    }
    switch (action) {
      case 'h1': editor.chain().focus().setTextSelection(pos - 1).setHeading({ level: 1 }).run(); break
      case 'h2': editor.chain().focus().setTextSelection(pos - 1).setHeading({ level: 2 }).run(); break
      case 'h3': editor.chain().focus().setTextSelection(pos - 1).setHeading({ level: 3 }).run(); break
      case 'bold': editor.chain().focus().toggleBold().run(); break
      case 'italic': editor.chain().focus().toggleItalic().run(); break
      case 'strike': editor.chain().focus().toggleStrike().run(); break
      case 'code': editor.chain().focus().toggleCode().run(); break
      case 'bullet': editor.chain().focus().setTextSelection(pos - 1).toggleBulletList().run(); break
      case 'ordered': editor.chain().focus().setTextSelection(pos - 1).toggleOrderedList().run(); break
      case 'todo': editor.chain().focus().setTextSelection(pos - 1).toggleTaskList().run(); break
      case 'quote': editor.chain().focus().setTextSelection(pos - 1).toggleBlockquote().run(); break
      case 'subpage': onCreateSubPage?.((id, title) => insertCard(id, title, 'page')); break
      case 'database': onCreateDatabase?.((id, title) => insertCard(id, title, 'database')); break
    }
  }, [editor, onCreateSubPage, onCreateDatabase])

  // ─── Mode toggle ──────────────────────────────────────────────────────────

  const handleModeChange = useCallback((next: 'rich' | 'markdown') => {
    if (next === mode) return
    if (next === 'markdown' && editor) setMarkdown(htmlToMarkdown(editor.getHTML()))
    if (next === 'rich' && editor) {
      const html = markdownToHtml(markdown)
      editor.commands.setContent(html || '<p></p>')
      onUpdate(editor.getHTML())
    }
    setMode(next)
    const text = editor?.state.doc.textContent ?? markdown
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    onStatusChange?.(next, words)
  }, [mode, markdown, editor, onUpdate, onStatusChange])

  const handleExport = useCallback(() => {
    const text = mode === 'rich' && editor ? htmlToMarkdown(editor.getHTML()) : markdown
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'leaf-export.md' }).click()
    URL.revokeObjectURL(url)
  }, [mode, editor, markdown])

  const handleImport = useCallback(() => fileInputRef.current?.click(), [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      if (mode === 'markdown') {
        setMarkdown(text)
      } else if (editor) {
        editor.commands.setContent(markdownToHtml(text) || '<p></p>')
        onUpdate(editor.getHTML())
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [mode, editor, onUpdate])

  // Expose mode toggle for parent (status bar)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Editor as any)._modeRef = { mode, setMode: handleModeChange }

  return (
    <div className="flex flex-col">
      <input ref={fileInputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={onFileChange} />

      {/* Rich editor */}
      {mode === 'rich' ? (
        <div
          className="relative"
          style={{ paddingLeft: 36 }}
          onMouseMove={(e) => {
            if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
            handleMouseMove(e)
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
                onMouseEnter={() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null } }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pendingInsertPos.current = blockMenu.endPos
                    setMenuOpen((v) => !v)
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded transition-colors duration-150 text-base leading-none"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-primary)'
                    e.currentTarget.style.backgroundColor = 'var(--color-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-muted)'
                    e.currentTarget.style.backgroundColor = ''
                  }}
                  title="Insert block"
                >
                  +
                </button>
                {menuOpen && (
                  <BlockDropdown
                    onSelect={handleBlockAction}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
              </div>
            )}
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : (
        <textarea
          className="w-full min-h-[50vh] bg-transparent font-mono text-sm leading-relaxed resize-none focus:outline-none"
          style={{ color: 'var(--color-text-body)' }}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="Write markdown here…"
        />
      )}

      {/* Slash menu */}
      {slashMenu && (
        <SlashMenuPanel menu={slashMenu} globalIdx={slashMenu.selectedIndex} />
      )}

      {/* Export / Import hidden actions — exposed via handleExport/handleImport refs */}
      <div style={{ display: 'none' }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {((Editor as any)._exportRef = handleExport) && null}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {((Editor as any)._importRef = handleImport) && null}
      </div>
    </div>
  )
}
