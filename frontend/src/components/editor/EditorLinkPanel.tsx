/**
 * Shared link UI: search, web link, bookmark card, workspace pages.
 * Used inside the selection bubble and the floating popover (slash / Mod-k fallback).
 *
 * Three views:
 *   'search'   – default: search pages / paste link, two option rows, workspace pages
 *   'weblink'  – dedicated URL input → "Create Inline Link"
 *   'bookmark' – dedicated URL input → "Create Visual Bookmark"
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

type PanelMode = 'search' | 'weblink' | 'bookmark'

type Props = {
  editor: Editor
  leaves: LeafTreeItem[]
  onClose: () => void
  onBookmark: (url: string) => void
  /** When true, focus the search field on mount (floating popover). */
  autoFocus?: boolean
  searchInputRef?: RefObject<HTMLInputElement | null>
}

/* ── Icon components ─────────────────────────────────────── */

function LinkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.5 9.5a3.536 3.536 0 0 0 5 0l2-2a3.536 3.536 0 0 0-5-5l-1 1" />
      <path d="M9.5 6.5a3.536 3.536 0 0 0-5 0l-2 2a3.536 3.536 0 0 0 5 5l1-1" />
    </svg>
  )
}

function BookmarkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v12l-5-3-5 3z" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8.5 3.5L5 7l3.5 3.5" />
    </svg>
  )
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
  const [mode, setMode] = useState<PanelMode>('search')
  const [subUrl, setSubUrl] = useState('')
  const innerRef = useRef<HTMLInputElement>(null)
  const subInputRef = useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef ?? innerRef

  useEffect(() => {
    if (!autoFocus) return
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [autoFocus, inputRef])

  /* Focus the sub-view input when entering a sub-mode */
  useEffect(() => {
    if (mode !== 'search') {
      const t = setTimeout(() => subInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [mode])

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

  const goBack = () => {
    setMode('search')
    setSubUrl('')
  }

  const linkActive = editor.isActive('link')

  /* ── Sub-view: dedicated URL input ───────────────────── */
  if (mode === 'weblink' || mode === 'bookmark') {
    const isLink = mode === 'weblink'
    return (
      <div
        onMouseDown={(e) => {
          if (isFormFieldTarget(e.target)) return
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {/* Back + sub-input */}
        <div className="flex items-center gap-1.5 px-3 pt-2 pb-2">
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--leaf-text-muted)' }}
            title="Back"
            onMouseDown={(e) => { e.preventDefault(); goBack() }}
          >
            <ChevronLeftIcon />
          </button>
          <div
            className="flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5"
            style={{
              background: 'var(--leaf-bg-app)',
              borderColor: 'var(--leaf-border-soft)',
            }}
          >
            <span style={{ color: isLink ? 'var(--leaf-green)' : 'var(--leaf-text-muted)', flexShrink: 0 }}>
              {isLink ? <LinkIcon size={14} /> : <BookmarkIcon size={14} />}
            </span>
            <input
              ref={subInputRef}
              value={subUrl}
              onChange={(e) => setSubUrl(e.target.value)}
              placeholder={isLink ? 'Paste web link…' : 'Paste link to create bookmark…'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--leaf-text-title)' }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  goBack()
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const u = subUrl.trim()
                  if (!u) return
                  if (isLink) {
                    applyWebLink(u)
                  } else {
                    onClose()
                    onBookmark(u)
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Action row */}
        <button
          type="button"
          className="leaf-link-panel-row flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
          onMouseDown={(e) => {
            e.preventDefault()
            const u = subUrl.trim()
            if (!u) return
            if (isLink) {
              applyWebLink(u)
            } else {
              onClose()
              onBookmark(u)
            }
          }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: isLink
                ? 'color-mix(in srgb, var(--leaf-green) 10%, transparent)'
                : 'color-mix(in srgb, var(--leaf-text-muted) 10%, transparent)',
              color: isLink ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
            }}
          >
            {isLink ? <LinkIcon /> : <BookmarkIcon />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
              {isLink ? 'Create Inline Link' : 'Create Visual Bookmark'}
            </div>
            <div className="text-xs" style={{ color: 'var(--leaf-text-muted)' }}>
              {isLink ? 'Paste URL to link text' : 'Paste URL to embed card'}
            </div>
          </div>
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
        <div className="h-1 shrink-0" />
      </div>
    )
  }

  /* ── Default search view ─────────────────────────────── */
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
          Link Options
        </span>
      </div>

      <button
        type="button"
        className="leaf-link-panel-row flex w-full items-center gap-2 px-3 py-2 text-left"
        onMouseDown={(e) => {
          e.preventDefault()
          setSubUrl(query.trim())
          setMode('weblink')
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--leaf-green) 10%, transparent)', color: 'var(--leaf-green)' }}
        >
          <LinkIcon />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
          Link to Web Page
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
          setSubUrl(query.trim())
          setMode('bookmark')
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--leaf-text-muted) 10%, transparent)', color: 'var(--leaf-text-muted)' }}
        >
          <BookmarkIcon />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
          Create Bookmark
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
              Pages in Workspace
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
