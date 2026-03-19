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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.09em]"
      style={{ color: 'var(--leaf-text-muted)' }}
    >
      {children}
    </div>
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

  const navItems = [
    { label: 'Search', icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ) },
    { label: 'Recent', icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ) },
    { label: 'Settings', icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M8 2.5V4M8 12V13.5M3.8 5.1L5 5.8M11 10.2L12.2 10.9M3.8 10.9L5 10.2M11 5.8L12.2 5.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ) },
  ]

  return (
    <aside
      className="hidden shrink-0 border-r md:flex md:flex-col"
      style={{
        width: 260,
        minWidth: 260,
        background: 'var(--leaf-bg-sidebar)',
        borderRightColor: 'var(--leaf-border-strong)',
      }}
    >
      {/* Branding */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 px-1" style={{ color: 'var(--leaf-text-title)' }}>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--leaf-green)' }}
          >
            <LeafIcon size={16} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em' }}>Leaf</span>
        </div>
      </div>

      {/* Nav buttons */}
      <div className="px-3 pb-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
            style={{ color: 'var(--leaf-text-body)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
            title={`${item.label} placeholder`}
          >
            <NavIcon>{item.icon}</NavIcon>
            <span style={{ fontSize: 13, fontWeight: 400 }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* KNOWLEDGE BASE section */}
      <div className="px-3 pb-2">
        <SectionLabel>Knowledge Base</SectionLabel>
        {quickAccess.filter((item) => item.icon === 'graph').map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150"
            style={{
              color: activeQuickAccessId === item.id ? 'var(--leaf-green)' : 'var(--leaf-text-body)',
              background: activeQuickAccessId === item.id ? 'var(--color-active)' : 'transparent',
              fontWeight: 400,
            }}
            onClick={() => startNavigation()}
          >
            <NavIcon active={activeQuickAccessId === item.id}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="4" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="12" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="8" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5.6 4.8L10.3 4.6M5 5.5L7.1 10.3M10.9 6.4L8.9 10.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </NavIcon>
            <span style={{ fontSize: 13 }}>{item.title}</span>
          </Link>
        ))}
      </div>

      {/* Personal section */}
      <div className="px-3 pb-1">
        <div className="flex items-center justify-between">
          <SectionLabel>Personal</SectionLabel>
        </div>
        {quickAccess.filter((item) => item.icon !== 'graph').map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150"
            style={{
              color: activeQuickAccessId === item.id ? 'var(--leaf-green)' : 'var(--leaf-text-body)',
              background: activeQuickAccessId === item.id ? 'var(--color-active)' : 'transparent',
              fontWeight: 400,
            }}
            onClick={() => startNavigation()}
          >
            <NavIcon active={activeQuickAccessId === item.id}>
              <LeafIcon size={14} />
            </NavIcon>
            <span style={{ fontSize: 13 }}>{item.title}</span>
          </Link>
        ))}
      </div>

      {/* PROJECTS section — page tree */}
      <div className="flex-1 overflow-hidden px-3 pb-2">
        <SectionLabel>Projects</SectionLabel>
        <div className="h-full overflow-hidden">
          <SidebarTree activeId={activeId} />
        </div>
      </div>

      {/* New page footer */}
      <div className="border-t px-3 py-3" style={{ borderTopColor: 'var(--leaf-border-soft)' }}>
        <button
          type="button"
          onClick={() => { void handleNewPage() }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150"
          style={{
            background: 'rgba(16,185,129,0.08)',
            color: 'var(--leaf-green)',
            border: '1px solid rgba(16,185,129,0.14)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.14)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md text-xs" style={{ background: 'rgba(16,185,129,0.12)' }}>+</span>
          <span style={{ fontWeight: 500 }}>New page</span>
        </button>
      </div>
    </aside>
  )
}
