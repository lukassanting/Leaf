'use client'

import { useEffect, useRef, useState } from 'react'
import { leavesApi } from '@/lib/api'
import { toCachedLeaf } from '@/lib/cacheMappers'
import { getCachedLeaf, setCachedLeaf } from '@/lib/leafCache'
import type { LeafIcon } from '@/lib/api'

export function useLeafPageData(leafId: string) {
  const [content, setContent] = useState('')
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
  const [loadingLeaf, setLoadingLeaf] = useState(true)

  const latestContentRef = useRef('')
  const savedTitleRef = useRef('')
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const cached = await getCachedLeaf(leafId)
      if (cached && !cancelled) {
        setTitle(cached.title)
        savedTitleRef.current = cached.title
        setParentId(cached.parent_id ?? null)
        setDatabaseId(cached.database_id ?? null)
        setChildrenIds(cached.children_ids ?? [])
        setUpdatedAt(cached.updated_at ?? null)
        setContent(cached.content || '')
        setTags(cached.tags ?? [])
        latestContentRef.current = cached.content || ''
        hasLoadedRef.current = true
      }

      try {
        const leaf = await leavesApi.get(leafId)
        if (cancelled) return
        setTitle(leaf.title)
        savedTitleRef.current = leaf.title
        setDescription(leaf.description || '')
        setParentId(leaf.parent_id ?? null)
        setDatabaseId(leaf.database_id ?? null)
        setChildrenIds(leaf.children_ids ?? [])
        setUpdatedAt(leaf.updated_at)
        setCreatedAt(leaf.created_at ?? null)
        setContent(leaf.content || '')
        setTags(leaf.tags ?? [])
        setIcon(leaf.icon ?? null)
        setProperties(leaf.properties ?? null)
        latestContentRef.current = leaf.content || ''
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
    loadingLeaf,
    latestContentRef,
    savedTitleRef,
    hasLoadedRef,
  }
}
