/**
 * Leaf frontend: Leaf editor page (`frontend/src/app/(workspace)/editor/[id]/page.tsx`).
 *
 * Purpose:
 * - Main route for viewing/editing a single leaf (page/project).
 * - Orchestrates data loading, autosave, and metadata editing (title/description/tags/icon).
 *
 * How to read:
 * - Start at `useLeafPageData(leafId)` to understand the state shape: `content`, `title`, `tags`, `loadingLeaf`, etc.
 * - Then read `useLeafAutosave(...)` to see how content saves are scheduled.
 * - The callbacks (`handleTitleSave`, `handleDescriptionSave`, `handleTagsSave`, `handleIconSave`) call `*AndPrimeCache` helpers.
 * - UI structure: `TopStrip` -> scroll column (`PageIdentityHeader` + `Editor`) -> `StatusBar`.
 *
 * Update:
 * - If you add a new metadata field, follow the pattern:
 *   - keep the value in `useLeafPageData`
 *   - update it locally
 *   - persist via the appropriate `leafMutations` helper and `setUpdatedAt`.
 * - If autosave behavior changes, update `useLeafAutosave` (not this page) first.
 * - To change keyboard shortcuts, edit `handleKeyDown` (Cmd/Ctrl+S triggers `saveNow()`).
 *
 * Debug:
 * - When saves don’t persist, check:
 *   - `useLeafAutosave` schedule/status
 *   - mutation helpers errors (`renameLeafAndPrimeCache` / `updateLeafAndPrimeCache`)
 *   - `hasLoadedRef` guard (prevents rename before initial data load).
 * - For UI inconsistencies, verify `contentWidth` comes from the workspace layout provider.
 */


'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { LoadingShell } from '@/components/LoadingShell'
import { IconPicker } from '@/components/page/IconPicker'
import { TopStrip } from '@/components/TopStrip'
import { StatusBar } from '@/components/StatusBar'
import { PageIdentityHeader } from '@/components/page/PageIdentityHeader'
import { createDatabaseAndEmit } from '@/lib/databaseMutations'
import { createLeafAndPrimeCache, renameLeafAndPrimeCache, updateLeafAndPrimeCache } from '@/lib/leafMutations'
import { useLeafAutosave } from '@/hooks/useLeafAutosave'
import { useLeafBreadcrumbs } from '@/hooks/useLeafBreadcrumbs'
import { useLeafPageData } from '@/hooks/useLeafPageData'
import { warmDatabaseRoute } from '@/lib/warmEditorRoute'
import { ensureTagEntries } from '@/lib/workspaceDefaults'
import { useContentWidth } from '@/app/(workspace)/layout'
import type { EditorActions } from '@/components/Editor'
import type { LeafIcon } from '@/lib/api'

const Editor = dynamic(() => import(/* webpackPrefetch: true */ '@/components/Editor'), { ssr: false })

export default function EditorPage() {
  const params = useParams()
  const leafId = params?.id as string

  const [editorMode, setEditorMode] = useState<'rich' | 'markdown'>('rich')
  const [wordCount, setWordCount] = useState(0)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const editorActionsRef = useRef<EditorActions | null>(null)
  const { contentWidth } = useContentWidth()

  const {
    content,
    setContent,
    title,
    setTitle,
    description,
    setDescription,
    parentId,
    databaseId,
    childrenIds,
    updatedAt,
    setUpdatedAt,
    tags,
    setTags,
    icon,
    setIcon,
    contentTextLength,
    loadingLeaf,
    savedTitleRef,
    savedDescriptionRef,
    hasLoadedRef,
  } = useLeafPageData(leafId)

  const breadcrumbs = useLeafBreadcrumbs(parentId, databaseId)
  const { saveStatus, latestContentRef, scheduleSave, saveNow } = useLeafAutosave({
    leafId,
    currentContent: content,
    title,
    description,
    parentId,
    databaseId,
    childrenIds,
    tags,
    updatedAt,
    setUpdatedAt,
  })

  const handleTitleSave = useCallback(async (newTitle: string) => {
    if (!hasLoadedRef.current) return
    const trimmed = newTitle.trim() || 'Untitled'
    if (trimmed === savedTitleRef.current) return

    setTitle(trimmed)
    savedTitleRef.current = trimmed

    try {
      const updated = await renameLeafAndPrimeCache(leafId, {
        title: trimmed,
        parent_id: parentId ?? undefined,
        database_id: databaseId ?? undefined,
        children_ids: childrenIds,
        tags,
      }, content)
      setUpdatedAt(updated.updated_at)
    } catch (error) {
      console.error('[leaf:title] save failed', error)
    }
  }, [leafId, parentId, databaseId, childrenIds, tags, content, hasLoadedRef, savedTitleRef, setTitle, setUpdatedAt])

  const handleDescriptionSave = useCallback(async (newDesc: string) => {
    const trimmed = newDesc.trim()
    if (trimmed === savedDescriptionRef.current) return
    setDescription(trimmed)
    savedDescriptionRef.current = trimmed
    try {
      await updateLeafAndPrimeCache(leafId, {
        title,
        description: trimmed || null,
        parent_id: parentId ?? undefined,
        database_id: databaseId ?? undefined,
        children_ids: childrenIds,
        tags,
      }, content)
    } catch (error) {
      console.error('Failed to save description', error)
    }
  }, [leafId, title, parentId, databaseId, childrenIds, tags, content, savedDescriptionRef, setDescription])

  const handleTagsSave = useCallback(async (newTags: string[]) => {
    setTags(newTags)
    try {
      await updateLeafAndPrimeCache(leafId, {
        title,
        parent_id: parentId ?? undefined,
        database_id: databaseId ?? undefined,
        children_ids: childrenIds,
        tags: newTags,
      }, content)
      void ensureTagEntries(newTags)
    } catch (error) {
      console.error('Failed to save tags', error)
    }
  }, [leafId, title, parentId, databaseId, childrenIds, content, setTags])

  const handleIconSave = useCallback(async (nextIcon: LeafIcon | null) => {
    setIcon(nextIcon)
    try {
      await updateLeafAndPrimeCache(leafId, {
        title,
        description: description || null,
        parent_id: parentId ?? undefined,
        database_id: databaseId ?? undefined,
        children_ids: childrenIds,
        tags,
        icon: nextIcon,
      }, content)
    } catch (error) {
      console.error('Failed to save icon', error)
    }
  }, [leafId, title, description, parentId, databaseId, childrenIds, tags, content, setIcon])

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    const isMac = /Mac/i.test(navigator.userAgent)
    if ((isMac ? event.metaKey : event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      saveNow()
    }
  }

  const handleCreateSubPage = useCallback(async () => {
    const leaf = await createLeafAndPrimeCache({ title: 'Untitled', parent_id: leafId }, { parent_id: leafId, kind: 'page' })
    return { id: leaf.id, title: leaf.title }
  }, [leafId])

  const handleCreateDatabase = useCallback(async () => {
    void warmDatabaseRoute()
    const database = await createDatabaseAndEmit({ title: 'Untitled database', parent_leaf_id: leafId })
    return { id: database.id, title: database.title, view: database.view_type }
  }, [leafId])

  // Content width styles
  const contentMaxWidth = contentWidth === 'normal' ? 680 : contentWidth === 'wide' ? 960 : undefined
  const contentPadding = contentWidth === 'full' ? '0 24px' : undefined

  if (loadingLeaf && !hasLoadedRef.current) {
    return <LoadingShell label="Loading page…" />
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: 'var(--leaf-bg-editor)' }}
      onKeyDown={handleKeyDown}
    >
      {/* Top strip */}
      <TopStrip
        breadcrumbs={breadcrumbs.map((c) => ({ id: c.id, title: c.title, kind: c.kind }))}
        currentTitle={title}
      />

      {/* Identity + body share one scroll region so the title scrolls away with the page */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '0 0 40px' }}>
        <div
          style={{
            maxWidth: contentMaxWidth,
            margin: contentMaxWidth ? '0 auto' : undefined,
            padding: contentPadding || '0 28px',
          }}
        >
          <PageIdentityHeader
            kind="page"
            icon={icon}
            onIconClick={() => setIconPickerOpen((current) => !current)}
            iconPicker={iconPickerOpen ? (
              <IconPicker
                currentIcon={icon}
                onApply={(nextIcon) => { void handleIconSave(nextIcon) }}
                onClose={() => setIconPickerOpen(false)}
              />
            ) : null}
            title={title}
            onTitleChange={setTitle}
            onTitleBlur={(value) => { void handleTitleSave(value) }}
            description={description}
            onDescriptionChange={setDescription}
            onDescriptionBlur={(value) => { void handleDescriptionSave(value) }}
            tags={tags}
            onTagsChange={(nextTags) => { void handleTagsSave(nextTags) }}
            showTags
          />
          <div style={{ marginTop: 6, marginBottom: 8, fontSize: 11, color: 'var(--leaf-text-muted)' }}>
            Indexed content length: {contentTextLength} chars
          </div>
          <Editor
            content={content}
            leafId={leafId}
            onUpdate={(document) => {
              setContent(document)
              latestContentRef.current = document
              scheduleSave(document)
            }}
            onCreateSubPage={handleCreateSubPage}
            onCreateDatabase={handleCreateDatabase}
            onStatusChange={(_, words) => setWordCount(words)}
            onTagAdd={(tag) => {
              if (!tags.includes(tag)) {
                void handleTagsSave([...tags, tag])
              }
            }}
            mode={editorMode}
            onModeChange={setEditorMode}
            actionsRef={editorActionsRef}
          />
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        saveStatus={saveStatus}
        wordCount={wordCount}
        modeLabel={editorMode === 'rich' ? 'Rich' : 'Markdown'}
      />
    </div>
  )
}
