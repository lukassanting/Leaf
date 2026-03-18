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
