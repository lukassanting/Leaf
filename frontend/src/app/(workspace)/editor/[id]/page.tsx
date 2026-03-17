'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { leavesApi, databasesApi } from '@/lib/api'
import {
  getCachedLeaf,
  setCachedLeaf,
  enqueuePendingSave,
  clearPendingSave,
  getPendingSaves,
  isOnline,
} from '@/lib/leafCache'

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const addTag = (raw: string) => {
    const t = raw.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3 min-h-[1.75rem]">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-leaf-100 text-leaf-700">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-leaf-400 hover:text-leaf-700 leading-none">×</button>
        </span>
      ))}
      <input
        className="text-xs text-leaf-500 bg-transparent border-none outline-none placeholder:text-leaf-300 w-24"
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

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const leafId = params?.id as string

  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [childrenIds, setChildrenIds] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle')
  const [tags, setTags] = useState<string[]>([])

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestContentRef = useRef('')
  const savedTitleRef = useRef('')

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const run = async () => {
      const cached = await getCachedLeaf(leafId)
      if (cached) {
        setTitle(cached.title)
        savedTitleRef.current = cached.title
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
        setTitle(leaf.title)
        savedTitleRef.current = leaf.title
        setParentId(leaf.parent_id ?? null)
        setChildrenIds(leaf.children_ids ?? [])
        setUpdatedAt(leaf.updated_at)
        setContent(leaf.content || '')
        setTags(leaf.tags ?? [])
        latestContentRef.current = leaf.content || ''
        await setCachedLeaf({
          id: leaf.id,
          title: leaf.title,
          content: leaf.content || '',
          updated_at: leaf.updated_at,
          parent_id: leaf.parent_id ?? null,
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

  // ─── Flush pending saves on mount / reconnect ──────────────────────────────

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

  // ─── Save content ──────────────────────────────────────────────────────────

  const doSave = useCallback(
    async (payload: string) => {
      if (!isOnline()) {
        await enqueuePendingSave(leafId, payload, updatedAt)
        await setCachedLeaf({
          id: leafId, title, content: payload,
          updated_at: new Date().toISOString(),
          parent_id: parentId, children_ids: childrenIds,
        })
        setSaveStatus('offline')
        setTimeout(() => setSaveStatus((s) => (s === 'offline' ? 'idle' : s)), 2000)
        return
      }
      try {
        const leaf = await leavesApi.patchContent(leafId, {
          content: payload,
          ...(updatedAt ? { updated_at: updatedAt } : {}),
        })
        setUpdatedAt(leaf.updated_at)
        await setCachedLeaf({
          id: leafId, title, content: payload,
          updated_at: leaf.updated_at,
          parent_id: parentId, children_ids: childrenIds,
        })
        await clearPendingSave(leafId)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
      } catch {
        await enqueuePendingSave(leafId, payload, updatedAt)
        setSaveStatus('error')
      }
    },
    [leafId, title, parentId, childrenIds, updatedAt]
  )

  const scheduleSave = useCallback(
    (newContent: string) => {
      latestContentRef.current = newContent
      setSaveStatus('saving')
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => doSave(latestContentRef.current), 800)
    },
    [doSave]
  )

  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    doSave(latestContentRef.current)
  }, [doSave])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  // ─── Title save ────────────────────────────────────────────────────────────

  const handleTitleSave = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim() || 'Untitled'
      if (trimmed === savedTitleRef.current) return
      setTitle(trimmed)
      savedTitleRef.current = trimmed
      try {
        const updated = await leavesApi.update(leafId, {
          title: trimmed,
          parent_id: parentId ?? undefined,
          children_ids: childrenIds,
          tags,
        })
        setUpdatedAt(updated.updated_at)
        await setCachedLeaf({
          id: leafId, title: trimmed, content,
          updated_at: updated.updated_at,
          parent_id: parentId, children_ids: childrenIds,
        })
        window.dispatchEvent(new CustomEvent('leaf-title-changed', { detail: { id: leafId, title: trimmed } }))
      } catch {
        console.error('Failed to save title')
      }
    },
    [leafId, parentId, childrenIds, content, updatedAt, tags]
  )

  const handleTagsSave = useCallback(async (newTags: string[]) => {
    setTags(newTags)
    try {
      await leavesApi.update(leafId, {
        title,
        parent_id: parentId ?? undefined,
        children_ids: childrenIds,
        tags: newTags,
      })
    } catch { console.error('Failed to save tags') }
  }, [leafId, title, parentId, childrenIds])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const isMac = /Mac/i.test(navigator.userAgent)
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      saveNow()
    }
  }

  // ─── Create sub-page ───────────────────────────────────────────────────────

  const createChild = useCallback(async () => {
    try {
      const leaf = await leavesApi.create({ title: 'Untitled', parent_id: leafId })
      router.push(`/editor/${leaf.id}`)
    } catch {
      console.error('Failed to create sub-page')
    }
  }, [leafId, router])

  // ─── Create database from within this page ─────────────────────────────────

  const createDatabase = useCallback(async () => {
    try {
      const db = await databasesApi.create({ title: 'Untitled database' })
      window.dispatchEvent(new Event('leaf-database-created'))
      router.push(`/databases/${db.id}`)
    } catch {
      console.error('Failed to create database')
    }
  }, [router])

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-leaf-400 text-sm">Loading…</div>

  return (
    <div className="min-h-screen" onKeyDown={handleKeyDown}>
      <div className="max-w-3xl mx-auto px-12 py-12">
          <input
            className="w-full text-4xl font-bold text-leaf-900 bg-transparent border-none outline-none placeholder:text-leaf-200 mb-1 leading-tight"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => handleTitleSave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
            }}
            placeholder="Untitled"
          />

          <TagsInput tags={tags} onChange={handleTagsSave} />

          <div className="flex items-center justify-between mb-8 h-5">
            <span className="text-xs text-leaf-300">
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Error saving'}
              {saveStatus === 'offline' && 'Saved locally'}
            </span>
            <div className="flex items-center gap-3">
              <button onClick={createChild} className="text-xs text-leaf-300 hover:text-leaf-500 transition">
                + Sub-page
              </button>
              <button onClick={createDatabase} className="text-xs text-leaf-300 hover:text-leaf-500 transition">
                ⊞ New database
              </button>
            </div>
          </div>

          <Editor
            content={content}
            onUpdate={(html) => { setContent(html); scheduleSave(html) }}
          />
        </div>
    </div>
  )
}
