/**
 * Leaf hook: leaf page data/loading (`frontend/src/hooks/useLeafPageData.ts`).
 *
 * Purpose:
 * - Loads a leaf (page/project) into editor state:
 *   - content parsed into `LeafDocument`
 *   - title/description/parent/database/link structure
 *   - tags/icon/properties metadata
 * - Starts with cached data for responsiveness, then revalidates from the API.
 *
 * How to read:
 * - The main `useEffect`:
 *   1) `getCachedLeaf(leafId)` (if present)
 *   2) `leavesApi.get(leafId)` from the backend
 *   3) updates local state and calls `setCachedLeaf(...)`
 * - `parseLeafContent` converts API content into the editor document schema.
 *
 * Update:
 * - If editor content schema changes, update `parseLeafContent` / `leafDocument.ts`.
 * - If new leaf metadata is added, add it to state and ensure it’s included in cache mapping.
 *
 * Debug:
 * - If you see “Loading…” forever, check `leafId` and ensure the API call completes.
 * - If editor renders wrong content, check `parseLeafContent` and cache contents.
 */


'use client'

import { useEffect, useRef, useState } from 'react'
import { leavesApi } from '@/lib/api'
import { toCachedLeaf } from '@/lib/cacheMappers'
import { getCachedLeaf, setCachedLeaf } from '@/lib/leafCache'
import type { LeafDocument, LeafIcon } from '@/lib/api'
import { createEmptyLeafDocument, parseLeafContent } from '@/lib/leafDocument'

export function useLeafPageData(leafId: string) {
  const [content, setContent] = useState<LeafDocument>(createEmptyLeafDocument)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [databaseId, setDatabaseId] = useState<string | null>(null)
  const [childrenIds, setChildrenIds] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [icon, setIcon] = useState<LeafIcon | null>(null)
  const [properties, setProperties] = useState<Record<string, string> | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [contentTextLength, setContentTextLength] = useState(0)
  const [loadingLeaf, setLoadingLeaf] = useState(true)

  const latestContentRef = useRef<LeafDocument>(createEmptyLeafDocument())
  const savedTitleRef = useRef('')
  const savedDescriptionRef = useRef('')
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const cached = await getCachedLeaf(leafId)
      if (cached && !cancelled) {
        setTitle(cached.title)
        savedTitleRef.current = cached.title
        setDescription(cached.description || '')
        savedDescriptionRef.current = cached.description || ''
        setParentId(cached.parent_id ?? null)
        setDatabaseId(cached.database_id ?? null)
        setChildrenIds(cached.children_ids ?? [])
        setUpdatedAt(cached.updated_at ?? null)
        setContentTextLength(cached.content_text_length ?? 0)
        const cachedContent = parseLeafContent(cached.content)
        setContent(cachedContent)
        setTags(cached.tags ?? [])
        latestContentRef.current = cachedContent
        hasLoadedRef.current = true
      }

      try {
        const leaf = await leavesApi.get(leafId)
        if (cancelled) return
        setTitle(leaf.title)
        savedTitleRef.current = leaf.title
        setDescription(leaf.description || '')
        savedDescriptionRef.current = leaf.description || ''
        setParentId(leaf.parent_id ?? null)
        setDatabaseId(leaf.database_id ?? null)
        setChildrenIds(leaf.children_ids ?? [])
        setUpdatedAt(leaf.updated_at)
        setCreatedAt(leaf.created_at ?? null)
        setContentTextLength(leaf.content_text_length ?? 0)
        const parsedContent = parseLeafContent(leaf.content)
        setContent(parsedContent)
        setTags(leaf.tags ?? [])
        setIcon(leaf.icon ?? null)
        setProperties(leaf.properties ?? null)
        latestContentRef.current = parsedContent
        hasLoadedRef.current = true
        await setCachedLeaf(toCachedLeaf(leaf))
      } catch (error) {
        console.error('[leaf:load] API error', error)
        if (!cached && !cancelled) setTitle('Error loading page')
      } finally {
        if (!cancelled) setLoadingLeaf(false)
      }
    }

    void run()
    return () => { cancelled = true }
  }, [leafId])

  return {
    content,
    setContent,
    title,
    setTitle,
    description,
    setDescription,
    parentId,
    setParentId,
    databaseId,
    setDatabaseId,
    childrenIds,
    setChildrenIds,
    updatedAt,
    setUpdatedAt,
    tags,
    setTags,
    icon,
    setIcon,
    properties,
    setProperties,
    createdAt,
    contentTextLength,
    loadingLeaf,
    latestContentRef,
    savedTitleRef,
    savedDescriptionRef,
    hasLoadedRef,
  }
}
