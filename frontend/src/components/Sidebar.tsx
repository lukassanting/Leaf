'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { createLeafAndPrimeCache } from '@/lib/leafMutations'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { useWarmWorkspaceRoutes } from '@/hooks/useWarmWorkspaceRoutes'
import { SidebarTree } from './SidebarTree'
import { LeafIcon } from './Icons'

export function Sidebar({ activeId }: { activeId?: string }) {
  const router = useRouter()
  const { startNavigation, stopNavigation } = useNavigationProgress()
  const [creatingPage, setCreatingPage] = useState(false)

  useWarmWorkspaceRoutes()

  const handleNewPage = useCallback(async () => {
    if (creatingPage) return
    setCreatingPage(true)
    try {
      startNavigation()
      void warmEditorRoute()
      const leaf = await createLeafAndPrimeCache({ title: 'Untitled' }, { parent_id: null, kind: 'page' })
      router.push(`/editor/${leaf.id}`)
    } catch {
      stopNavigation()
      console.error('Failed to create page')
    } finally {
      setCreatingPage(false)
    }
  }, [router, creatingPage, startNavigation, stopNavigation])

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
          onMouseEnter={(e) => {
            void warmEditorRoute()
            e.currentTarget.style.backgroundColor = 'var(--color-hover)'
          }}
          onFocus={() => { void warmEditorRoute() }}
          disabled={creatingPage}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors duration-150 text-left disabled:opacity-40"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
        >
          <span className="text-base leading-none">+</span>
          {creatingPage ? 'Creating…' : 'New page'}
        </button>
      </div>
    </aside>
  )
}
