'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { leavesApi } from '@/lib/api'
import { getCachedTree } from '@/lib/leafCache'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      // Try cached tree first for instant redirect
      const cached = await getCachedTree()
      if (cached && cached.length > 0) {
        router.replace(`/editor/${cached[0].id}`)
        return
      }

      // Fall back to API
      try {
        const tree = await leavesApi.getTree()
        if (tree.length > 0) {
          router.replace(`/editor/${tree[0].id}`)
          return
        }
      } catch {}

      // No pages exist — create one
      try {
        const leaf = await leavesApi.create({ title: 'Untitled' })
        router.replace(`/editor/${leaf.id}`)
      } catch {
        console.error('Failed to create initial page')
      }
    }
    redirect()
  }, [router])

  return <div className="flex-1 flex items-center justify-center text-leaf-300 text-sm">Loading…</div>
}
