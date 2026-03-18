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
