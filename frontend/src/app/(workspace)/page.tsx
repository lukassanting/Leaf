'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { leavesApi } from '@/lib/api'

export default function HomePage() {
  const router = useRouter()

  const handleCreate = useCallback(async () => {
    try {
      const leaf = await leavesApi.create({ title: 'Untitled' })
      router.push(`/editor/${leaf.id}`)
    } catch {
      console.error('Failed to create page')
    }
  }, [router])

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <p className="text-leaf-400 text-sm mb-4">
        Select a page from the sidebar, or start a new one.
      </p>
      <button
        onClick={handleCreate}
        className="px-4 py-2 rounded-lg bg-leaf-600 text-white text-sm font-medium hover:bg-leaf-700 transition"
      >
        New page
      </button>
    </main>
  )
}
