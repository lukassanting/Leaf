/**
 * Leaf UI: left navigation sidebar (`frontend/src/components/SidebarLeft.tsx`).
 *
 * Purpose:
 * - Provides navigation UI including:
 *   - “quick access” buttons (Graph view, Journal DB, Notes Dump, etc.)
 *   - pinned items (persisted in localStorage)
 *   - “new page” action
 *   - workspace navigation actions (search/recent/settings placeholders)
 *
 * How to read:
 * - On mount, it calls `ensureWorkspaceDefaults()` to create/bootstrap defaults
 *   and then builds quick access items from returned `journalDatabase` + `notesDump`.
 * - It persists pinned items based on `leaf-quick-access-pins` localStorage key.
 *
 * Update:
 * - To change what appears in quick access:
 *   - update `ensureWorkspaceDefaults` bootstrap logic (`frontend/src/lib/workspaceDefaults.ts`)
 *   - then update the `setQuickAccess([...])` mapping in this file.
 * - To change pin behavior, edit `togglePin`-related logic (also in this component).
 *
 * Debug:
 * - If the sidebar doesn’t show Journal/Notes defaults:
 *   - check API connectivity for `ensureWorkspaceDefaults()`
 *   - inspect console errors in the `.catch(...)` section.
 */


'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { databasesApi, leavesApi } from '@/lib/api'
import { createLeafAndPrimeCache } from '@/lib/leafMutations'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { SidebarTree } from './SidebarTree'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { DatabaseIcon, LeafIcon } from './Icons'
import { ensureWorkspaceDefaults } from '@/lib/workspaceDefaults'

type QuickAccessItem = {
  id: string
  title: string
  href: string
  icon: 'graph' | 'tags' | 'journal' | 'notes' | 'page' | 'database'
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
      .then(({ journalDatabase, notesDump, tagsDatabase }) => {
        if (cancelled) return
        setQuickAccess([
          { id: 'graph', title: 'Graph View', href: '/graph', icon: 'graph' },
          { id: tagsDatabase.id, title: tagsDatabase.title, href: `/databases/${tagsDatabase.id}`, icon: 'tags' },
          { id: journalDatabase.id, title: journalDatabase.title, href: `/databases/${journalDatabase.id}`, icon: 'journal' },
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

  const [pinnedItems, setPinnedItems] = useState<QuickAccessItem[]>([])

  const loadPinnedItems = useCallback(async () => {
    try {
      const pins: string[] = JSON.parse(localStorage.getItem('leaf-quick-access-pins') || '[]')
      if (pins.length === 0) { setPinnedItems([]); return }

      const items: QuickAccessItem[] = []
      for (const id of pins) {
        try {
          const leaf = await leavesApi.get(id)
          items.push({ id, title: leaf.title, href: `/editor/${id}`, icon: 'page' })
        } catch {
          try {
            const db = await databasesApi.get(id)
            items.push({ id, title: db.title, href: `/databases/${id}`, icon: 'database' })
          } catch {
            // item no longer exists, skip
          }
        }
      }
      setPinnedItems(items)
    } catch {
      setPinnedItems([])
    }
  }, [])

  useEffect(() => {
    void loadPinnedItems()
    const handler = () => { void loadPinnedItems() }
    window.addEventListener('leaf-quick-access-changed', handler)
    return () => window.removeEventListener('leaf-quick-access-changed', handler)
  }, [loadPinnedItems])

  const activeQuickAccessId = useMemo(() => {
    if (pathname === '/graph') return 'graph'
    const allItems = [...quickAccess, ...pinnedItems]
    const match = allItems.find((item) => item.href === pathname)
    return match?.id
  }, [pathname, quickAccess, pinnedItems])

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
        <Link href="/" className="flex items-center gap-2 px-1 no-underline" style={{ color: 'var(--leaf-text-title)' }}>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--leaf-green) 12%, transparent)', color: 'var(--leaf-green)' }}
          >
            <LeafIcon size={16} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em' }}>Leaf</span>
        </Link>
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
        {quickAccess.filter((item) => item.icon === 'graph' || item.icon === 'tags').map((item) => (
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
              {item.icon === 'graph' ? (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="4" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="12" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="8" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.6 4.8L10.3 4.6M5 5.5L7.1 10.3M10.9 6.4L8.9 10.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M4.5 2.5L6.5 8.5L8 6L9.5 8.5L11.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 10.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M4 13H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
            </NavIcon>
            <span style={{ fontSize: 13 }}>{item.title}</span>
          </Link>
        ))}
      </div>

      {/* Quick Access section */}
      <div className="px-3 pb-1">
        <div className="flex items-center justify-between">
          <SectionLabel>Quick Access</SectionLabel>
        </div>
        {[...quickAccess.filter((item) => item.icon !== 'graph' && item.icon !== 'tags'), ...pinnedItems].map((item) => (
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
              {item.icon === 'journal' || item.icon === 'database' ? <DatabaseIcon size={14} /> : <LeafIcon size={14} />}
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
            background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)',
            color: 'var(--leaf-green)',
            border: '1px solid color-mix(in srgb, var(--leaf-green) 20%, transparent)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'color-mix(in srgb, var(--leaf-green) 16%, transparent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'color-mix(in srgb, var(--leaf-green) 9%, transparent)'
          }}
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md text-xs"
            style={{ background: 'color-mix(in srgb, var(--leaf-green) 14%, transparent)' }}
          >
            +
          </span>
          <span style={{ fontWeight: 500 }}>New page</span>
        </button>
      </div>
    </aside>
  )
}
