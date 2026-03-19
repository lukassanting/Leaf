/**
 * Leaf hook: database breadcrumbs (`frontend/src/hooks/useDatabaseBreadcrumbs.ts`).
 *
 * Purpose:
 * - Builds a breadcrumb chain for a database page based on the parent leaf id.
 * - Uses the locally cached sidebar tree (`leafCache`).
 *
 * How to read:
 * - `useDatabaseBreadcrumbs(parentLeafId)`:
 *   - if `parentLeafId` is missing, returns `[]`
 *   - loads `getCachedTree()` and walks `parent_id` links up to the root
 *
 * Update:
 * - If tree nodes change shape, update how this hook reads `node.parent_id` and `node.title`.
 *
 * Debug:
 * - If breadcrumbs are empty:
 *   - verify the cache tree exists (`getCachedTree()`)
 *   - verify `parentLeafId` is actually passed from the page (database route).
 */


'use client'

import { useEffect, useState } from 'react'
import { getCachedTree } from '@/lib/leafCache'

export function useDatabaseBreadcrumbs(parentLeafId: string | null | undefined) {
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    const build = async () => {
      if (!parentLeafId) {
        setBreadcrumbs([])
        return
      }

      const tree = await getCachedTree()
      if (!tree) {
        setBreadcrumbs([])
        return
      }

      const byId = new Map(tree.map((node) => [node.id, node]))
      const chain: { id: string; title: string }[] = []
      let currentNode = byId.get(parentLeafId)
      while (currentNode) {
        chain.unshift({ id: currentNode.id, title: currentNode.title })
        currentNode = currentNode.parent_id ? byId.get(currentNode.parent_id) : undefined
      }
      setBreadcrumbs(chain)
    }

    void build()
  }, [parentLeafId])

  return breadcrumbs
}
