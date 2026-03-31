/**
 * Shared link UI: search, web link, bookmark card, workspace pages.
 * Used inside the selection bubble and the floating popover (slash / Mod-k fallback).
 */

'use client'

import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { LeafTreeItem } from '@/lib/api/types'
import { DatabaseIcon, LeafIcon } from '@/components/Icons'
import { rankWikilinkItems } from '@/components/editor/slashMatchUtils'

function isFormFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

type Props = {
  editor: Editor
  leaves: LeafTreeItem[]
  onClose: () => void
  onBookmark: (url: string) => void
  /** When true, focus the search field on mount (floating popover). */
  autoFocus?: boolean
  searchInputRef?: RefObject<HTMLInputElement | null>
}

export function EditorLinkPanel({
  editor,
  leaves,
  onClose,
  onBookmark,
  autoFocus = false,
  searchInputRef: externalInputRef,
}: Props) {
  const [query, setQuery] = useState('')
  const innerRef = useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef ?? innerRef

  useEffect(() => {
    if (!autoFocus) return
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [autoFocus, inputRef])

  const q = query.trim()
  const filteredPages = q.length > 0 ? rankWikilinkItems(leaves, query).slice(0, 8) : []

  const applyWebLink = (url: string) => {
    const u = url.trim()
    if (!u) return
    const href = u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/') ? u : `https://${u}`
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    onClose()
  }

  const applyPageLink = (item: LeafTreeItem) => {
    editor.chain().focus().extendMarkRange('link').setLink({ href: `/editor/${item.id}` }).run()
    onClose()
  }

  const linkActive = editor.isActive('link')

  return (
    <div
      onMouseDown={(e) => {
        if (isFormFieldTarget(e.target)) return
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="px-3 pt-2 pb-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages or paste link…"
          className="leaf-link-panel-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition-shadow"
          style={{
            background: 'var(--leaf-bg-app)',
            borderColor: 'var(--leaf-border-soft)',
            color: 'var(--leaf-text-title)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              if (query.trim()) applyWebLink(query)
            }
          }}
        />
      </div>

      <div className="px-3 pb-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          Link options
        </span>
      </div>

      <button
        type="button"
        className="leaf-link-panel-row flex w-full items-center gap-2 px-3 py-2 text-left"
        onMouseDown={(e) => {
          e.preventDefault()
          applyWebLink(query || 'https://')
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--leaf-green) 10%, transparent)', color: 'var(--leaf-green)' }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6.5 9.5a3.536 3.536 0 0 0 5 0l2-2a3.536 3.536 0 0 0-5-5l-1 1" />
            <path d="M9.5 6.5a3.536 3.536 0 0 0-5 0l-2 2a3.536 3.536 0 0 0 5 5l1-1" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
          Link to web page
        </span>
        <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--leaf-text-muted)' }} title="macOS: ⌘K">
          Ctrl+K
        </span>
      </button>

      <button
        type="button"
        className="leaf-link-panel-row flex w-full items-center gap-2 px-3 py-2 text-left"
        onMouseDown={(e) => {
          e.preventDefault()
          onClose()
          onBookmark(query.trim())
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--leaf-green) 10%, transparent)', color: 'var(--leaf-text-muted)' }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v12l-5-3-5 3z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
          Create bookmark
        </span>
        <span className="shrink-0 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
          Card
        </span>
      </button>

      {linkActive && (
        <button
          type="button"
          className="leaf-link-panel-row flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
          style={{ color: 'var(--leaf-red, #ef4444)' }}
          onMouseDown={(e) => {
            e.preventDefault()
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            onClose()
          }}
        >
          Remove link
        </button>
      )}

      {filteredPages.length > 0 && (
        <>
          <div className="mx-0 mt-1 border-t pt-1.5" style={{ borderColor: 'var(--leaf-border-soft)' }} />
          <div className="px-3 pb-0.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: 'var(--leaf-text-muted)' }}
            >
              Pages in workspace
            </span>
          </div>
          <div
            className="leaf-link-panel-pages-scroll max-h-[min(168px,32vh)] overflow-y-auto overscroll-contain"
            style={{ scrollbarGutter: 'stable' }}
          >
            {filteredPages.map((item) => {
              const isDb = item.kind === 'database'
              return (
                <button
                  key={item.id}
                  type="button"
                  className="leaf-link-panel-row flex w-full items-center gap-2 px-3 py-1.5 text-left"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyPageLink(item)
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ background: 'color-mix(in srgb, var(--leaf-green) 12%, transparent)', color: 'var(--leaf-green)' }}
                  >
                    {isDb ? <DatabaseIcon size={11} /> : <LeafIcon size={12} />}
                  </span>
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
                    {item.title || 'Untitled'}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
      <div className="h-1 shrink-0" />
    </div>
  )
}
