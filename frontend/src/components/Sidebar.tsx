'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { leavesApi } from '@/lib/api'
import { SidebarTree } from './SidebarTree'

export function Sidebar({ activeId }: { activeId?: string }) {
  const router = useRouter()
  const [creatingPage, setCreatingPage] = useState(false)

  const handleNewPage = useCallback(async () => {
    if (creatingPage) return
    setCreatingPage(true)
    try {
      const leaf = await leavesApi.create({ title: 'Untitled' })
      window.dispatchEvent(new Event('leaf-tree-changed'))
      router.push(`/editor/${leaf.id}`)
    } catch {
      console.error('Failed to create page')
    } finally {
      setCreatingPage(false)
    }
  }, [router, creatingPage])

  return (
    <aside className="w-60 shrink-0 border-r border-leaf-100 bg-white hidden md:flex md:flex-col">
      {/* Branding */}
      <div className="px-4 h-11 flex items-center border-b border-leaf-100 shrink-0">
        <Link href="/" className="text-sm font-semibold text-leaf-800 hover:text-leaf-600">
          Leaf
        </Link>
      </div>

      {/* Unified pages + databases tree */}
      <div className="flex-1 overflow-hidden py-1">
        <SidebarTree activeId={activeId} />
      </div>

      {/* Create actions */}
      <div className="border-t border-leaf-100 p-2 shrink-0">
        <button
          type="button"
          onClick={handleNewPage}
          disabled={creatingPage}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-leaf-700 hover:bg-leaf-50 disabled:opacity-50 transition text-left"
        >
          <span className="text-base leading-none text-leaf-400">+</span>
          {creatingPage ? 'Creating…' : 'New page'}
        </button>
      </div>
    </aside>
  )
}
