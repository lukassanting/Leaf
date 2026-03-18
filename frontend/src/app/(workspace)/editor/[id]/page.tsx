'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { LoadingShell } from '@/components/LoadingShell'
import { TopStrip } from '@/components/TopStrip'
import { StatusBar } from '@/components/StatusBar'
import { TagsInput } from '@/components/editor/TagsInput'
import { createDatabaseAndEmit } from '@/lib/databaseMutations'
import { createLeafAndPrimeCache, renameLeafAndPrimeCache, updateLeafAndPrimeCache } from '@/lib/leafMutations'
import { useLeafAutosave } from '@/hooks/useLeafAutosave'
import { useLeafBreadcrumbs } from '@/hooks/useLeafBreadcrumbs'
import { useLeafPageData } from '@/hooks/useLeafPageData'
import { warmDatabaseRoute } from '@/lib/warmEditorRoute'
import { useContentWidth } from '@/app/(workspace)/layout'
import { LeafIcon } from '@/components/Icons'
import type { EditorActions } from '@/components/Editor'

const Editor = dynamic(() => import(/* webpackPrefetch: true */ '@/components/Editor'), { ssr: false })

export default function EditorPage() {
  const params = useParams()
  const leafId = params?.id as string

  const [editorMode, setEditorMode] = useState<'rich' | 'markdown'>('rich')
  const [wordCount, setWordCount] = useState(0)
  const editorActionsRef = useRef<EditorActions | null>(null)
  const { contentWidth } = useContentWidth()

  const {
    content,
    setContent,
    title,
    setTitle,
    description,
    parentId,
    databaseId,
    childrenIds,
    updatedAt,
    setUpdatedAt,
    tags,
    setTags,
    icon,
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

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    const isMac = /Mac/i.test(navigator.userAgent)
    if ((isMac ? event.metaKey : event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      saveNow()
    }
  }

  const handleCreateSubPage = useCallback((insertCard: (id: string, title: string) => void) => {
    createLeafAndPrimeCache({ title: 'Untitled', parent_id: leafId }, { parent_id: leafId, kind: 'page' })
      .then((leaf) => {
        insertCard(leaf.id, leaf.title)
      })
      .catch((error) => console.error('[leaf:create] sub-page failed', error))
  }, [leafId])

  const handleCreateDatabase = useCallback((insertCard: (id: string, title: string) => void) => {
    void warmDatabaseRoute()
    createDatabaseAndEmit({ title: 'Untitled database', parent_leaf_id: leafId })
      .then((database) => {
        insertCard(database.id, database.title)
      })
      .catch((error) => console.error('[leaf:create] database failed', error))
  }, [leafId])

  // Content width styles
  const contentMaxWidth = contentWidth === 'normal' ? 680 : contentWidth === 'wide' ? 960 : undefined
  const contentPadding = contentWidth === 'full' ? '0 24px' : undefined

  if (loadingLeaf && !hasLoadedRef.current) {
    return <LoadingShell label="Loading page…" />
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--leaf-bg-editor)' }}
      onKeyDown={handleKeyDown}
    >
      {/* Top strip */}
      <TopStrip
        breadcrumbs={breadcrumbs.map((c) => ({ id: c.id, title: c.title, kind: c.kind }))}
        currentTitle={title}
      />

      {/* Page header — centered */}
      <div
        style={{
          padding: '36px 0 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          borderBottom: '0.5px solid var(--leaf-border-soft)',
        }}
      >
        {/* Icon */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12, cursor: 'pointer' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: 'var(--leaf-bg-tag)',
              border: '0.5px solid var(--leaf-border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon?.type === 'emoji' ? (
              <span style={{ fontSize: 28 }}>{icon.value}</span>
            ) : (
              <LeafIcon size={26} />
            )}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 16,
              height: 16,
              background: 'var(--leaf-green)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--leaf-bg-editor)',
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 1V7M1 4H7" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Title */}
        <input
          className="bg-transparent border-none outline-none font-medium leading-tight"
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: 'var(--leaf-text-title)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            textAlign: 'center',
            width: '100%',
            maxWidth: 680,
            caretColor: 'var(--leaf-green)',
          }}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={(event) => { void handleTitleSave(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              ;(event.target as HTMLInputElement).blur()
            }
          }}
          placeholder=""
        />

        {/* Description */}
        <div
          style={{
            fontSize: 13.5,
            color: 'var(--leaf-text-muted)',
            marginTop: 6,
            maxWidth: 480,
            lineHeight: 1.6,
            minHeight: '1.6em',
          }}
        >
          {description || (
            <span style={{ color: 'var(--leaf-text-hint)' }}>Add a description…</span>
          )}
        </div>

        {/* Tags */}
        <div style={{ marginTop: 10 }}>
          <TagsInput tags={tags} onChange={handleTagsSave} />
        </div>
      </div>

      {/* Editor canvas */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '28px 0' }}>
        <div
          style={{
            maxWidth: contentMaxWidth,
            margin: contentMaxWidth ? '0 auto' : undefined,
            padding: contentPadding || '0 24px',
          }}
        >
          <Editor
            content={content}
            onUpdate={(html) => {
              setContent(html)
              latestContentRef.current = html
              scheduleSave(html)
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
