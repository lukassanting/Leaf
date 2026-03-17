'use client'

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TurndownService from 'turndown'
import MarkdownIt from 'markdown-it'
import { EditorToolbar } from './EditorToolbar'
import { buildSlashExtension, SlashMenuState } from './SlashCommands'

// ─── Page/Database card TipTap node ──────────────────────────────────────────

function PageCardView({ node, deleteNode }: { node: { attrs: { id: string; title: string; kind: string } }; deleteNode: () => void }) {
  const { id, title, kind } = node.attrs
  const href = kind === 'database' ? `/databases/${id}` : `/editor/${id}`
  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-leaf-200 bg-white hover:bg-leaf-50 transition my-1.5 group select-none"
      >
        <span className="text-leaf-400 text-sm shrink-0">{kind === 'database' ? '⊞' : '📄'}</span>
        <span
          className="flex-1 text-sm font-medium text-leaf-800 cursor-pointer"
          onClick={() => { window.location.href = href }}
        >
          {title || 'Untitled'}
        </span>
        <span
          className="text-xs text-leaf-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={() => { window.location.href = href }}
        >
          ↗
        </span>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation(); deleteNode() }}
          className="opacity-0 group-hover:opacity-100 text-leaf-300 hover:text-red-500 text-xs transition-opacity ml-1 leading-none"
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
  parseHTML() {
    return [{ tag: 'div[data-type="page-card"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'page-card' }, HTMLAttributes)]
  },
  addNodeView() {
    return ReactNodeViewRenderer(PageCardView as Parameters<typeof ReactNodeViewRenderer>[0])
  },
})

// ─── Block menu ───────────────────────────────────────────────────────────────

type BlockMenuState = { top: number; endPos: number } | null

type BlockMenuDropdownProps = {
  top: number
  onSelect: (action: string) => void
  onClose: () => void
}

function BlockMenuDropdown({ top, onSelect, onClose }: BlockMenuDropdownProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        className="absolute z-50 left-0 bg-white border border-leaf-200 rounded-lg shadow-lg py-1 w-44"
        style={{ top: top + 4 }}
      >
        {[
          { label: 'Heading 1', action: 'h1' },
          { label: 'Heading 2', action: 'h2' },
          { label: 'Heading 3', action: 'h3' },
          null,
          { label: 'Bold', action: 'bold' },
          { label: 'Italic', action: 'italic' },
          { label: 'Strikethrough', action: 'strike' },
          { label: 'Code', action: 'code' },
          null,
          { label: 'Bullet list', action: 'bullet' },
          { label: 'Numbered list', action: 'ordered' },
          { label: 'To-Do list', action: 'todo' },
          { label: 'Quote', action: 'quote' },
          null,
          { label: '🍃 Sub-page', action: 'subpage' },
          { label: '🌳 Database', action: 'database' },
        ].map((item, i) =>
          item === null ? (
            <div key={i} className="border-t border-leaf-100 my-1" />
          ) : (
            <button
              key={item.action}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm text-leaf-700 hover:bg-leaf-50"
              onMouseDown={(e) => { e.preventDefault(); onSelect(item.action) }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  )
}

// ─── Placeholder (optional) ───────────────────────────────────────────────────

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
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export default function Editor({ content, onUpdate, onCreateSubPage, onCreateDatabase }: Props) {
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich')
  const [markdown, setMarkdown] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [blockMenu, setBlockMenu] = useState<BlockMenuState>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const pendingInsertPos = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>(null)

  // Stable ref so the slash-action window event handler always sees fresh callbacks
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
      attributes: { class: 'prose prose-leaf max-w-none min-h-[50vh] focus:outline-none' },
    },
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  // Listen for slash-action events dispatched by SlashCommands.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent<string>).detail
      slashHandlerRef.current(action)
    }
    window.addEventListener('slash-action', handler)
    return () => window.removeEventListener('slash-action', handler)
  }, [])

  // Keep slash handler ref up to date
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

  // ─── Block menu positioning ───────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || mode !== 'rich') { setBlockMenu(null); return }
    const container = containerRef.current
    if (!container) return

    const result = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
    // No text under cursor (e.g. in padding gap) — keep existing menu visible
    if (!result) return

    const domInfo = editor.view.domAtPos(result.pos)
    let el = (domInfo.node.nodeType === 3 ? domInfo.node.parentElement : domInfo.node) as HTMLElement | null

    // Walk up to find a direct child of .ProseMirror
    while (el && el.parentElement && !el.parentElement.classList.contains('ProseMirror')) {
      el = el.parentElement
    }
    // Not over a block — keep existing menu visible rather than hiding
    if (!el || !el.parentElement?.classList.contains('ProseMirror')) return

    const containerRect = container.getBoundingClientRect()
    const blockRect = el.getBoundingClientRect()

    // Get end position of this block in the doc
    try {
      const $pos = editor.state.doc.resolve(result.pos)
      const depth = $pos.depth > 0 ? 1 : 0
      const endPos = $pos.after(depth)
      setBlockMenu({
        top: blockRect.top - containerRect.top,
        endPos,
      })
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
      editor.chain().focus().insertContentAt(pos, {
        type: 'pageCard',
        attrs: { id, title, kind },
      }).run()
    }

    switch (action) {
      case 'h1':
        editor.chain().focus().setTextSelection(pos - 1).setHeading({ level: 1 }).run()
        break
      case 'h2':
        editor.chain().focus().setTextSelection(pos - 1).setHeading({ level: 2 }).run()
        break
      case 'h3':
        editor.chain().focus().setTextSelection(pos - 1).setHeading({ level: 3 }).run()
        break
      case 'bold':
        editor.chain().focus().setTextSelection({ from: pos - 1, to: pos - 1 }).toggleBold().run()
        break
      case 'italic':
        editor.chain().focus().setTextSelection({ from: pos - 1, to: pos - 1 }).toggleItalic().run()
        break
      case 'strike':
        editor.chain().focus().setTextSelection({ from: pos - 1, to: pos - 1 }).toggleStrike().run()
        break
      case 'code':
        editor.chain().focus().setTextSelection({ from: pos - 1, to: pos - 1 }).toggleCode().run()
        break
      case 'bullet':
        editor.chain().focus().setTextSelection(pos - 1).toggleBulletList().run()
        break
      case 'ordered':
        editor.chain().focus().setTextSelection(pos - 1).toggleOrderedList().run()
        break
      case 'todo':
        editor.chain().focus().setTextSelection(pos - 1).toggleTaskList().run()
        break
      case 'quote':
        editor.chain().focus().setTextSelection(pos - 1).toggleBlockquote().run()
        break
      case 'subpage':
        onCreateSubPage?.((id, title) => insertCard(id, title, 'page'))
        break
      case 'database':
        onCreateDatabase?.((id, title) => insertCard(id, title, 'database'))
        break
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
  }, [mode, markdown, editor, onUpdate])

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

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-leaf-100 pb-2 gap-4">
        <div className="flex-1 min-w-0">
          {mode === 'rich' && editor && <EditorToolbar editor={editor} />}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input ref={fileInputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={onFileChange} />
          <button type="button" onClick={handleImport} className="text-xs text-leaf-400 hover:text-leaf-600 transition">Import</button>
          <button type="button" onClick={handleExport} className="text-xs text-leaf-400 hover:text-leaf-600 transition">Export</button>
          <div className="inline-flex items-center rounded-md border border-leaf-100 bg-leaf-50 p-0.5 text-xs">
            {(['rich', 'markdown'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={[
                  'px-2.5 py-1 rounded capitalize transition',
                  mode === m ? 'bg-white text-leaf-800 shadow-sm font-medium' : 'text-leaf-500 hover:text-leaf-700',
                ].join(' ')}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
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
            {/* Block menu button */}
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
                  className="w-6 h-6 flex items-center justify-center rounded text-leaf-300 hover:text-leaf-600 hover:bg-leaf-100 text-base leading-none transition"
                  title="Insert block"
                >
                  +
                </button>
                {menuOpen && (
                  <BlockMenuDropdown
                    top={0}
                    onSelect={handleBlockAction}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
              </div>
            )}
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : null}

      {/* Slash-command menu — rendered as a fixed div, no tippy */}
      {slashMenu && slashMenu.items.length > 0 && (
        <div
          className="fixed z-50 bg-white border border-leaf-200 rounded-lg shadow-lg py-1 w-52 overflow-hidden"
          style={{ top: slashMenu.rect.bottom + 4, left: slashMenu.rect.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {slashMenu.items.map((item, i) => (
            <button
              key={item.action}
              type="button"
              onMouseDown={() => slashMenu.select(item)}
              className={[
                'w-full text-left px-3 py-1.5 text-sm transition',
                i === slashMenu.selectedIndex
                  ? 'bg-leaf-50 text-leaf-900'
                  : 'text-leaf-700 hover:bg-leaf-50',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {mode !== 'rich' && (
        <textarea
          className="w-full min-h-[50vh] bg-transparent font-mono text-sm leading-relaxed text-leaf-800 resize-none focus:outline-none"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="Write markdown here…"
        />
      )}
    </div>
  )
}
