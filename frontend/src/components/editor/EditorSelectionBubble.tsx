/**
 * Floating bubble shown when the user selects non-empty text in the rich editor.
 * Holds alignment, link, clear colour, and colour swatches (no static toolbar — slash / + menu for everything else).
 */

'use client'

import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { LEAF_TEXT_COLOR_SWATCHES } from '@/lib/editorRichText'

type Props = { editor: Editor; onLinkClick?: () => void }

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function AlignLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="1" y1="3.5" x2="13" y2="3.5" />
      <line x1="1" y1="7" x2="9" y2="7" />
      <line x1="1" y1="10.5" x2="11" y2="10.5" />
    </svg>
  )
}

function AlignCenterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="1" y1="3.5" x2="13" y2="3.5" />
      <line x1="3" y1="7" x2="11" y2="7" />
      <line x1="2" y1="10.5" x2="12" y2="10.5" />
    </svg>
  )
}

function AlignRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="1" y1="3.5" x2="13" y2="3.5" />
      <line x1="5" y1="7" x2="13" y2="7" />
      <line x1="3" y1="10.5" x2="13" y2="10.5" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 11.5h10" />
      <path d="M8.5 2.5L11.5 5.5L6 11H3L2 10L7.5 4.5L8.5 2.5Z" />
      <path d="M6 11L3 8" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 8.5a3.1 3.1 0 0 0 4.4 0l1.75-1.75a3.1 3.1 0 0 0-4.4-4.4l-.87.87" />
      <path d="M8.5 5.5a3.1 3.1 0 0 0-4.4 0L2.35 7.25a3.1 3.1 0 0 0 4.4 4.4l.87-.87" />
    </svg>
  )
}

function UnlinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 8.5a3.1 3.1 0 0 0 4.4 0l1.75-1.75a3.1 3.1 0 0 0-4.4-4.4l-.87.87" />
      <path d="M8.5 5.5a3.1 3.1 0 0 0-4.4 0L2.35 7.25a3.1 3.1 0 0 0 4.4 4.4l.87-.87" />
      <line x1="2" y1="2" x2="12" y2="12" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

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

  const alignments: { key: 'left' | 'center' | 'right'; title: string; icon: React.ReactNode }[] = [
    { key: 'left',   title: 'Align left',   icon: <AlignLeftIcon /> },
    { key: 'center', title: 'Align center', icon: <AlignCenterIcon /> },
    { key: 'right',  title: 'Align right',  icon: <AlignRightIcon /> },
  ]

  const Divider = () => (
    <div className="mx-0.5 h-4 w-px shrink-0" style={{ background: 'var(--leaf-border-strong)' }} />
  )

  const linkActive = editor.isActive('link')

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border px-1.5 py-1"
      style={{
        background: 'var(--leaf-bg-elevated)',
        borderColor: 'var(--leaf-border-strong)',
        boxShadow: '0 4px 20px color-mix(in srgb, var(--foreground) 12%, transparent)',
      }}
    >
      {/* Alignment */}
      {alignments.map(({ key, title, icon }) => {
        const active = editor.isActive({ textAlign: key })
        return (
          <button
            key={key}
            type="button"
            title={title}
            onClick={() => editor.chain().focus().setTextAlign(key).run()}
            className="flex h-6 w-6 items-center justify-center rounded transition"
            style={active
              ? { background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)', color: 'var(--leaf-green)' }
              : { color: 'var(--leaf-text-muted)' }}
          >
            {icon}
          </button>
        )
      })}

      <Divider />

      {/* Link */}
      <button
        type="button"
        title={linkActive ? 'Edit link (Cmd K)' : 'Add link (Cmd K)'}
        onClick={() => onLinkClick?.()}
        className="flex h-6 w-6 items-center justify-center rounded transition"
        style={linkActive
          ? { background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)', color: 'var(--leaf-green)' }
          : { color: 'var(--leaf-text-muted)' }}
      >
        <LinkIcon />
      </button>

      {/* Unlink — only when cursor is on a link */}
      {linkActive && (
        <button
          type="button"
          title="Remove link"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="flex h-6 w-6 items-center justify-center rounded transition"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          <UnlinkIcon />
        </button>
      )}

      <Divider />

      {/* Clear colour */}
      <button
        type="button"
        title="Clear text colour"
        onClick={() => editor.chain().focus().unsetColor().run()}
        className="flex h-6 w-6 items-center justify-center rounded transition"
        style={{ color: 'var(--leaf-text-muted)' }}
      >
        <EraserIcon />
      </button>

      <Divider />

      {/* Colour swatches */}
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
                borderColor: on ? 'var(--leaf-green)' : 'transparent',
                boxShadow: on ? '0 0 0 1.5px var(--leaf-green)' : '0 0 0 1px var(--leaf-border-strong)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
