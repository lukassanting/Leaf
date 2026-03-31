'use client'

/**
 * MathBlock — a block-level TipTap node that stores LaTeX source and
 * renders it via KaTeX in display mode.
 *
 * Behaviour:
 * - Click (or select via keyboard) → enters edit mode (textarea)
 * - Click away / Escape → renders the math
 * - Empty block shows a placeholder prompt
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type KaTeX from 'katex'

// Lazy-loaded to avoid bundling katex + its CSS into the main chunk.
let katexLib: typeof KaTeX | null = null
async function getKatex(): Promise<typeof KaTeX> {
  if (!katexLib) {
    const mod = await import('katex')
    katexLib = mod.default
  }
  return katexLib
}

// ─── React view ───────────────────────────────────────────────────────────────

function MathBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const latex: string = (node.attrs.latex as string) || ''
  const [editing, setEditing] = useState(latex === '')
  const [draft, setDraft] = useState(latex)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const renderRef = useRef<HTMLDivElement>(null)

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(draft.length, draft.length)
    }
  }, [editing, draft.length])

  // Render KaTeX whenever latex source or edit mode changes
  useEffect(() => {
    if (editing || !renderRef.current) return
    const el = renderRef.current
    getKatex().then((katex) => {
      if (!el) return
      try {
        katex.render(latex || '\\text{Empty equation}', el, {
          displayMode: true,
          throwOnError: false,
          trust: false,
        })
      } catch {
        el.textContent = latex
      }
    })
  }, [latex, editing])

  const commit = useCallback(() => {
    updateAttributes({ latex: draft })
    setEditing(false)
  }, [draft, updateAttributes])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        commit()
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        commit()
      }
    },
    [commit],
  )

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }, [])

  const handleClick = useCallback(() => {
    if (!editing) {
      setDraft(latex)
      setEditing(true)
    }
  }, [editing, latex])

  return (
    <NodeViewWrapper
      className={`leaf-math-block${selected ? ' leaf-math-block--selected' : ''}`}
      data-type="math-block"
    >
      {editing ? (
        <div className="leaf-math-edit">
          <div className="leaf-math-edit-header" contentEditable={false}>
            <span className="leaf-math-label">LaTeX</span>
            <span className="leaf-math-hint">Esc or ⌘↵ to render</span>
          </div>
          <textarea
            ref={textareaRef}
            className="leaf-math-textarea"
            value={draft}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            placeholder="Enter LaTeX…  e.g. f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\,e^{2\pi i \xi x}\,d\xi"
            rows={2}
            spellCheck={false}
          />
        </div>
      ) : (
        <div
          className={`leaf-math-render${!latex ? ' leaf-math-render--empty' : ''}`}
          onClick={handleClick}
          title="Click to edit"
        >
          {latex ? (
            <div ref={renderRef} />
          ) : (
            <span className="leaf-math-empty">Click to enter equation…</span>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}

// ─── TipTap node ──────────────────────────────────────────────────────────────

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})
