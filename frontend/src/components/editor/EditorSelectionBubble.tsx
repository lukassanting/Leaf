/**
 * Floating bubble when the user selects text: formatting row + link panel (search, web link, bookmark, pages).
 */

'use client'

import type { ReactNode, RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import type { LeafTreeItem } from '@/lib/api/types'
import { LEAF_TEXT_COLOR_SWATCHES } from '@/lib/editorRichText'
import { EditorLinkPanel } from '@/components/editor/EditorLinkPanel'

type Props = {
  editor: Editor
  leaves: LeafTreeItem[]
  onBookmark: (url: string) => void
  linkSearchInputRef?: RefObject<HTMLInputElement | null>
}

function isFormFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function AlignLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" aria-hidden>
      <line x1="1" y1="3.5" x2="13" y2="3.5" />
      <line x1="1" y1="7" x2="9" y2="7" />
      <line x1="1" y1="10.5" x2="11" y2="10.5" />
    </svg>
  )
}

function AlignCenterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" aria-hidden>
      <line x1="1" y1="3.5" x2="13" y2="3.5" />
      <line x1="3" y1="7" x2="11" y2="7" />
      <line x1="2" y1="10.5" x2="12" y2="10.5" />
    </svg>
  )
}

function AlignRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" aria-hidden>
      <line x1="1" y1="3.5" x2="13" y2="3.5" />
      <line x1="5" y1="7" x2="13" y2="7" />
      <line x1="3" y1="10.5" x2="13" y2="10.5" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 11.5h10" />
      <path d="M8.5 2.5L11.5 5.5L6 11H3L2 10L7.5 4.5L8.5 2.5Z" />
      <path d="M6 11L3 8" />
    </svg>
  )
}

export function EditorSelectionBubble({ editor, leaves, onBookmark, linkSearchInputRef }: Props) {
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

  const alignments: { key: 'left' | 'center' | 'right'; title: string; icon: ReactNode }[] = [
    { key: 'left', title: 'Align left', icon: <AlignLeftIcon /> },
    { key: 'center', title: 'Align center', icon: <AlignCenterIcon /> },
    { key: 'right', title: 'Align right', icon: <AlignRightIcon /> },
  ]

  const noopClose = () => {
    /* panel stays open with selection; individual actions close via editor focus */
  }

  return (
    <div
      className="leaf-selection-bubble-shell w-[min(100vw-24px,368px)] overflow-hidden rounded-xl"
      onMouseDown={(e) => {
        if (isFormFieldTarget(e.target)) return
        e.preventDefault()
      }}
      style={{
        background: 'var(--leaf-bg-elevated)',
        border: '1px solid color-mix(in srgb, var(--foreground) 7%, transparent)',
        boxShadow: '0 12px 48px color-mix(in srgb, var(--foreground) 12%, transparent), 0 0 0 1px color-mix(in srgb, var(--foreground) 4%, transparent)',
      }}
    >
      <div className="p-2 pb-1">
        <div
          className="flex items-center gap-0.5 rounded-full px-1 py-1"
          style={{ background: 'color-mix(in srgb, var(--leaf-text-title) 4%, transparent)' }}
        >
          {alignments.map(({ key, title, icon }) => {
            const active = editor.isActive({ textAlign: key })
            return (
              <button
                key={key}
                type="button"
                title={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setTextAlign(key).run()}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={active
                  ? { background: 'color-mix(in srgb, var(--leaf-green) 14%, transparent)', color: 'var(--leaf-green)' }
                  : { color: 'var(--leaf-text-muted)' }}
              >
                {icon}
              </button>
            )
          })}

          <div className="mx-0.5 h-5 w-px shrink-0 self-center" style={{ background: 'var(--leaf-border-soft)' }} />

          <button
            type="button"
            title="Clear text colour"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().unsetColor().run()}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ color: 'var(--leaf-text-muted)' }}
          >
            <EraserIcon />
          </button>

          <div className="mx-0.5 h-5 w-px shrink-0 self-center" style={{ background: 'var(--leaf-border-soft)' }} />

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 pl-0.5">
            {colorSwatches.map((sw) => {
              const on = sw.active()
              return (
                <button
                  key={sw.id}
                  type="button"
                  title={sw.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={sw.action}
                  className="h-[20px] w-[20px] shrink-0 rounded-full border-2 transition-transform hover:scale-105"
                  style={{
                    background: sw.value,
                    borderColor: on ? 'var(--leaf-green)' : 'transparent',
                    boxShadow: on ? '0 0 0 1px var(--leaf-green)' : 'inset 0 0 0 1px color-mix(in srgb, var(--foreground) 12%, transparent)',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'var(--leaf-border-soft)' }}>
        <EditorLinkPanel
          editor={editor}
          leaves={leaves}
          onClose={noopClose}
          onBookmark={onBookmark}
          searchInputRef={linkSearchInputRef}
        />
      </div>
    </div>
  )
}

export type LinkPopoverRect = { top: number; bottom: number; left: number; right?: number }

export function EditorFloatingLinkPanel({
  rect,
  editor,
  leaves,
  onClose,
  onBookmark,
}: {
  rect: LinkPopoverRect
  editor: Editor
  leaves: LeafTreeItem[]
  onClose: () => void
  onBookmark: (url: string) => void
}) {
  const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - rect.bottom : 400
  const top =
    spaceBelow < 340 && typeof window !== 'undefined'
      ? rect.top - 8 - Math.min(340, window.innerHeight * 0.45)
      : rect.bottom + 8
  const panelW = 368
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800
  const left = Math.max(12, Math.min(rect.left, vw - panelW - 12))

  return (
    <div
      className="leaf-selection-bubble-shell fixed z-[9999] w-[min(100vw-24px,368px)] overflow-hidden rounded-xl"
      style={{
        top: Math.max(12, top),
        left,
        background: 'var(--leaf-bg-elevated)',
        border: '1px solid color-mix(in srgb, var(--foreground) 7%, transparent)',
        boxShadow: '0 12px 48px color-mix(in srgb, var(--foreground) 12%, transparent), 0 0 0 1px color-mix(in srgb, var(--foreground) 4%, transparent)',
      }}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
    >
      <div className="border-b px-3 py-2" style={{ borderColor: 'var(--leaf-border-soft)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--leaf-text-title)' }}>Link</span>
      </div>
      <EditorLinkPanel
        editor={editor}
        leaves={leaves}
        onClose={onClose}
        onBookmark={onBookmark}
        autoFocus
      />
    </div>
  )
}
