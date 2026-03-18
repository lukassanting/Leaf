import type { Database, LeafTreeItem } from '@/lib/api'

export type SidebarNode = {
  id: string
  title: string
  kind: 'page' | 'database'
  parent_id: string | null
  children_ids: string[]
  order: number
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
  }))
}

export function mapDbNodes(raw: Database[]): SidebarNode[] {
  return raw.map((database, index) => ({
    id: database.id,
    title: database.title || 'Untitled database',
    kind: 'database',
    parent_id: database.parent_leaf_id ?? null,
    children_ids: [],
    order: 10000 + index,
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
