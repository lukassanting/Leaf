'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { TopStrip } from '@/components/TopStrip'
import { StatusBar } from '@/components/StatusBar'
import { LoadingShell } from '@/components/LoadingShell'
import { IconPicker } from '@/components/page/IconPicker'
import { PageIdentityHeader } from '@/components/page/PageIdentityHeader'
import { AddColumnModal, BoardView, GalleryView, TableView } from '@/components/database/DatabaseViews'
import { useDatabasePage } from '@/hooks/useDatabasePage'
import { useContentWidth } from '@/app/(workspace)/layout'
import type { LeafIcon, ViewType } from '@/lib/api'

const VIEW_LABELS: { key: ViewType; label: string }[] = [
  { key: 'table', label: 'Table' },
  { key: 'board', label: 'Board' },
  { key: 'gallery', label: 'Gallery' },
]

export default function DatabaseViewPage() {
  const params = useParams()
  const id = params?.id as string
  const { contentWidth } = useContentWidth()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  const {
    db,
    rows,
    loading,
    showAddCol,
    setShowAddCol,
    titleDraft,
    setTitleDraft,
    descriptionDraft,
    setDescriptionDraft,
    tagsDraft,
    setTagsDraft,
    iconDraft,
    setIconDraft,
    saveStatus,
    flushTitleSave,
    saveDatabase,
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

  const saveMeta = async (patch: { description?: string | null; tags?: string[]; icon?: LeafIcon | null }) => {
    const updated = await saveDatabase(patch)
    if (!updated) return
    setDescriptionDraft(updated.description ?? '')
    setTagsDraft(updated.tags ?? [])
    setIconDraft(updated.icon ?? null)
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

  const contentMaxWidth = contentWidth === 'normal' ? 680 : contentWidth === 'wide' ? 960 : undefined
  const contentPadding = contentWidth === 'full' ? '0 24px' : undefined

  return (
    <>
      {showAddCol && <AddColumnModal onAdd={addColumn} onClose={() => setShowAddCol(false)} />}

      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--leaf-bg-editor)' }}>
        {/* Top strip */}
        <TopStrip
          breadcrumbs={breadcrumbs.map((c) => ({ id: c.id, title: c.title, kind: 'page' as const }))}
          currentTitle={titleDraft}
        />

        <PageIdentityHeader
          kind="database"
          icon={iconDraft}
          onIconClick={() => setIconPickerOpen((current) => !current)}
          iconPicker={iconPickerOpen ? (
            <IconPicker
              currentIcon={iconDraft}
              onApply={(nextIcon) => { void saveMeta({ icon: nextIcon }) }}
              onClose={() => setIconPickerOpen(false)}
            />
          ) : null}
          title={titleDraft}
          onTitleChange={setTitleDraft}
          onTitleBlur={() => flushTitleSave()}
          onTitleEnter={() => flushTitleSave()}
          titlePlaceholder="Untitled database"
          description={descriptionDraft}
          onDescriptionChange={setDescriptionDraft}
          onDescriptionBlur={(value) => { void saveMeta({ description: value || null }) }}
          tags={tagsDraft}
          onTagsChange={(nextTags) => {
            setTagsDraft(nextTags)
            void saveMeta({ tags: nextTags })
          }}
          extraContent={(
            <div className="flex items-center gap-2" style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)' }}>
              <span
                className="rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: saveStatus === 'error' ? '#dc2626' : saveStatus === 'saving' ? 'var(--leaf-text-muted)' : '#6abf7a',
                }}
              />
              <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Error' : 'Synced'}</span>
              <span style={{ color: '#ccd9c4' }}>·</span>
              <span>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
            </div>
          )}
        />

        {/* Database content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px 0' }}>
          <div
            style={{
              maxWidth: contentMaxWidth || 960,
              margin: '0 auto',
              padding: contentPadding || '0 24px',
            }}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-0.5 rounded-full" style={{ background: '#eef3eb', borderRadius: 20, padding: 3 }}>
                {VIEW_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => void setViewType(key)}
                    className="flex items-center gap-1.5 transition-colors duration-150"
                    style={{
                      padding: '5px 13px',
                      borderRadius: 16,
                      fontSize: 12,
                      cursor: 'pointer',
                      background: activeView === key ? 'var(--leaf-bg-editor)' : 'transparent',
                      color: activeView === key ? 'var(--leaf-text-title)' : '#5a8a6a',
                      fontWeight: activeView === key ? 500 : 400,
                    }}
                  >
                    {viewIcons[key]}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 transition-colors duration-150"
                  style={{
                    fontSize: 12,
                    color: '#5a8a6a',
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: '0.5px solid #cdd9c6',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(61,140,82,0.07)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1 3H10M2.5 5.5H8.5M4 8H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Filter
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 transition-colors duration-150"
                  style={{
                    fontSize: 12,
                    color: '#5a8a6a',
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: '0.5px solid #cdd9c6',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(61,140,82,0.07)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1 3L3.5 5.5L6 3M5 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sort
                </button>
                <button
                  type="button"
                  onClick={() => void addRow()}
                  className="flex items-center gap-1.5 transition-colors duration-150"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#fff',
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: '0.5px solid var(--leaf-green)',
                    background: 'var(--leaf-green)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2f7340')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--leaf-green)')}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1V10M1 5.5H10" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  New entry
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

        {/* Status bar */}
        <StatusBar
          saveStatus={saveStatus}
          wordCount={0}
          modeLabel={`${activeView.charAt(0).toUpperCase() + activeView.slice(1)} view`}
        />
      </div>
    </>
  )
}
