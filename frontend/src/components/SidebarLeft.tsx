'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createLeafAndPrimeCache } from '@/lib/leafMutations'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { SidebarTree } from './SidebarTree'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { LeafIcon } from './Icons'
import { ensureWorkspaceDefaults } from '@/lib/workspaceDefaults'

type QuickAccessItem = {
  id: string
  title: string
  href: string
  icon: 'graph' | 'journal' | 'notes'
}

function NavIcon({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className="flex h-4 w-4 items-center justify-center"
      style={{
        color: active ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
      }}
    >
      {children}
    </span>
  )
}

export function SidebarLeft({ activeId }: { activeId?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { startNavigation, stopNavigation } = useNavigationProgress()
  const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([
    { id: 'graph', title: 'Graph View', href: '/graph', icon: 'graph' },
  ])

  useEffect(() => {
    let cancelled = false

    void ensureWorkspaceDefaults()
      .then(({ dailyJournal, notesDump }) => {
        if (cancelled) return
        setQuickAccess([
          { id: 'graph', title: 'Graph View', href: '/graph', icon: 'graph' },
          { id: dailyJournal.id, title: dailyJournal.title, href: `/editor/${dailyJournal.id}`, icon: 'journal' },
          { id: notesDump.id, title: notesDump.title, href: `/editor/${notesDump.id}`, icon: 'notes' },
        ])
      })
      .catch(() => {
        if (cancelled) return
        setQuickAccess([{ id: 'graph', title: 'Graph View', href: '/graph', icon: 'graph' }])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const activeQuickAccessId = useMemo(() => {
    if (pathname === '/graph') return 'graph'
    const match = quickAccess.find((item) => item.href === pathname)
    return match?.id
  }, [pathname, quickAccess])

  const handleNewPage = async () => {
    try {
      startNavigation()
      void warmEditorRoute()
      const leaf = await createLeafAndPrimeCache({ title: 'Untitled' }, { parent_id: null, kind: 'page' })
      router.push(`/editor/${leaf.id}`)
    } catch {
      stopNavigation()
    }
  }

  return (
    <aside
      className="hidden shrink-0 border-r md:flex md:flex-col"
      style={{
        width: 264,
        minWidth: 264,
        background: 'linear-gradient(180deg, rgba(248,248,249,0.98), rgba(250,250,250,0.98))',
        borderRightColor: 'var(--leaf-border-strong)',
      }}
    >
      <div className="px-3 py-4">
        <div className="mb-6 flex items-center justify-between px-2" style={{ color: 'var(--leaf-text-title)' }}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--leaf-green)' }}>
              <LeafIcon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Leaf</div>
            </div>
          </div>
        </div>

        <div className="mb-5 p-1">
          {[
            { label: 'Search', icon: (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            ) },
            { label: 'Recent', icon: (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            ) },
            { label: 'Settings', icon: (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2.5V4M8 12V13.5M3.8 5.1L5 5.8M11 10.2L12.2 10.9M3.8 10.9L5 10.2M11 5.8L12.2 5.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            ) },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
              style={{ color: 'var(--leaf-text-body)' }}
              title={`${item.label} placeholder`}
            >
              <NavIcon>{item.icon}</NavIcon>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-5 p-1">
          <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.09em]" style={{ color: 'var(--leaf-text-muted)' }}>
            Quick Access
          </div>
          {quickAccess.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150"
              style={{
                color: activeQuickAccessId === item.id ? 'var(--leaf-green)' : 'var(--leaf-text-body)',
                background: activeQuickAccessId === item.id ? 'rgba(228,228,231,0.72)' : 'transparent',
                fontWeight: activeQuickAccessId === item.id ? 600 : 500,
              }}
              onClick={() => startNavigation()}
            >
              <NavIcon active={activeQuickAccessId === item.id}>
                {item.icon === 'graph' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="4" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="12" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="8" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5.6 4.8L10.3 4.6M5 5.5L7.1 10.3M10.9 6.4L8.9 10.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                ) : item.icon === 'journal' ? (
                  <span style={{ fontSize: 14, lineHeight: 1 }}>🗓️</span>
                ) : (
                  <span style={{ fontSize: 14, lineHeight: 1 }}>📝</span>
                )}
              </NavIcon>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</span>
            </Link>
          ))}
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
            style={{ color: 'var(--leaf-text-body)' }}
            title="Custom quick access pinning coming soon"
          >
            <NavIcon>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </NavIcon>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Add later</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-3 pb-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.09em]" style={{ color: 'var(--leaf-text-muted)' }}>
            Personal
          </div>
          <button
            type="button"
            onClick={() => { void handleNewPage() }}
            className="rounded-md px-1.5 py-0.5 text-[11px]"
            style={{ color: 'var(--leaf-green)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.14)' }}
          >
            + New
          </button>
        </div>
        <div className="h-full overflow-hidden rounded-2xl border p-2" style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.7)' }}>
          <SidebarTree activeId={activeId} />
        </div>
      </div>

      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={() => { void handleNewPage() }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150"
          style={{
            background: 'linear-gradient(180deg, rgba(236,253,245,0.95), rgba(220,252,231,0.95))',
            color: 'var(--leaf-green)',
            boxShadow: '0 8px 20px rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: 'rgba(16,185,129,0.12)' }}>+</span>
          New page
        </button>
      </div>
    </aside>
  )
}
