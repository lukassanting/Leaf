'use client'

import { BubbleMenu } from '@tiptap/react'
import type { Editor } from '@tiptap/react'

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'python', label: 'Python' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'csharp', label: 'C#' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'xml', label: 'XML' },
]

type Props = { editor: Editor }

export function CodeBlockLangBubble({ editor }: Props) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="codeBlockLangBubble"
      shouldShow={({ editor: ed }) => ed.isActive('codeBlock')}
      tippyOptions={{ duration: 100, placement: 'top' }}
    >
      <div
        className="flex items-center gap-1.5 rounded-lg border px-2 py-1 shadow-md"
        style={{
          background: 'var(--leaf-bg-elevated)',
          borderColor: 'var(--leaf-border-strong)',
        }}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>
          Language
        </span>
        <select
          className="max-w-[140px] rounded border bg-transparent py-0.5 pl-1 pr-6 text-[11px] focus:outline-none"
          style={{ borderColor: 'var(--leaf-border-soft)', color: 'var(--leaf-text-body)' }}
          value={(editor.getAttributes('codeBlock').language as string) || 'plaintext'}
          onChange={(e) => {
            editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run()
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
    </BubbleMenu>
  )
}
