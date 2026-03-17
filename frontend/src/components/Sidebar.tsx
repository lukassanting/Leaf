'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { leavesApi } from '@/lib/api'
import { SidebarTree } from './SidebarTree'
import { LeafIcon } from './Icons'

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
    <aside
      className="w-60 shrink-0 hidden md:flex md:flex-col"
      style={{ backgroundColor: 'var(--color-sidebar-bg)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Branding */}
      <div
        className="px-4 h-11 flex items-center shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 transition-colors duration-150"
          style={{ color: 'var(--color-text-dark)' }}
        >
          <span style={{ color: 'var(--color-primary)' }}><LeafIcon size={15} /></span>
          <span className="text-sm font-medium tracking-tight">Leaf</span>
        </Link>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-hidden py-1">
        <SidebarTree activeId={activeId} />
      </div>

      {/* New page */}
      <div className="p-2 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          type="button"
          onClick={handleNewPage}
          disabled={creatingPage}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors duration-150 text-left disabled:opacity-40"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
        >
          <span className="text-base leading-none">+</span>
          {creatingPage ? 'Creating…' : 'New page'}
        </button>
      </div>
    </aside>
  )
}
