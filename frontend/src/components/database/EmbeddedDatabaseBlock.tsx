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
            <div className="truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
              {db.title}
            </div>
          </div>
          <div className="mt-1 text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
            {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · Inline database
          </div>
        </div>
        <Link
          href={`/databases/${db.id}`}
          className="shrink-0 text-xs"
          style={{ color: 'var(--leaf-text-muted)' }}
        >
          Open ↗
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
