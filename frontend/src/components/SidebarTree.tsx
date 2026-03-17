// frontend/src/components/SidebarTree.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCachedTree, setCachedTree } from '@/lib/leafCache'
import { leavesApi, databasesApi } from '@/lib/api'
import type { LeafTreeItem, Database } from '@/lib/api'

const EXPAND_KEY = 'leaf-sidebar-expanded'

function loadExpandState(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(EXPAND_KEY) ?? '{}') } catch { return {} }
}

function saveExpandState(state: Record<string, boolean>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(EXPAND_KEY, JSON.stringify(state))
}

// ─── Unified node type ───────────────────────────────────────────────────────

type SidebarNode = {
  id: string
  title: string
  kind: 'page' | 'database'
  parent_id: string | null
  children_ids: string[]
  order: number
}

type TreeNode = SidebarNode & { children: TreeNode[] }

// ─── Component ───────────────────────────────────────────────────────────────

export function SidebarTree({ activeId }: { activeId?: string }) {
  const router = useRouter()
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
    // Show cached leaves first for instant render
    const cached = await getCachedTree()
    let hadCached = false
    if (cached?.length) {
      hadCached = true
      const mapped = mapLeafNodes(cached as unknown as LeafTreeItem[])
      setNodes(mapped)
      setExpanded((prev) => Object.keys(prev).length > 0 ? prev : defaultExpanded(mapped))
      setLoading(false)
    }

    try {
      const [rawLeaves, rawDbs] = await Promise.all([
        leavesApi.getTree(),
        databasesApi.list(),
      ])
      const leafNodes = mapLeafNodes(rawLeaves)
      const dbNodes = mapDbNodes(rawDbs)
      const merged = [...leafNodes, ...dbNodes]
      setNodes(merged)
      await setCachedTree(leafNodes.map((n) => ({ ...n, type: 'page' as const }))) // cache leaves only
      setExpanded((prev) => Object.keys(prev).length === 0 ? defaultExpanded(merged) : prev)
    } catch (error) {
      console.error('Failed to load tree:', error)
      if (!hadCached) setNetworkError(`Can't reach API. Is the backend running? (make up)`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTree() }, [fetchTree])

  // Refresh tree on creation/deletion events
  useEffect(() => {
    const handler = () => fetchTree()
    window.addEventListener('leaf-tree-changed', handler)
    window.addEventListener('leaf-database-created', handler)
    return () => {
      window.removeEventListener('leaf-tree-changed', handler)
      window.removeEventListener('leaf-database-created', handler)
    }
  }, [fetchTree])

  // Update title in-place when editor saves a page title
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)))
    }
    window.addEventListener('leaf-title-changed', handler)
    return () => window.removeEventListener('leaf-title-changed', handler)
  }, [])

  const tree = useMemo(() => buildTree(nodes), [nodes])

  const flattenWithDepth = useCallback(
    (node: TreeNode, depth: number, out: { node: TreeNode; depth: number }[] = []) => {
      const q = search.trim().toLowerCase()
      if (!q || node.title.toLowerCase().includes(q)) out.push({ node, depth })
      if (expanded[node.id] !== false) {
        node.children.forEach((c) => flattenWithDepth(c, depth + 1, out))
      }
      return out
    },
    [search, expanded]
  )

  const filteredFlat = useMemo(() => {
    if (!search.trim()) return tree.flatMap((n) => flattenWithDepth(n, 0))
    const q = search.trim().toLowerCase()
    const matchSet = new Set<string>()
    const nodeMap = new Map<string, TreeNode>()
    const index = (n: TreeNode) => { nodeMap.set(n.id, n); n.children.forEach(index) }
    tree.forEach(index)
    const markAncestors = (n: TreeNode) => {
      matchSet.add(n.id)
      if (n.parent_id && nodeMap.has(n.parent_id)) markAncestors(nodeMap.get(n.parent_id)!)
    }
    nodeMap.forEach((n) => { if (n.title.toLowerCase().includes(q)) markAncestors(n) })
    const out: { node: TreeNode; depth: number }[] = []
    const collect = (n: TreeNode, depth: number) => {
      if (!matchSet.has(n.id)) return
      out.push({ node: n, depth })
      n.children.forEach((c) => collect(c, depth + 1))
    }
    tree.forEach((n) => collect(n, 0))
    return out
  }, [tree, search, flattenWithDepth])

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  const collapseAll = () => setExpanded({})

  const handleRename = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) { setRenameId(null); return }
    const node = nodes.find((n) => n.id === id)
    if (!node) { setRenameId(null); return }
    try {
      if (node.kind === 'page') {
        await leavesApi.update(id, {
          title: newTitle.trim(),
          parent_id: node.parent_id ?? undefined,
          children_ids: node.children_ids ?? [],
        })
      } else {
        await databasesApi.update(id, { title: newTitle.trim() })
      }
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title: newTitle.trim() } : n)))
    } catch { console.error('Rename failed') }
    setRenameId(null)
  }

  const handleDelete = async (id: string, kind: 'page' | 'database') => {
    const label = kind === 'database' ? 'database and all its rows' : 'page and all its sub-pages and databases'
    if (!confirm(`Delete this ${label}?`)) return
    try {
      if (kind === 'page') {
        await leavesApi.delete(id)
        setNodes((prev) => prev.filter((n) => n.id !== id))
        if (activeId === id) router.push('/')
      } else {
        await databasesApi.delete(id)
        setNodes((prev) => prev.filter((n) => n.id !== id))
      }
    } catch { console.error('Delete failed') }
    setContextNode(null)
  }

  const handleCreateChild = async (parentId: string) => {
    if (creatingChildOf) return
    setCreatingChildOf(parentId)
    try {
      const leaf = await leavesApi.create({ title: 'Untitled', parent_id: parentId })
      setExpanded((prev) => ({ ...prev, [parentId]: true }))
      window.dispatchEvent(new Event('leaf-tree-changed'))
      router.push(`/editor/${leaf.id}`)
    } catch { console.error('Failed to create sub-page') }
    finally { setCreatingChildOf(null) }
  }

  // Only page nodes support drag-drop reorder (databases don't have children_ids)
  const handleReorder = async (parentId: string, childIds: string[]) => {
    try {
      await leavesApi.reorderChildren(parentId, { child_ids: childIds })
      setNodes((prev) => prev.map((n) => (n.id === parentId ? { ...n, children_ids: childIds } : n)))
    } catch { console.error('Reorder failed') }
    setDraggedId(null); setDropTargetId(null)
  }

  const onDragStart = (e: React.DragEvent, node: TreeNode) => {
    if (node.kind !== 'page') return
    setDraggedId(node.id)
    e.dataTransfer.setData('text/plain', node.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e: React.DragEvent, node: TreeNode) => {
    e.preventDefault()
    if (draggedId && draggedId !== node.id && node.parent_id && node.kind === 'page') {
      setDropTargetId(node.id)
    }
  }

  const onDrop = (e: React.DragEvent, targetNode: TreeNode) => {
    e.preventDefault()
    const parentId = targetNode.parent_id
    if (!parentId || !draggedId || draggedId === targetNode.id || targetNode.kind !== 'page') {
      setDraggedId(null); setDropTargetId(null); return
    }
    const parent = nodes.find((n) => n.id === parentId)
    if (!parent) { setDraggedId(null); setDropTargetId(null); return }
    const childIds = [...(parent.children_ids || [])]
    const fromIdx = childIds.indexOf(draggedId)
    const toIdx = childIds.indexOf(targetNode.id)
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDropTargetId(null); return }
    childIds.splice(fromIdx, 1)
    childIds.splice(childIds.indexOf(targetNode.id) + 1, 0, draggedId)
    handleReorder(parentId, childIds)
  }

  const renderNode = (item: { node: TreeNode; depth: number }) => {
    const { node, depth } = item
    const isActive = node.id === activeId
    const isExpanded = expanded[node.id] ?? false
    const hasChildren = node.children.length > 0
    const isEditing = renameId === node.id
    const isDropTarget = dropTargetId === node.id
    const isHovered = hoverNodeId === node.id
    const isDb = node.kind === 'database'
    const href = isDb ? `/databases/${node.id}` : `/editor/${node.id}`

    return (
      <div key={node.id}>
        <div
          className={[
            'flex items-center gap-1 pr-1 rounded text-sm group',
            isActive ? 'bg-leaf-100 text-leaf-900 font-semibold' : 'text-leaf-700 hover:bg-leaf-50',
            draggedId === node.id ? 'opacity-50' : '',
            isDropTarget ? 'ring-1 ring-leaf-400' : '',
          ].join(' ')}
          style={{ paddingLeft: 8 + depth * 12 }}
          draggable={!isDb}
          onMouseEnter={() => setHoverNodeId(node.id)}
          onMouseLeave={() => setHoverNodeId(null)}
          onDragStart={(e) => onDragStart(e, node)}
          onDragOver={(e) => onDragOver(e, node)}
          onDragLeave={() => setDropTargetId(null)}
          onDrop={(e) => onDrop(e, node)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextNode({ id: node.id, kind: node.kind, x: e.clientX, y: e.clientY })
          }}
        >
          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.id)}
            className="w-4 h-4 flex items-center justify-center text-xs text-leaf-400 shrink-0"
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </button>

          {/* Icon */}
          <span className="text-sm shrink-0 w-4 text-center leading-none">
            {isDb ? '🌳' : '🍃'}
          </span>

          {/* Title / rename */}
          {isEditing ? (
            <input
              autoFocus
              className="flex-1 min-w-0 bg-white border border-leaf-300 rounded px-1 py-0.5 text-sm"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRename(node.id, renameValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(node.id, renameValue)
                if (e.key === 'Escape') setRenameId(null)
              }}
            />
          ) : (
            <Link
              href={href}
              className="flex-1 truncate py-1"
              onClick={(e) => renameId && e.preventDefault()}
            >
              {node.title || 'Untitled'}
            </Link>
          )}

          {/* Inline + button (only for page nodes) */}
          {isHovered && !isEditing && !isDb && (
            <button
              type="button"
              title="Add sub-page"
              disabled={creatingChildOf === node.id}
              onClick={(e) => { e.stopPropagation(); handleCreateChild(node.id) }}
              className="w-5 h-5 flex items-center justify-center rounded text-leaf-400 hover:text-leaf-700 hover:bg-leaf-100 shrink-0 text-base leading-none"
            >
              +
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode({ node: child, depth: depth + 1 }))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="px-3 py-2 text-xs text-leaf-400">Loading…</div>

  if (networkError) {
    return (
      <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 rounded border border-amber-200">
        {networkError}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pb-1 space-y-1 shrink-0">
        <input
          type="search"
          placeholder="Search…"
          className="w-full rounded border border-leaf-100 px-2 py-1.5 text-xs placeholder:text-leaf-400 focus:outline-none focus:ring-1 focus:ring-leaf-300 bg-leaf-50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {Object.keys(expanded).length > 0 && (
          <button type="button" onClick={collapseAll} className="text-xs text-leaf-400 hover:text-leaf-600">
            Collapse all
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5 px-1">
        {filteredFlat.length === 0 ? (
          <div className="px-3 py-2 text-xs text-leaf-400">
            {search ? 'No matches.' : 'No pages yet.'}
          </div>
        ) : (
          filteredFlat.map((item) => renderNode(item))
        )}
      </div>

      {contextNode && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextNode(null)} aria-hidden />
          <div
            className="fixed z-50 min-w-[130px] rounded-lg border border-leaf-200 bg-white py-1 shadow-lg"
            style={{ left: contextNode.x, top: contextNode.y }}
          >
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm text-leaf-700 hover:bg-leaf-50"
              onClick={() => {
                const node = nodes.find((n) => n.id === contextNode.id)
                if (node) { setRenameId(node.id); setRenameValue(node.title) }
                setContextNode(null)
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-leaf-50"
              onClick={() => handleDelete(contextNode.id, contextNode.kind)}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapLeafNodes(raw: LeafTreeItem[]): SidebarNode[] {
  return raw.map((leaf) => ({
    id: leaf.id,
    title: leaf.title || 'Untitled',
    kind: 'page' as const,
    parent_id: leaf.parent_id ?? null,
    children_ids: leaf.children_ids ?? [],
    order: leaf.order ?? 0,
  }))
}

function mapDbNodes(raw: Database[]): SidebarNode[] {
  return raw.map((db, i) => ({
    id: db.id,
    title: db.title || 'Untitled database',
    kind: 'database' as const,
    parent_id: db.parent_leaf_id ?? null,
    children_ids: [],
    order: 10000 + i, // databases sort after leaf children
  }))
}

function defaultExpanded(nodes: SidebarNode[]): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  nodes.filter((n) => !n.parent_id).forEach((n) => { out[n.id] = true })
  return out
}

function buildTree(nodes: SidebarNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  nodes.forEach((n) => byId.set(n.id, { ...n, children: [] }))

  const roots: TreeNode[] = []
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortChildren = (node: TreeNode) => {
    if (node.kind === 'page' && node.children_ids?.length) {
      // Sort page children by children_ids order, databases at the end
      node.children.sort((a, b) => {
        if (a.kind === 'page' && b.kind === 'page') {
          return node.children_ids.indexOf(a.id) - node.children_ids.indexOf(b.id)
        }
        if (a.kind === 'database') return 1
        if (b.kind === 'database') return -1
        return 0
      })
    }
    node.children.forEach(sortChildren)
  }
  roots.forEach(sortChildren)
  return roots
}
