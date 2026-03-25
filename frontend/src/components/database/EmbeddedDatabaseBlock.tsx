/**
 * Leaf UI: embedded database block (`frontend/src/components/database/EmbeddedDatabaseBlock.tsx`).
 *
 * Purpose:
 * - Renders an inline representation of a database inside a leaf editor document.
 * - Uses `useDatabasePage(id)` to load database data and rows.
 * - Delegates table UI to `DatabaseSurface`.
 *
 * Update:
 * - Title click opens rename + delete; parent supplies `onDeleteDatabase` (e.g. move to Trash + remove embed).
 */


'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { DatabaseIcon } from '@/components/Icons'
import { DatabaseSurface } from '@/components/database/DatabaseSurface'
import { useDatabasePage } from '@/hooks/useDatabasePage'
import type { ViewType } from '@/lib/api'

function EmbeddedDbTitleRow({
  title,
  onTitleChange,
  onCommitTitle,
  onDeleteDatabase,
}: {
  title: string
  onTitleChange: (value: string) => void
  onCommitTitle: () => void
  onDeleteDatabase?: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onCommitTitle()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onCommitTitle])

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        className="w-full truncate bg-transparent text-left text-sm font-semibold outline-none hover:opacity-90"
        style={{ color: 'var(--leaf-text-title)' }}
        onClick={() => setOpen((o) => !o)}
      >
        {title || 'Untitled database'}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border p-2.5 shadow-lg"
          style={{
            background: 'var(--leaf-bg-elevated)',
            borderColor: 'var(--leaf-border-strong)',
            boxShadow: 'var(--leaf-shadow-soft)',
          }}
        >
          <div className="mb-1 text-[10px] font-medium" style={{ color: 'var(--leaf-text-muted)' }}>Database name</div>
          <input
            autoFocus
            className="mb-2 w-full rounded-md border px-2 py-1.5 text-sm outline-none"
            style={{ borderColor: 'var(--leaf-border-strong)', background: 'var(--leaf-bg-subtle)', color: 'var(--leaf-text-title)' }}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onCommitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Untitled database"
          />
          {onDeleteDatabase ? (
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-[12px]"
              style={{ color: '#dc2626' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
              onClick={() => {
                onDeleteDatabase()
                setOpen(false)
              }}
            >
              Delete database…
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function EmbeddedDatabaseBlock({
  id,
  onDeleteDatabase,
}: {
  id: string
  onDeleteDatabase?: () => void
}) {
  const {
    db,
    rows,
    loading,
    showAddCol,
    setShowAddCol,
    titleDraft,
    setTitleDraft,
    flushTitleSave,
    columns,
    activeView,
    addRow,
    deleteRow,
    updateName,
    updateCell,
    addColumn,
    setViewType,
    saveColumnDefinition,
    deleteColumn,
    gallerySize,
    setGallerySize,
  } = useDatabasePage(id)

  if (loading) {
    return (
      <div className="py-3 text-sm" style={{ color: 'var(--leaf-text-muted)' }}>
        Loading database…
      </div>
    )
  }

  if (!db) {
    return (
      <div className="py-3 text-sm" style={{ color: '#8a3a2a' }}>
        Database not found.
      </div>
    )
  }

  return (
    <div className="my-1">
      <div className="group/dbhead mb-1 flex items-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: 'var(--leaf-text-muted)' }}>
          <DatabaseIcon size={13} />
        </span>
        <EmbeddedDbTitleRow
          title={titleDraft}
          onTitleChange={setTitleDraft}
          onCommitTitle={() => { flushTitleSave() }}
          onDeleteDatabase={onDeleteDatabase}
        />
        <span className="shrink-0 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </span>
        <Link
          href={`/databases/${db.id}`}
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] opacity-0 transition-opacity group-hover/dbhead:opacity-100 hover:bg-black/5"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          Open
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H9.5M14 2v4.5M14 2L8 8" />
            <path d="M13 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3.5" />
          </svg>
        </Link>
      </div>

      <DatabaseSurface
        activeView={activeView as ViewType}
        rows={rows}
        columns={columns}
        addRow={addRow}
        updateName={updateName}
        updateCell={updateCell}
        deleteRow={deleteRow}
        setViewType={setViewType}
        showAddCol={showAddCol}
        setShowAddCol={setShowAddCol}
        addColumn={addColumn}
        saveColumnDefinition={saveColumnDefinition}
        deleteColumn={deleteColumn}
        gallerySize={gallerySize}
        setGallerySize={setGallerySize}
      />
    </div>
  )
}
