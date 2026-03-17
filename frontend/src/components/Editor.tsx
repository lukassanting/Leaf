'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback, useEffect, useRef, useState } from 'react'
import TurndownService from 'turndown'
import MarkdownIt from 'markdown-it'
import { EditorToolbar } from './EditorToolbar'

// Placeholder is optional — only loaded when available
let Placeholder: ReturnType<typeof import('@tiptap/extension-placeholder')['default']> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Placeholder = require('@tiptap/extension-placeholder').default
} catch {}

type Props = {
  content: string
  onUpdate: (html: string) => void
}

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

export default function Editor({ content, onUpdate }: Props) {
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich')
  const [markdown, setMarkdown] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const extensions = [
    StarterKit,
    ...(Placeholder
      ? [Placeholder.configure({ placeholder: 'Write something…' })]
      : []),
  ]

  const editor = useEditor({
    extensions,
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-leaf max-w-none min-h-[50vh] focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  const handleModeChange = useCallback(
    (next: 'rich' | 'markdown') => {
      if (next === mode) return
      if (next === 'markdown' && editor) setMarkdown(htmlToMarkdown(editor.getHTML()))
      if (next === 'rich' && editor) {
        const html = markdownToHtml(markdown)
        editor.commands.setContent(html || '<p></p>')
        onUpdate(editor.getHTML())
      }
      setMode(next)
    },
    [mode, markdown, editor, onUpdate]
  )

  const handleExport = useCallback(() => {
    const text = mode === 'rich' && editor ? htmlToMarkdown(editor.getHTML()) : markdown
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'leaf-export.md' }).click()
    URL.revokeObjectURL(url)
  }, [mode, editor, markdown])

  const handleImport = useCallback(() => fileInputRef.current?.click(), [])

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [mode, editor, onUpdate]
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-leaf-100 pb-2 gap-4">
        {/* Formatting buttons — only in rich mode */}
        <div className="flex-1 min-w-0">
          {mode === 'rich' && editor && <EditorToolbar editor={editor} />}
        </div>

        {/* Right: mode toggle + import/export */}
        <div className="flex items-center gap-3 shrink-0">
          <input ref={fileInputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={onFileChange} />
          <button type="button" onClick={handleImport} className="text-xs text-leaf-400 hover:text-leaf-600 transition">
            Import
          </button>
          <button type="button" onClick={handleExport} className="text-xs text-leaf-400 hover:text-leaf-600 transition">
            Export
          </button>
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
        <EditorContent editor={editor} />
      ) : (
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
