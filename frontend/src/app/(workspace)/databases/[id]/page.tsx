/**
 * Leaf frontend: Database detail/table view (`frontend/src/app/(workspace)/databases/[id]/page.tsx`).
 *
 * Purpose:
 * - Loads a database and renders its rows/columns via `DatabaseSurface`.
 * - Allows editing database metadata (title/description/tags/icon) and persists through hooks/mutations.
 *
 * How to read:
 * - `useDatabasePage(id)` is the primary state owner (rows, columns, view type, drafts, and actions).
 * - Local `saveMeta(...)` persists optional fields using `saveDatabase`.
 * - `PageIdentityHeader` wires draft changes -> blur/enter handlers or explicit save meta calls.
 *
 * Update:
 * - To add extra metadata fields, prefer extending `useDatabasePage` and then update `saveMeta` + `PageIdentityHeader` props.
 * - To change the layout widths, adjust `contentMaxWidth`/`contentPadding` logic using `useContentWidth`.
 *
 * Debug:
 * - If the page shows “Database not found”, check `useDatabasePage` loading/error semantics.
 * - If saves don’t apply, inspect `saveDatabase(patch)` return handling and `saveStatus` transitions.
 */


'use client'

import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { TopStrip } from '@/components/TopStrip'
import { StatusBar } from '@/components/StatusBar'
import { LoadingShell } from '@/components/LoadingShell'
import { IconPicker } from '@/components/page/IconPicker'
import { PageIdentityHeader } from '@/components/page/PageIdentityHeader'
import { DatabaseSurface } from '@/components/database/DatabaseSurface'
import { useDatabasePage } from '@/hooks/useDatabasePage'
import { useContentWidth } from '@/app/(workspace)/layout'
import type { LeafIcon, ViewType } from '@/lib/api'

export default function DatabaseViewPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const highlightedRowId = searchParams.get('row')
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
    saveColumnDefinition,
    deleteColumn,
    gallerySize,
    setGallerySize,
    deleteDatabase,
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

  const contentMaxWidth = contentWidth === 'normal' ? 680 : contentWidth === 'wide' ? 960 : undefined
  const contentPadding = contentWidth === 'full' ? '0 24px' : undefined

  return (
    <>
      <div className="leaf-database-view-page flex min-h-0 flex-1 flex-col" style={{ background: 'var(--leaf-bg-editor)' }}>
        {/* Top strip */}
        <TopStrip
          breadcrumbs={breadcrumbs.map((c) => ({ id: c.id, title: c.title, kind: 'page' as const }))}
          currentTitle={titleDraft}
        />

        <div
          style={{
            maxWidth: contentMaxWidth,
            margin: contentMaxWidth ? '0 auto' : undefined,
            padding: contentPadding || '0 24px',
            width: '100%',
          }}
        >
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
            showTags={false}
            databaseMenu={{ onDelete: () => { void deleteDatabase() } }}
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
        </div>

        {/* Database content */}
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 48 }}>
          <div
            style={{
              maxWidth: contentMaxWidth,
              margin: contentMaxWidth ? '0 auto' : undefined,
              padding: contentPadding || '0 24px',
            }}
          >
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
              highlightedRowId={highlightedRowId}
              saveColumnDefinition={saveColumnDefinition}
              deleteColumn={deleteColumn}
              gallerySize={gallerySize}
              setGallerySize={setGallerySize}
            />
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
