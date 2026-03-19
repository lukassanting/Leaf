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
    loadingLeaf,
    savedTitleRef,
    hasLoadedRef,
  } = useLeafPageData(leafId)

  const breadcrumbs = useLeafBreadcrumbs(parentId, databaseId)
  const { saveStatus, latestContentRef, scheduleSave, saveNow } = useLeafAutosave({
    leafId,
    currentContent: content,
    title,
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
    if (trimmed === description) return
    setDescription(trimmed)
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
  }, [leafId, title, description, parentId, databaseId, childrenIds, tags, content, setDescription])

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
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--leaf-bg-editor)' }}
      onKeyDown={handleKeyDown}
    >
      {/* Top strip */}
      <TopStrip
        breadcrumbs={breadcrumbs.map((c) => ({ id: c.id, title: c.title, kind: c.kind }))}
        currentTitle={title}
      />

      <div style={{ maxWidth: contentMaxWidth, margin: contentMaxWidth ? '0 auto' : undefined, padding: contentPadding || '0 28px' }}>
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
        showTags={false}
      />
      </div>

      {/* Editor canvas */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 0 40px' }}>
        <div
          style={{
            maxWidth: contentMaxWidth,
            margin: contentMaxWidth ? '0 auto' : undefined,
            padding: contentPadding || '0 28px',
          }}
        >
            <Editor
              content={content}
              onUpdate={(document) => {
                setContent(document)
                latestContentRef.current = document
                scheduleSave(document)
              }}
              onCreateSubPage={handleCreateSubPage}
              onCreateDatabase={handleCreateDatabase}
              onStatusChange={(_, words) => setWordCount(words)}
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
