/**
 * Leaf hook: sidebar tree state/model (`frontend/src/hooks/useSidebarTreeModel.ts`).
 *
 * Purpose:
 * - Owns the sidebar navigation tree data and UI interactions:
 *   - fetching/merging leaves + databases into a single tree
 *   - offline-first initial render via cached tree
 *   - expansion/collapse state persisted to localStorage
 *   - rename, delete, drag-and-drop reorder, and “create child” flows
 *   - search-driven filtering (via helpers in `sidebarTreeUtils`)
 *
 * How to read:
 * - `fetchTree()` loads cache first, then revalidates from `leavesApi.getTree()` and `databasesApi.list()`.
 * - `useEffect` blocks register cross-component event listeners from `appEvents.ts`.
 * - The bottom section returns a large object of handlers and derived values used by `SidebarTree`.
 *
 * Update:
 * - If sidebar tree node shape changes, update:
 *   - `SidebarNode` typing in `sidebarTreeUtils.ts`
 *   - the merge/mapping logic (`mapLeafNodes`, `mapDbNodes`)
 * - If you adjust drag/drop semantics, update `onDragOver`/`onDrop` and `handleReorder`.
 *
 * Debug:
 * - If navigation/search doesn’t work, check `filteredFlat` derivation and expansion state.
 * - If reorder fails, inspect `leavesApi.reorderChildren` and the optimistic state update.
 * - If errors happen while fetching, see `networkError` set in `fetchTree()`.
 */


'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { databasesApi, leavesApi } from '@/lib/api'
import { emitLeafTreeChanged, onLeafCreated, onLeafDatabaseCreated, onLeafTitleChanged, onLeafTreeChanged } from '@/lib/appEvents'
import { createLeafAndPrimeCache, renameLeafAndPrimeCache } from '@/lib/leafMutations'
import { getCachedTree, setCachedTree } from '@/lib/leafCache'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { buildTree, defaultExpanded, flattenTreeWithSearch, mapDbNodes, mapLeafNodes, type SidebarNode } from '@/components/sidebarTreeUtils'

const EXPAND_KEY = 'leaf-sidebar-expanded'

function loadExpandState(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(EXPAND_KEY) ?? '{}') } catch { return {} }
}

function saveExpandState(state: Record<string, boolean>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(EXPAND_KEY, JSON.stringify(state))
}

export function useSidebarTreeModel(activeId?: string) {
  const router = useRouter()
  const { startNavigation, stopNavigation } = useNavigationProgress()
  const [nodes, setNodes] = useState<SidebarNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => loadExpandState())
  const [loading, setLoading] = useState(true)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [contextNode, setContextNode] = useState<{ id: string; kind: 'page' | 'database'; x: number; y: number } | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [creatingChildOf, setCreatingChildOf] = useState<string | null>(null)

  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    saveExpandState(expanded)
  }, [expanded])

  const fetchTree = useCallback(async () => {
    setNetworkError(null)
    const cached = await getCachedTree()
    let hadCached = false
    if (cached?.length) {
      hadCached = true
      const mapped = mapLeafNodes(
        cached.map((c) => ({
          ...c,
          tags: c.tags ?? [],
          path: c.path ?? '',
        })),
      )
      setNodes(mapped)
      setExpanded((prev) => Object.keys(prev).length > 0 ? prev : defaultExpanded(mapped))
      setLoading(false)
    }

    try {
      const [rawLeaves, rawDatabases] = await Promise.all([leavesApi.getTree(), databasesApi.list()])
      const leafNodes = mapLeafNodes(rawLeaves)
      const databaseNodes = mapDbNodes(rawDatabases)
      const merged = [...leafNodes, ...databaseNodes]
      setNodes(merged)
      await setCachedTree(leafNodes.map((node) => ({ ...node, type: 'page' as const })))
      setExpanded((prev) => Object.keys(prev).length === 0 ? defaultExpanded(merged) : prev)
    } catch (error) {
      console.error('Failed to load tree:', error)
      if (!hadCached) setNetworkError(`Can't reach API. Is the backend running? (make up)`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchTree() }, [fetchTree])

  useEffect(() => onLeafTreeChanged(() => { void fetchTree() }), [fetchTree])
  useEffect(() => onLeafDatabaseCreated(() => { void fetchTree() }), [fetchTree])

  useEffect(() => onLeafCreated((detail) => {
    const newNode: SidebarNode = {
      id: detail.id,
      title: detail.title || 'Untitled',
      kind: detail.kind,
      parent_id: detail.parent_id,
      children_ids: [],
      order: 0,
    }
    setNodes((prev) => {
      if (detail.parent_id) {
        return [
          ...prev.map((node) => node.id === detail.parent_id ? { ...node, children_ids: [...(node.children_ids || []), detail.id] } : node),
          newNode,
        ]
      }
      return [...prev, newNode]
    })
    if (detail.parent_id) setExpanded((prev) => ({ ...prev, [detail.parent_id!]: true }))
  }), [])

  useEffect(() => onLeafTitleChanged((detail) => {
    setNodes((prev) => prev.map((node) => (node.id === detail.id ? { ...node, title: detail.title } : node)))
  }), [])

  const tree = useMemo(() => buildTree(nodes), [nodes])
  const filteredFlat = useMemo(() => flattenTreeWithSearch(tree, expanded, search), [tree, expanded, search])

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  const collapseAll = () => setExpanded({})

  const handleRename = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle.trim()) { setRenameId(null); return }
    const node = nodes.find((item) => item.id === id)
    if (!node) { setRenameId(null); return }
    try {
      if (node.kind === 'page') {
        await renameLeafAndPrimeCache(id, {
          title: newTitle.trim(),
          parent_id: node.parent_id ?? undefined,
          children_ids: node.children_ids ?? [],
        })
      } else {
        await databasesApi.update(id, { title: newTitle.trim() })
      }
      setNodes((prev) => prev.map((item) => (item.id === id ? { ...item, title: newTitle.trim() } : item)))
    } catch {
      console.error('Rename failed')
    }
    setRenameId(null)
  }, [nodes])

  const handleDelete = useCallback(async (id: string, kind: 'page' | 'database') => {
    const label = kind === 'database' ? 'database and all its rows' : 'page and all its sub-pages and databases'
    if (!confirm(`Delete this ${label}?`)) return
    try {
      if (kind === 'page') {
        await leavesApi.delete(id)
        emitLeafTreeChanged()
        setNodes((prev) => prev.filter((node) => node.id !== id))
        if (activeId === id) router.push('/')
      } else {
        await databasesApi.delete(id)
        emitLeafTreeChanged()
        setNodes((prev) => prev.filter((node) => node.id !== id))
      }
    } catch {
      console.error('Delete failed')
    }
    setContextNode(null)
  }, [activeId, router])

  const handleCreateChild = useCallback(async (parentId: string) => {
    if (creatingChildOf) return
    setCreatingChildOf(parentId)
    try {
      startNavigation()
      void warmEditorRoute()
      const leaf = await createLeafAndPrimeCache({ title: 'Untitled', parent_id: parentId }, { parent_id: parentId, kind: 'page' })
      router.push(`/editor/${leaf.id}`)
    } catch {
      stopNavigation()
      console.error('Failed to create sub-page')
    } finally {
      setCreatingChildOf(null)
    }
  }, [creatingChildOf, router, startNavigation, stopNavigation])

  const handleReorder = useCallback(async (parentId: string, childIds: string[]) => {
    try {
      await leavesApi.reorderChildren(parentId, { child_ids: childIds })
      setNodes((prev) => prev.map((node) => (node.id === parentId ? { ...node, children_ids: childIds } : node)))
    } catch {
      console.error('Reorder failed')
    }
    setDraggedId(null)
    setDropTargetId(null)
  }, [])

  const onDragStart = (event: React.DragEvent, nodeId: string) => {
    setDraggedId(nodeId)
    event.dataTransfer.setData('text/plain', nodeId)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleMove = useCallback(async (leafId: string, newParentId: string | null) => {
    const draggedNode = nodes.find((n) => n.id === leafId)
    if (!draggedNode || draggedNode.kind !== 'page') return
    try {
      await leavesApi.update(leafId, {
        title: draggedNode.title,
        parent_id: newParentId,
      })
      emitLeafTreeChanged()
    } catch {
      console.error('Move failed')
    }
    setDraggedId(null)
    setDropTargetId(null)
  }, [nodes])

  const onDragOver = (event: React.DragEvent, node: { id: string; parent_id: string | null; kind: 'page' | 'database' }) => {
    event.preventDefault()
    if (draggedId && draggedId !== node.id && node.kind === 'page') {
      setDropTargetId(node.id)
    }
  }

  const onDrop = (event: React.DragEvent, targetNode: { id: string; parent_id: string | null; kind: 'page' | 'database' }) => {
    event.preventDefault()
    if (!draggedId || draggedId === targetNode.id || targetNode.kind !== 'page') {
      setDraggedId(null)
      setDropTargetId(null)
      return
    }

    const draggedNode = nodes.find((n) => n.id === draggedId)
    if (!draggedNode) {
      setDraggedId(null)
      setDropTargetId(null)
      return
    }

    // Same parent → reorder siblings
    if (draggedNode.parent_id && draggedNode.parent_id === targetNode.parent_id) {
      const parent = nodes.find((n) => n.id === draggedNode.parent_id)
      if (!parent) { setDraggedId(null); setDropTargetId(null); return }
      const childIds = [...(parent.children_ids || [])]
      const fromIdx = childIds.indexOf(draggedId)
      if (fromIdx === -1) { setDraggedId(null); setDropTargetId(null); return }
      childIds.splice(fromIdx, 1)
      childIds.splice(childIds.indexOf(targetNode.id) + 1, 0, draggedId)
      void handleReorder(draggedNode.parent_id, childIds)
      return
    }

    // Different parent → move into target as child
    void handleMove(draggedId, targetNode.id)
    setExpanded((prev) => ({ ...prev, [targetNode.id]: true }))
  }

  return {
    nodes,
    loading,
    networkError,
    search,
    setSearch,
    filteredFlat,
    expanded,
    toggle,
    collapseAll,
    contextNode,
    setContextNode,
    renameId,
    setRenameId,
    renameValue,
    setRenameValue,
    draggedId,
    dropTargetId,
    hoverNodeId,
    setHoverNodeId,
    creatingChildOf,
    handleRename,
    handleDelete,
    handleCreateChild,
    onDragStart,
    onDragOver,
    onDrop,
    setDropTargetId,
    startNavigation,
  }
}
