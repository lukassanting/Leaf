/**
 * Leaf UI: embedded database block (`frontend/src/components/database/EmbeddedDatabaseBlock.tsx`).
 *
 * Purpose:
 * - Renders an inline, borderless representation of a database inside a leaf editor document.
 * - Uses `useDatabasePage(id)` to load database data and rows.
 * - Delegates the actual content/table UI to `DatabaseSurface`.
 *
 * How to read:
 * - Props only contain `id` (database UUID).
 * - Loading/error states are handled locally.
 * - Successful state: title row + DatabaseSurface, no outer border — blends with document flow.
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
      {/* Title row — blends into document, shows actions on hover */}
      <div className="group/dbhead mb-1 flex items-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: 'var(--leaf-text-muted)' }}>
          <DatabaseIcon size={13} />
        </span>
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={flushTitleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          style={{ color: 'var(--leaf-text-title)' }}
          placeholder="Untitled database"
        />
        <span className="text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
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
      />
    </div>
  )
}
