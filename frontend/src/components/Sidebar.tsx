'use client'

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
      className="shrink-0 hidden md:flex md:flex-col"
      style={{
        width: 232,
        minWidth: 232,
        backgroundColor: 'var(--leaf-bg-sidebar)',
        borderLeft: '0.5px solid var(--leaf-border-strong)',
      }}
    >
      {/* Section 1 — Page identity card (placeholder until PR 3) */}
      <div
        style={{
          padding: '14px 14px 10px',
          borderBottom: '0.5px solid var(--leaf-border-strong)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--leaf-bg-tag)',
            border: '0.5px solid var(--leaf-border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <LeafIcon size={16} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--leaf-text-title)', marginBottom: 3, lineHeight: 1.3 }}>
          —
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', lineHeight: 1.5 }}>
          Select a page
        </div>
      </div>

      {/* Section 2 — Properties (placeholder until PR 3) */}
      <div style={{ padding: '8px 12px 4px' }}>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase' as const,
          color: '#7a9e87',
          padding: '0 2px 4px',
        }}>
          Properties
        </div>
      </div>

      {/* Section 3 — Page tree */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '8px 12px 4px' }}>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase' as const,
          color: '#7a9e87',
          padding: '0 2px 4px',
        }}>
          Pages
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SidebarTree activeId={activeId} />
        </div>
      </div>

      {/* Section 4 — Backlinks (placeholder until PR 3) */}
      <div style={{ padding: '8px 12px 4px' }}>
        <div style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase' as const,
          color: '#7a9e87',
          padding: '0 2px 4px',
        }}>
          Backlinks
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', padding: '4px 5px' }}>
          No backlinks yet
        </div>
      </div>

      {/* Footer — New page button */}
      <div
        style={{
          marginTop: 'auto',
          padding: '8px 12px 10px',
          borderTop: '0.5px solid var(--leaf-border-strong)',
        }}
      >
        <button
          type="button"
          onClick={handleNewPage}
          onMouseEnter={(e) => {
            void warmEditorRoute()
            e.currentTarget.style.backgroundColor = 'var(--leaf-bg-hover)'
          }}
          onFocus={() => { void warmEditorRoute() }}
          disabled={creatingPage}
          className="w-full flex items-center gap-1.5 rounded-md transition-colors duration-150 text-left disabled:opacity-40"
          style={{
            fontSize: 12,
            color: '#5a8a6a',
            padding: '5px 4px',
          }}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
        >
          <span
            style={{
              width: 16,
              height: 16,
              background: 'rgba(61,140,82,0.15)',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: 'var(--leaf-green)',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            +
          </span>
          {creatingPage ? 'Creating…' : 'New page'}
        </button>
      </div>
    </aside>
  )
}
