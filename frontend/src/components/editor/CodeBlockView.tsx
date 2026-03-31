'use client'

/**
 * Custom NodeView for code blocks — renders an inline language selector
 * in the header bar, with the highlighted code content below via NodeViewContent.
 */

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain text' },
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
  { value: 'yaml', label: 'YAML' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
]

export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const language = (node.attrs.language as string) || 'plaintext'
  const displayLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language

  return (
    <NodeViewWrapper className="leaf-code-block-wrapper" data-language={language}>
      <div className="leaf-code-block-header" contentEditable={false}>
        <span className="leaf-code-lang-icon">
          {/* Small dot accent */}
          <span className="leaf-code-lang-dot" />
        </span>
        <select
          className="leaf-code-lang-select"
          value={language}
          title={displayLabel}
          onChange={(e) => updateAttributes({ language: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      <pre className="hljs">
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
