/**
 * Floating bubble shown when the user selects non-empty text in the rich editor.
 * Holds alignment, clear colour, and colour swatches (no static toolbar — slash / + menu for everything else).
 */

'use client'

import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { LEAF_TEXT_COLOR_SWATCHES } from '@/lib/editorRichText'

type Props = { editor: Editor; onLinkClick?: () => void }

export function EditorSelectionBubble({ editor, onLinkClick }: Props) {
  useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      from: ed.state.selection.from,
      to: ed.state.selection.to,
    }),
  })

  const colorSwatches = LEAF_TEXT_COLOR_SWATCHES.map((sw) => ({
    id: sw.id,
    title: sw.title,
    value: sw.value,
    active: () => editor.isActive('textStyle', { color: sw.value }),
    action: () => editor.chain().focus().setColor(sw.value).run(),
  }))

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 rounded-lg border px-1.5 py-1 shadow-md"
      style={{
        background: 'var(--leaf-bg-elevated)',
        borderColor: 'var(--leaf-border-strong)',
        boxShadow: '0 4px 20px color-mix(in srgb, var(--foreground) 12%, transparent)',
      }}
    >
      <button
        type="button"
        title="Align left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={[
          'px-1.5 py-0.5 rounded text-xs font-mono transition',
          editor.isActive({ textAlign: 'left' }) ? 'font-medium' : '',
        ].join(' ')}
        style={editor.isActive({ textAlign: 'left' })
          ? { background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)', color: 'var(--leaf-green)' }
          : { color: 'var(--leaf-text-muted)' }}
      >
        L
      </button>
      <button
        type="button"
        title="Align center"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={[
          'px-1.5 py-0.5 rounded text-xs font-mono transition',
          editor.isActive({ textAlign: 'center' }) ? 'font-medium' : '',
        ].join(' ')}
        style={editor.isActive({ textAlign: 'center' })
          ? { background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)', color: 'var(--leaf-green)' }
          : { color: 'var(--leaf-text-muted)' }}
      >
        C
      </button>
      <button
        type="button"
        title="Align right"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={[
          'px-1.5 py-0.5 rounded text-xs font-mono transition',
          editor.isActive({ textAlign: 'right' }) ? 'font-medium' : '',
        ].join(' ')}
        style={editor.isActive({ textAlign: 'right' })
          ? { background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)', color: 'var(--leaf-green)' }
          : { color: 'var(--leaf-text-muted)' }}
      >
        R
      </button>
      <div className="mx-0.5 h-4 w-px shrink-0" style={{ background: 'var(--leaf-border-strong)' }} />
      <button
        type="button"
        title="Add web link (Cmd K)"
        onClick={() => onLinkClick?.()}
        className="px-1.5 py-0.5 rounded text-xs transition"
        style={{
          color: editor.isActive('link') ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
          fontWeight: editor.isActive('link') ? 600 : 400,
        }}
      >
        Link
      </button>
      {editor.isActive('link') ? (
        <button
          type="button"
          title="Remove link"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="px-1.5 py-0.5 rounded text-xs transition"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          Unlink
        </button>
      ) : null}
      <div className="mx-0.5 h-4 w-px shrink-0" style={{ background: 'var(--leaf-border-strong)' }} />
      <button
        type="button"
        title="Clear text colour"
        onClick={() => editor.chain().focus().unsetColor().run()}
        className="px-1.5 py-0.5 rounded text-xs font-mono transition"
        style={{ color: 'var(--leaf-text-muted)' }}
      >
        Clr
      </button>
      <div className="mx-0.5 h-4 w-px shrink-0" style={{ background: 'var(--leaf-border-strong)' }} />
      <div className="flex items-center gap-1">
        {colorSwatches.map((sw) => {
          const on = sw.active()
          return (
            <button
              key={sw.id}
              type="button"
              title={sw.title}
              onClick={sw.action}
              className="h-5 w-5 rounded-full border transition shrink-0"
              style={{
                background: sw.value,
                borderColor: on ? 'var(--leaf-green)' : 'var(--leaf-border-strong)',
                boxShadow: on ? '0 0 0 1px var(--leaf-green)' : undefined,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
