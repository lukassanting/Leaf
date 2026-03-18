'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { LoadingShell } from '@/components/LoadingShell'
import { TagsInput } from '@/components/editor/TagsInput'
import { createDatabaseAndEmit } from '@/lib/databaseMutations'
import { createLeafAndPrimeCache, renameLeafAndPrimeCache, updateLeafAndPrimeCache } from '@/lib/leafMutations'
import { useLeafAutosave } from '@/hooks/useLeafAutosave'
import { useLeafBreadcrumbs } from '@/hooks/useLeafBreadcrumbs'
import { useLeafPageData } from '@/hooks/useLeafPageData'
import { warmDatabaseRoute, warmEditorRoute } from '@/lib/warmEditorRoute'
import { LeafIcon } from '@/components/Icons'
import type { EditorActions } from '@/components/Editor'

const Editor = dynamic(() => import(/* webpackPrefetch: true */ '@/components/Editor'), { ssr: false })

export default function EditorPage() {
  const params = useParams()
  const { startNavigation } = useNavigationProgress()
  const leafId = params?.id as string

  const [editorMode, setEditorMode] = useState<'rich' | 'markdown'>('rich')
  const [wordCount, setWordCount] = useState(0)
  const editorActionsRef = useRef<EditorActions | null>(null)

  const {
    content,
    setContent,
    title,
    setTitle,
    parentId,
    databaseId,
    childrenIds,
    updatedAt,
    setUpdatedAt,
    tags,
    setTags,
    createdAt,
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

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Synced' :
    saveStatus === 'error' ? 'Error' :
    saveStatus === 'offline' ? 'Saved locally' : 'Synced'

  const saveDotColor =
    saveStatus === 'error' ? '#dc2626' :
    saveStatus === 'saving' ? 'var(--color-text-muted)' :
    saveStatus === 'offline' ? '#d97706' : 'var(--color-primary)'

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loadingLeaf && !hasLoadedRef.current) {
    return <LoadingShell label="Loading page…" />
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--background)' }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="flex items-center justify-between px-10 h-10 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <nav className="flex items-center gap-1 text-xs overflow-hidden" style={{ color: 'var(--color-text-muted)' }}>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1 min-w-0">
              {index > 0 && <span className="mx-0.5 opacity-40">/</span>}
              <Link
                href={crumb.kind === 'database' ? `/databases/${crumb.id}` : `/editor/${crumb.id}`}
                className="truncate max-w-[120px] transition-colors duration-150 hover:text-leaf-700"
                onClick={() => startNavigation()}
                onMouseEnter={() => {
                  if (crumb.kind === 'database') {
                    void warmDatabaseRoute()
                    return
                  }
                  void warmEditorRoute()
                }}
              >
                {crumb.title}
              </Link>
            </span>
          ))}
          {breadcrumbs.length > 0 && <span className="opacity-40 mx-0.5">/</span>}
          <span className="truncate max-w-[180px] text-xs font-medium" style={{ color: 'var(--color-text-dark)' }}>
            {title || 'Untitled'}
          </span>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => editorActionsRef.current?.exportMd()}
            className="text-xs transition-colors duration-150"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(event) => (event.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(event) => (event.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-10 pt-10 pb-4">
          <div className="flex items-start gap-3 mb-3">
            <span className="mt-1.5 shrink-0" style={{ color: 'var(--color-primary)' }}>
              <LeafIcon size={22} />
            </span>
            <input
              className="flex-1 bg-transparent border-none outline-none font-medium leading-tight"
              style={{ fontSize: 29, color: 'var(--color-text-dark)', caretColor: 'var(--color-primary)' }}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={(event) => { void handleTitleSave(event.target.value) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  ;(event.target as HTMLInputElement).blur()
                }
              }}
              placeholder="Untitled"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>Created {fmtDate(createdAt)}</span>
            <span className="opacity-30">·</span>
            <TagsInput tags={tags} onChange={handleTagsSave} />
          </div>

          <div className="mb-6" style={{ height: 1, backgroundColor: 'var(--color-border)' }} />

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

      <div
        className="flex items-center justify-between px-10 shrink-0"
        style={{
          height: 32,
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-sidebar-bg)',
        }}
      >
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: saveDotColor }} />
          <span>{saveLabel}</span>
          {wordCount > 0 && (
            <>
              <span className="opacity-30">·</span>
              <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            </>
          )}
        </div>

        <div className="flex items-center rounded text-xs overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {(['rich', 'markdown'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => editorActionsRef.current ? editorActionsRef.current.setMode(mode) : setEditorMode(mode)}
              className="px-2.5 py-0.5 capitalize transition-colors duration-150"
              style={{
                background: editorMode === mode ? 'var(--color-primary)' : 'transparent',
                color: editorMode === mode ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
