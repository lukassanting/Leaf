/**
 * Leaf hook: leaf breadcrumbs (`frontend/src/hooks/useLeafBreadcrumbs.ts`).
 *
 * Purpose:
 * - Produces navigation breadcrumbs for either:
 *   - a leaf/page within the tree (`parentId`), or
 *   - a database view (`databaseId`) using `databasesApi.get()`.
 *
 * How to read:
 * - The hook loads `getCachedTree()` and builds parent chains using `parent_id`.
 * - When `databaseId` is provided without `parentId`, it loads the database to find
 *   `database.parent_leaf_id` and then appends a `{ kind: 'database' }` crumb.
 *
 * Update:
 * - If breadcrumb semantics change (e.g., include more metadata), extend the `NavigationCrumb` type
 *   and adjust the chain builder.
 *
 * Debug:
 * - If breadcrumb chains look wrong:
 *   - check cache completeness (`getCachedTree`)
 *   - check the correct page passes `parentId` vs `databaseId` into this hook.
 */


'use client'

import { useEffect, useState } from 'react'
import { databasesApi } from '@/lib/api'
import { getCachedTree } from '@/lib/leafCache'

export type NavigationCrumb = {
  id: string
  title: string
  kind: 'page' | 'database'
}

export function useLeafBreadcrumbs(parentId: string | null, databaseId: string | null) {
  const [breadcrumbs, setBreadcrumbs] = useState<NavigationCrumb[]>([])

  useEffect(() => {
    const build = async () => {
      const tree = await getCachedTree()
      if (!tree) {
        setBreadcrumbs([])
        return
      }

      const byId = new Map(tree.map((node) => [node.id, node]))
      const buildLeafChain = (startId: string) => {
        const chain: NavigationCrumb[] = []
        let currentNode = byId.get(startId)
        while (currentNode) {
          chain.unshift({ id: currentNode.id, title: currentNode.title, kind: 'page' })
          currentNode = currentNode.parent_id ? byId.get(currentNode.parent_id) : undefined
        }
        return chain
      }

      if (parentId) {
        setBreadcrumbs(buildLeafChain(parentId))
        return
      }

      if (databaseId) {
        try {
          const database = await databasesApi.get(databaseId)
          const chain = database.parent_leaf_id ? buildLeafChain(database.parent_leaf_id) : []
          chain.push({ id: database.id, title: database.title, kind: 'database' })
          setBreadcrumbs(chain)
          return
        } catch (error) {
          console.error('[leaf:breadcrumbs] database load failed', error)
        }
      }

      setBreadcrumbs([])
    }

    void build()
  }, [parentId, databaseId])

  return breadcrumbs
}
