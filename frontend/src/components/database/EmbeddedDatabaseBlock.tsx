/**
 * Leaf UI: embedded database block (`frontend/src/components/database/EmbeddedDatabaseBlock.tsx`).
 *
 * Purpose:
 * - Renders an inline “card” representation of a database inside a leaf editor document.
 * - Uses `useDatabasePage(id)` to load database data and rows.
 * - Delegates the actual content/table UI to `DatabaseSurface`.
 *
 * How to read:
 * - Props only contain `id` (database UUID).
 * - Loading/error states are handled locally:
 *   - `loading` -> Loading database…
 *   - `!db` -> “Database not found”
 * - Successful state wraps `DatabaseSurface` inside a styled container.
 *
 * Update:
 * - To change how embedded DB cards look, adjust the wrapper JSX and styles.
 * - To change which view modes are allowed when embedded, update `DatabaseSurface` usage.
 *
 * Debug:
 * - If embedded DB fails to load, check:
 *   - the database id passed from `LeafEditor`
 *   - that backend `/databases/{id}` and `/databases/{id}/rows` endpoints work
 *   - `useDatabasePage` loading behavior.
 */


'use client'

import Link from 'next/link'
import { DatabaseIcon } from '@/components/Icons'
import { DatabaseSurface } from '@/components/database/DatabaseSurface'
import { useDatabasePage } from '@/hooks/useDatabasePage'
import type { ViewType } from '@/lib/api'

export function EmbeddedDatabaseBlock({ id }: { id: string }) {
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
  } = useDatabasePage(id)

  if (loading) {
    return (
      <div
        className="rounded-xl border px-4 py-3"
        style={{ borderColor: 'var(--leaf-border-strong)', background: 'var(--leaf-bg-editor)' }}
      >
        <div className="text-sm" style={{ color: 'var(--leaf-text-muted)' }}>Loading database…</div>
      </div>
    )
  }

  if (!db) {
    return (
      <div
        className="rounded-xl border px-4 py-3"
        style={{ borderColor: '#f2c4bc', background: 'var(--leaf-bg-editor)' }}
      >
        <div className="text-sm" style={{ color: '#8a3a2a' }}>Database not found.</div>
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--leaf-border-strong)', background: 'var(--leaf-bg-editor)' }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--leaf-border-soft)', background: 'rgba(255,255,255,0.5)' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--leaf-bg-tag)', color: 'var(--leaf-text-title)' }}>
              <DatabaseIcon size={15} />
            </span>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={flushTitleSave}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className="w-full truncate bg-transparent text-sm font-medium outline-none"
              style={{ color: 'var(--leaf-text-title)' }}
              placeholder="Untitled database"
            />
          </div>
          <div className="mt-1 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
            {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · Inline database
          </div>
        </div>
        <Link
          href={`/databases/${db.id}`}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-black/5"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H9.5M14 2v4.5M14 2L8 8" />
            <path d="M13 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3.5" />
          </svg>
          Open as full page
        </Link>
      </div>

      <div className="p-4">
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
        />
      </div>
    </div>
  )
}
