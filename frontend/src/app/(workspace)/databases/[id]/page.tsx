'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { DatabaseIcon } from '@/components/Icons'
import { LoadingShell } from '@/components/LoadingShell'
import { AddColumnModal, BoardView, GalleryView, TableView } from '@/components/database/DatabaseViews'
import { useDatabasePage } from '@/hooks/useDatabasePage'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import type { ViewType } from '@/lib/api'

const VIEW_LABELS: { key: ViewType; label: string }[] = [
  { key: 'table', label: 'Table' },
  { key: 'board', label: 'Board' },
  { key: 'gallery', label: 'Gallery' },
]

export default function DatabaseViewPage() {
  const params = useParams()
  const { startNavigation } = useNavigationProgress()
  const id = params?.id as string

  const {
    db,
    rows,
    loading,
    showAddCol,
    setShowAddCol,
    titleDraft,
    setTitleDraft,
    saveStatus,
    flushTitleSave,
    breadcrumbs,
    columns,
    activeView,
    addRow,
    deleteRow,
    updateName,
    updateCell,
    addColumn,
    setViewType,
  } = useDatabasePage(id)

  if (loading || !db) {
    return <LoadingShell label={loading ? 'Loading database…' : 'Database not found.'} />
  }

  const viewIcons: Record<string, React.ReactNode> = {
    table: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="1" width="12" height="12" rx="1.5" />
        <line x1="1" y1="5" x2="13" y2="5" />
        <line x1="5" y1="5" x2="5" y2="13" />
      </svg>
    ),
    board: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="2" width="3" height="10" rx="1" />
        <rect x="5.5" y="4" width="3" height="8" rx="1" />
        <rect x="10" y="1" width="3" height="11" rx="1" />
      </svg>
    ),
    gallery: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25">
        <rect x="1" y="1" width="5" height="5" rx="1" />
        <rect x="8" y="1" width="5" height="5" rx="1" />
        <rect x="1" y="8" width="5" height="5" rx="1" />
        <rect x="8" y="8" width="5" height="5" rx="1" />
      </svg>
    ),
  }

  return (
    <>
      {showAddCol && <AddColumnModal onAdd={addColumn} onClose={() => setShowAddCol(false)} />}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <div
          className="flex items-center justify-between px-10 h-10 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <nav className="flex items-center gap-1 text-xs overflow-hidden" style={{ color: 'var(--color-text-muted)' }}>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                {index > 0 && <span className="opacity-40 mx-0.5">/</span>}
                <Link
                  href={`/editor/${crumb.id}`}
                  className="truncate max-w-[120px] transition-colors duration-150 hover:text-leaf-700"
                  onClick={() => startNavigation()}
                  onMouseEnter={() => { void warmEditorRoute() }}
                >
                  {crumb.title}
                </Link>
              </span>
            ))}
            {breadcrumbs.length > 0 && <span className="opacity-40 mx-0.5">/</span>}
            <span className="truncate max-w-[180px] text-xs font-medium" style={{ color: 'var(--color-text-dark)' }}>
              {titleDraft || 'Untitled database'}
            </span>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-10 pt-10 pb-6">
            <div className="flex items-start gap-3 mb-3">
              <span className="mt-1.5 shrink-0" style={{ color: 'var(--color-primary)' }}>
                <DatabaseIcon size={22} />
              </span>
              <input
                className="flex-1 bg-transparent border-none outline-none font-medium leading-tight"
                style={{ fontSize: 29, color: 'var(--color-text-dark)', caretColor: 'var(--color-primary)' }}
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={flushTitleSave}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    flushTitleSave()
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
                placeholder="Untitled database"
              />
            </div>

            <div className="mb-6 flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    saveStatus === 'error'
                      ? '#dc2626'
                      : saveStatus === 'saving'
                        ? 'var(--color-text-muted)'
                        : 'var(--color-primary)',
                }}
              />
              <span>
                {saveStatus === 'saving'
                  ? 'Saving…'
                  : saveStatus === 'saved'
                    ? 'Synced'
                    : saveStatus === 'error'
                      ? 'Error'
                      : 'Synced'}
              </span>
              <span className="opacity-30">·</span>
              <span>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
            </div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-1 rounded-full p-1" style={{ border: '1px solid var(--color-border)', background: 'var(--color-sidebar-bg)' }}>
                {VIEW_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => void setViewType(key)}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors duration-150"
                    style={{
                      background: activeView === key ? '#fff' : 'transparent',
                      color: activeView === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: activeView === key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                    onMouseEnter={(event) => { if (activeView !== key) event.currentTarget.style.color = 'var(--color-text-dark)' }}
                    onMouseLeave={(event) => { if (activeView !== key) event.currentTarget.style.color = 'var(--color-text-muted)' }}
                  >
                    {viewIcons[key]}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void addRow()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors duration-150"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                  onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--color-primary-dk)')}
                  onMouseLeave={(event) => (event.currentTarget.style.background = 'var(--color-primary)')}
                >
                  <span>+</span> New page
                </button>
              </div>
            </div>

            {activeView === 'table' && (
              <TableView rows={rows} columns={columns} onUpdateName={updateName} onUpdateCell={updateCell} onDeleteRow={deleteRow} onAddRow={addRow} onAddColumn={() => setShowAddCol(true)} />
            )}
            {activeView === 'board' && (
              <BoardView rows={rows} columns={columns} onUpdateName={updateName} onDeleteRow={deleteRow} onAddRow={addRow} />
            )}
            {activeView === 'gallery' && (
              <GalleryView rows={rows} columns={columns} onUpdateName={updateName} onDeleteRow={deleteRow} />
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between px-10 shrink-0 text-xs"
          style={{
            height: 32,
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-sidebar-bg)',
            color: 'var(--color-text-muted)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
            <span>{activeView.charAt(0).toUpperCase() + activeView.slice(1)} view</span>
          </div>
        </div>
      </div>
    </>
  )
}
