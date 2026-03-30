/**
 * Leaf UI: sidebar tree utilities (`frontend/src/components/sidebarTreeUtils.ts`).
 *
 * Purpose:
 * - Converts API DTOs into a unified sidebar node shape.
 * - Implements tree building + flattening/search behavior used by the sidebar UI.
 *
 * How to read:
 * - Types:
 *   - `SidebarNode` represents a page/database node in the sidebar.
 *   - `TreeNode` is the hierarchical version with `children`.
 * - Mapping:
 *   - `mapLeafNodes` converts `LeafTreeItem[]` -> `SidebarNode[]` (kind='page')
 *   - `mapDbNodes` converts `Database[]` -> `SidebarNode[]` (kind='database')
 * - Tree ops:
 *   - `buildTree` builds a parent/children tree from the flat node list
 *   - `flattenTreeWithSearch` filters by search and preserves expansion state
 *
 * Update:
 * - If you change node fields (e.g., `order` semantics), update the mapping and
 *   sorting logic in `buildTree`.
 * - If the search UX changes, update `flattenTreeWithSearch` and its ancestor marking.
 *
 * Debug:
 * - If search hides nodes incorrectly:
 *   - inspect the `matchSet`/ancestor marking logic
 *   - verify `expanded` uses the expected “false means collapsed” semantics.
 */


import type { Database, LeafTreeItem } from '@/lib/api'

const SIDEBAR_DBROW_PREFIX = 'dbrow:'

/**
 * Database row pages use synthetic ids `dbrow:${leafId}` in the sidebar tree.
 * Leaf REST endpoints expect the bare leaf UUID.
 */
export function sidebarNodeIdToLeafApiId(nodeId: string): string {
  return nodeId.startsWith(SIDEBAR_DBROW_PREFIX) ? nodeId.slice(SIDEBAR_DBROW_PREFIX.length) : nodeId
}

export type SidebarNode = {
  id: string
  title: string
  kind: 'page' | 'database'
  parent_id: string | null
  children_ids: string[]
  order: number
  tags: string[]
  isDbRow?: boolean
  database_id?: string
}

export type TreeNode = SidebarNode & { children: TreeNode[] }

export function mapLeafNodes(raw: LeafTreeItem[]): SidebarNode[] {
  return raw.map((leaf) => ({
    id: leaf.id,
    title: leaf.title || 'Untitled',
    kind: 'page',
    parent_id: leaf.parent_id ?? null,
    children_ids: leaf.children_ids ?? [],
    order: leaf.order ?? 0,
    tags: leaf.tags ?? [],
  }))
}

/** Descendant page sidebar ids (non–db-row pages) for cycle checks when reparenting. */
export function collectDescendantPageIds(pageId: string, nodes: SidebarNode[]): Set<string> {
  const out = new Set<string>()
  const walk = (id: string) => {
    for (const n of nodes) {
      if (n.kind === 'page' && !n.isDbRow && n.parent_id === id) {
        out.add(n.id)
        walk(n.id)
      }
    }
  }
  walk(pageId)
  return out
}

/** Breadcrumb-style path for picker labels (walks parent_id through mixed page/database nodes). */
export function sidebarPagePathLabel(nodeId: string, nodes: SidebarNode[]): string {
  const parts: string[] = []
  let cur: SidebarNode | undefined = nodes.find((n) => n.id === nodeId)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift(cur.title)
    cur = cur.parent_id ? nodes.find((n) => n.id === cur.parent_id) : undefined
  }
  return parts.join(' / ')
}

export function mapDbNodes(raw: Database[]): SidebarNode[] {
  return raw.map((database, index) => ({
    id: database.id,
    title: database.title || 'Untitled database',
    kind: 'database',
    parent_id: database.parent_leaf_id ?? null,
    children_ids: [],
    order: 10000 + index,
    tags: [],
  }))
}

export function defaultExpanded(nodes: SidebarNode[]): Record<string, boolean> {
  const expanded: Record<string, boolean> = {}
  nodes.filter((node) => !node.parent_id).forEach((node) => { expanded[node.id] = true })
  return expanded
}

export function buildTree(nodes: SidebarNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  nodes.forEach((node) => byId.set(node.id, { ...node, children: [] }))

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
      node.children.sort((left, right) => {
        if (left.kind === 'page' && right.kind === 'page') {
          return node.children_ids.indexOf(left.id) - node.children_ids.indexOf(right.id)
        }
        if (left.kind === 'database') return 1
        if (right.kind === 'database') return -1
        return 0
      })
    }
    node.children.forEach(sortChildren)
  }

  roots.forEach(sortChildren)
  return roots
}

export function flattenTreeWithSearch(
  tree: TreeNode[],
  expanded: Record<string, boolean>,
  search: string,
) {
  const flattenWithDepth = (node: TreeNode, depth: number, out: { node: TreeNode; depth: number }[] = []) => {
    const query = search.trim().toLowerCase()
    if (!query || node.title.toLowerCase().includes(query)) out.push({ node, depth })
    if (expanded[node.id] !== false) {
      node.children.forEach((child) => flattenWithDepth(child, depth + 1, out))
    }
    return out
  }

  if (!search.trim()) return tree.flatMap((node) => flattenWithDepth(node, 0))

  const query = search.trim().toLowerCase()
  const matchSet = new Set<string>()
  const nodeMap = new Map<string, TreeNode>()
  const indexNode = (node: TreeNode) => { nodeMap.set(node.id, node); node.children.forEach(indexNode) }
  tree.forEach(indexNode)

  const markAncestors = (node: TreeNode) => {
    matchSet.add(node.id)
    if (node.parent_id && nodeMap.has(node.parent_id)) markAncestors(nodeMap.get(node.parent_id)!)
  }

  nodeMap.forEach((node) => { if (node.title.toLowerCase().includes(query)) markAncestors(node) })

  const out: { node: TreeNode; depth: number }[] = []
  const collect = (node: TreeNode, depth: number) => {
    if (!matchSet.has(node.id)) return
    out.push({ node, depth })
    node.children.forEach((child) => collect(child, depth + 1))
  }
  tree.forEach((node) => collect(node, 0))
  return out
}
