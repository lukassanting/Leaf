'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { leavesApi, databasesApi } from '@/lib/api'
import {
  getCachedLeaf, setCachedLeaf, getCachedTree,
  enqueuePendingSave, clearPendingSave, getPendingSaves, isOnline,
} from '@/lib/leafCache'
import { LeafIcon } from '@/components/Icons'

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

// ─── Tag chip input ───────────────────────────────────────────────────────────

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const addTag = (raw: string) => {
    const t = raw.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'var(--color-tag-bg)', border: '1px solid var(--color-tag-border)', color: 'var(--color-tag-text)' }}
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="leading-none transition-opacity opacity-60 hover:opacity-100"
          >×</button>
        </span>
      ))}
      <input
        className="text-xs bg-transparent border-none outline-none w-24"
        style={{ color: 'var(--color-text-muted)', caretColor: 'var(--color-primary)' }}
        placeholder={tags.length ? '' : 'Add tag…'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(draft) }
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => draft.trim() && addTag(draft)}
      />
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function EditorPage() {
  const params = useParams()
  const leafId = params?.id as string

  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [childrenIds, setChildrenIds] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle')
  const [tags, setTags] = useState<string[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; title: string }[]>([])
  const [editorMode, setEditorMode] = useState<'rich' | 'markdown'>('rich')
  const [wordCount, setWordCount] = useState(0)
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestContentRef = useRef('')
  const savedTitleRef = useRef('')

  // ─── Load ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const run = async () => {
      const cached = await getCachedLeaf(leafId)
      if (cached) {
        setTitle(cached.title); savedTitleRef.current = cached.title
        setParentId(cached.parent_id ?? null)
        setChildrenIds(cached.children_ids ?? [])
        setUpdatedAt(cached.updated_at ?? null)
        setContent(cached.content || '')
        setTags(cached.tags ?? [])
        latestContentRef.current = cached.content || ''
        setLoading(false)
      }
      try {
        const leaf = await leavesApi.get(leafId)
        setTitle(leaf.title); savedTitleRef.current = leaf.title
        setParentId(leaf.parent_id ?? null)
        setChildrenIds(leaf.children_ids ?? [])
        setUpdatedAt(leaf.updated_at)
        setCreatedAt(leaf.created_at ?? null)
        setContent(leaf.content || '')
        setTags(leaf.tags ?? [])
        latestContentRef.current = leaf.content || ''
        await setCachedLeaf({
          id: leaf.id, title: leaf.title, content: leaf.content || '',
          updated_at: leaf.updated_at, parent_id: leaf.parent_id ?? null,
          children_ids: leaf.children_ids ?? [],
        })
      } catch {
        if (!cached) setTitle('Error loading page')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [leafId])

  // ─── Breadcrumbs ─────────────────────────────────────────────────────────

  useEffect(() => {
    const build = async () => {
      const tree = await getCachedTree()
      if (!tree) return
      const byId = new Map(tree.map((n) => [n.id, n]))
      const chain: { id: string; title: string }[] = []
      let cur = byId.get(leafId)
      while (cur?.parent_id) {
        const parent = byId.get(cur.parent_id)
        if (!parent) break
        chain.unshift({ id: parent.id, title: parent.title })
        cur = parent
      }
      setBreadcrumbs(chain)
    }
    build()
  }, [leafId])

  // ─── Offline flush ───────────────────────────────────────────────────────

  const flushPending = useCallback(async () => {
    const pending = await getPendingSaves()
    for (const p of pending) {
      try {
        await leavesApi.patchContent(p.leafId, {
          content: p.content,
          ...(p.updated_at ? { updated_at: p.updated_at } : {}),
        })
        await clearPendingSave(p.leafId)
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (isOnline()) flushPending()
    window.addEventListener('online', flushPending)
    return () => window.removeEventListener('online', flushPending)
  }, [flushPending])

  // ─── Content save ────────────────────────────────────────────────────────

  const doSave = useCallback(async (payload: string) => {
    if (!isOnline()) {
      await enqueuePendingSave(leafId, payload, updatedAt)
      await setCachedLeaf({ id: leafId, title, content: payload, updated_at: new Date().toISOString(), parent_id: parentId, children_ids: childrenIds })
      setSaveStatus('offline')
      setTimeout(() => setSaveStatus((s) => s === 'offline' ? 'idle' : s), 2000)
      return
    }
    try {
      const leaf = await leavesApi.patchContent(leafId, { content: payload, ...(updatedAt ? { updated_at: updatedAt } : {}) })
      setUpdatedAt(leaf.updated_at)
      await setCachedLeaf({ id: leafId, title, content: payload, updated_at: leaf.updated_at, parent_id: parentId, children_ids: childrenIds })
      await clearPendingSave(leafId)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 1500)
    } catch {
      await enqueuePendingSave(leafId, payload, updatedAt)
      setSaveStatus('error')
    }
  }, [leafId, title, parentId, childrenIds, updatedAt])

  const scheduleSave = useCallback((newContent: string) => {
    latestContentRef.current = newContent
    setSaveStatus('saving')
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => doSave(latestContentRef.current), 800)
  }, [doSave])

  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    doSave(latestContentRef.current)
  }, [doSave])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  // ─── Title save ──────────────────────────────────────────────────────────

  const handleTitleSave = useCallback(async (newTitle: string) => {
    const trimmed = newTitle.trim() || 'Untitled'
    if (trimmed === savedTitleRef.current) return
    setTitle(trimmed); savedTitleRef.current = trimmed
    try {
      const updated = await leavesApi.update(leafId, { title: trimmed, parent_id: parentId ?? undefined, children_ids: childrenIds, tags })
      setUpdatedAt(updated.updated_at)
      await setCachedLeaf({ id: leafId, title: trimmed, content, updated_at: updated.updated_at, parent_id: parentId, children_ids: childrenIds })
      window.dispatchEvent(new CustomEvent('leaf-title-changed', { detail: { id: leafId, title: trimmed } }))
    } catch { console.error('Failed to save title') }
  }, [leafId, parentId, childrenIds, content, updatedAt, tags])

  const handleTagsSave = useCallback(async (newTags: string[]) => {
    setTags(newTags)
    try {
      await leavesApi.update(leafId, { title, parent_id: parentId ?? undefined, children_ids: childrenIds, tags: newTags })
    } catch { console.error('Failed to save tags') }
  }, [leafId, title, parentId, childrenIds])

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const isMac = /Mac/i.test(navigator.userAgent)
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 's') { e.preventDefault(); saveNow() }
  }

  // ─── Sub-page / database creation ────────────────────────────────────────

  const handleCreateSubPage = useCallback((insertCard: (id: string, title: string) => void) => {
    leavesApi.create({ title: 'Untitled', parent_id: leafId })
      .then((leaf) => { insertCard(leaf.id, leaf.title); window.dispatchEvent(new Event('leaf-tree-changed')) })
      .catch((e) => console.error('Failed to create sub-page', e))
  }, [leafId])

  const handleCreateDatabase = useCallback((insertCard: (id: string, title: string) => void) => {
    databasesApi.create({ title: 'Untitled database', parent_leaf_id: leafId })
      .then((db) => { insertCard(db.id, db.title); window.dispatchEvent(new Event('leaf-tree-changed')) })
      .catch((e) => console.error('Failed to create database', e))
  }, [leafId])

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved'  ? 'Synced' :
    saveStatus === 'error'  ? 'Error' :
    saveStatus === 'offline'? 'Saved locally' : 'Synced'

  const saveDotColor =
    saveStatus === 'error'   ? '#dc2626' :
    saveStatus === 'saving'  ? 'var(--color-text-muted)' :
    saveStatus === 'offline' ? '#d97706' : 'var(--color-primary)'

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--background)' }}
      onKeyDown={handleKeyDown}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-10 h-10 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-xs overflow-hidden" style={{ color: 'var(--color-text-muted)' }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 min-w-0">
              {i > 0 && <span className="mx-0.5 opacity-40">/</span>}
              <Link
                href={`/editor/${crumb.id}`}
                className="truncate max-w-[120px] transition-colors duration-150 hover:text-leaf-700"
              >
                {crumb.title}
              </Link>
            </span>
          ))}
          {breadcrumbs.length > 0 && <span className="opacity-40 mx-0.5">/</span>}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={saveNow}
            className="text-xs transition-colors duration-150"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            Export
          </button>
        </div>
      </div>

      {/* ── Editor area ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-10 pt-10 pb-4">

          {/* Title row */}
          <div className="flex items-start gap-3 mb-3">
            <span className="mt-1.5 shrink-0" style={{ color: 'var(--color-primary)' }}>
              <LeafIcon size={22} />
            </span>
            <input
              className="flex-1 bg-transparent border-none outline-none font-medium leading-tight"
              style={{ fontSize: 29, color: 'var(--color-text-dark)', caretColor: 'var(--color-primary)' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => handleTitleSave(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
              placeholder="Untitled"
            />
          </div>

          {/* Properties row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>Created {fmtDate(createdAt)}</span>
            <span className="opacity-30">·</span>
            <TagsInput tags={tags} onChange={handleTagsSave} />
          </div>

          {/* Divider */}
          <div className="mb-6" style={{ height: 1, backgroundColor: 'var(--color-border)' }} />

          {/* Editor */}
          <Editor
            content={content}
            onUpdate={(html) => { setContent(html); scheduleSave(html) }}
            onCreateSubPage={handleCreateSubPage}
            onCreateDatabase={handleCreateDatabase}
            onStatusChange={(m, w) => { setEditorMode(m); setWordCount(w) }}
          />
        </div>
      </div>

      {/* ── Status bar ── */}
      <div
        className="flex items-center justify-between px-10 shrink-0"
        style={{
          height: 32,
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-sidebar-bg)',
        }}
      >
        {/* Left: sync dot + word count */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: saveDotColor }}
          />
          <span>{saveLabel}</span>
          {wordCount > 0 && (
            <>
              <span className="opacity-30">·</span>
              <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            </>
          )}
        </div>

        {/* Right: mode toggle */}
        <div
          className="flex items-center rounded text-xs overflow-hidden"
          style={{ border: '1px solid var(--color-border)' }}
        >
          {(['rich', 'markdown'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setEditorMode(m)}
              className="px-2.5 py-0.5 capitalize transition-colors duration-150"
              style={{
                background: editorMode === m ? 'var(--color-primary)' : 'transparent',
                color: editorMode === m ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
