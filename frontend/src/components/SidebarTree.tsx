'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCachedTree, setCachedTree } from '@/lib/leafCache'
import { leavesApi, databasesApi } from '@/lib/api'
import type { LeafTreeItem, Database } from '@/lib/api'
import { LeafIcon, DatabaseIcon } from './Icons'

const EXPAND_KEY = 'leaf-sidebar-expanded'

function loadExpandState(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(EXPAND_KEY) ?? '{}') } catch { return {} }
}

function saveExpandState(state: Record<string, boolean>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(EXPAND_KEY, JSON.stringify(state))
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
      const [rawLeaves, rawDbs] = await Promise.all([leavesApi.getTree(), databasesApi.list()])
      const leafNodes = mapLeafNodes(rawLeaves)
      const dbNodes = mapDbNodes(rawDbs)
      const merged = [...leafNodes, ...dbNodes]
      setNodes(merged)
      await setCachedTree(leafNodes.map((n) => ({ ...n, type: 'page' as const })))
      setExpanded((prev) => Object.keys(prev).length === 0 ? defaultExpanded(merged) : prev)
    } catch (error) {
      console.error('Failed to load tree:', error)
      if (!hadCached) setNetworkError(`Can't reach API. Is the backend running? (make up)`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTree() }, [fetchTree])

  useEffect(() => {
    const handler = () => fetchTree()
    window.addEventListener('leaf-tree-changed', handler)
    window.addEventListener('leaf-database-created', handler)
    return () => {
      window.removeEventListener('leaf-tree-changed', handler)
      window.removeEventListener('leaf-database-created', handler)
    }
  }, [fetchTree])

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
        await leavesApi.update(id, { title: newTitle.trim(), parent_id: node.parent_id ?? undefined, children_ids: node.children_ids ?? [] })
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
    if (fromIdx === -1) { setDraggedId(null); setDropTargetId(null); return }
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
            'flex items-center gap-1 pr-1 rounded-md text-sm group transition-colors duration-150',
            draggedId === node.id ? 'opacity-40' : '',
            isDropTarget ? 'ring-1 ring-leaf-500' : '',
          ].join(' ')}
          style={{
            paddingLeft: 8 + depth * 14,
            backgroundColor: isActive
              ? 'var(--color-active)'
              : undefined,
            color: isActive ? 'var(--color-text-dark)' : 'var(--color-text-body)',
          }}
          onMouseEnter={(e) => {
            setHoverNodeId(node.id)
            if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-hover)'
          }}
          onMouseLeave={(e) => {
            setHoverNodeId(null)
            if (!isActive) e.currentTarget.style.backgroundColor = ''
          }}
          draggable={!isDb}
          onDragStart={(e) => onDragStart(e, node)}
          onDragOver={(e) => onDragOver(e, node)}
          onDragLeave={() => setDropTargetId(null)}
          onDrop={(e) => onDrop(e, node)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextNode({ id: node.id, kind: node.kind, x: e.clientX, y: e.clientY })
          }}
        >
          {/* Animated chevron */}
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.id)}
            className="w-4 h-4 flex items-center justify-center shrink-0 transition-transform duration-200"
            style={{
              color: 'var(--color-text-muted)',
              transform: hasChildren && isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            {hasChildren ? (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            ) : null}
          </button>

          {/* Icon */}
          <span className="shrink-0" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
            {isDb
              ? <DatabaseIcon size={13} />
              : <LeafIcon size={13} />
            }
          </span>

          {/* Title / rename */}
          {isEditing ? (
            <input
              autoFocus
              className="flex-1 min-w-0 rounded px-1 py-0.5 text-sm focus:outline-none"
              style={{ background: '#fff', border: '1px solid var(--color-border)' }}
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
              className="flex-1 truncate py-1 text-sm"
              style={{ fontWeight: isActive ? 500 : 400 }}
              onClick={(e) => renameId && e.preventDefault()}
            >
              {node.title || 'Untitled'}
            </Link>
          )}

          {/* Inline + button (page nodes only) */}
          {isHovered && !isEditing && !isDb && (
            <button
              type="button"
              title="Add sub-page"
              disabled={creatingChildOf === node.id}
              onClick={(e) => { e.stopPropagation(); handleCreateChild(node.id) }}
              className="w-5 h-5 flex items-center justify-center rounded text-sm leading-none shrink-0 transition-colors duration-150"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
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

  if (loading) return (
    <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
  )

  if (networkError) return (
    <div className="px-3 py-2 text-xs rounded" style={{ color: '#92400e', background: '#fffbeb' }}>
      {networkError}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pb-1 space-y-1 shrink-0">
        <input
          type="search"
          placeholder="Search…"
          className="w-full rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1"
          style={{
            background: 'rgba(255,255,255,0.6)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-body)',
            caretColor: 'var(--color-primary)',
          }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {Object.keys(expanded).length > 0 && (
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs transition-colors duration-150"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Collapse all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 px-1">
        {filteredFlat.length === 0 ? (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {search ? 'No matches.' : 'No pages yet.'}
          </div>
        ) : (
          filteredFlat.map((item) => renderNode(item))
        )}
      </div>

      {/* Context menu */}
      {contextNode && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextNode(null)} aria-hidden />
          <div
            className="fixed z-50 min-w-[130px] rounded-lg py-1 shadow-lg"
            style={{
              left: contextNode.x,
              top: contextNode.y,
              background: '#fff',
              border: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm transition-colors duration-150"
              style={{ color: 'var(--color-text-body)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
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
              className="w-full px-3 py-1.5 text-left text-sm transition-colors duration-150"
              style={{ color: '#dc2626' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    order: 10000 + i,
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
