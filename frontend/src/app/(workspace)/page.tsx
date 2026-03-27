/**
 * Leaf frontend: Workspace home page (`frontend/src/app/(workspace)/page.tsx`).
 *
 * Purpose:
 * - Shows “greeting”, “quick access” inline journal/pages, and “recent” root pages.
 * - Handles creating a new leaf/page and navigates to the editor route.
 *
 * How to read:
 * - `useEffect` loads the sidebar tree (`getCachedTree`) and primes default workspace items (`ensureWorkspaceDefaults`).
 * - `handleNewPage` creates a leaf via `createLeafAndPrimeCache` and routes to `/editor/[id]`.
 * - Navigation progress is wrapped with `useNavigationProgress` to improve perceived responsiveness.
 *
 * Update:
 * - To change what appears in “quick access”, adjust the `ensureWorkspaceDefaults()` mapping and icons/labels.
 * - To change limits/filters for “recent”, update the `roots.slice(0, 8)` logic.
 * - If adding other warm routes, call the relevant `warmEditorRoute`/mutation helpers before navigation.
 *
 * Debug:
 * - If lists don’t show, check `getCachedTree()` return shape and whether `ensureWorkspaceDefaults()` is resolving.
 * - If navigation fails during creation, inspect the `catch` block in `handleNewPage` and console errors.
 */


'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { getCachedTree } from '@/lib/leafCache'
import { createLeafAndPrimeCache } from '@/lib/leafMutations'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { useWarmWorkspaceRoutes } from '@/hooks/useWarmWorkspaceRoutes'
import { LeafIcon } from '@/components/Icons'
import { TopStrip } from '@/components/TopStrip'
import { StatusBar } from '@/components/StatusBar'
import { ensureWorkspaceDefaults } from '@/lib/workspaceDefaults'

type InlinePage = {
  id: string
  title: string
  icon: string
  description: string
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const router = useRouter()
  const { startNavigation, stopNavigation } = useNavigationProgress()
  const [pages, setPages] = useState<{ id: string; title: string }[]>([])
  const [inlinePages, setInlinePages] = useState<InlinePage[]>([])
  const [creating, setCreating] = useState(false)

  useWarmWorkspaceRoutes()

  useEffect(() => {
    getCachedTree().then((tree) => {
      if (!tree?.length) return
      const roots = tree
        .filter((n) => !n.parent_id)
        .slice(0, 8)
        .map((n) => ({ id: n.id, title: n.title || 'Untitled' }))
      setPages(roots)
    })

    void ensureWorkspaceDefaults()
      .then(({ dailyJournal, notesDump }) => {
        setInlinePages([
          {
            id: dailyJournal.id,
            title: dailyJournal.title,
            icon: '🗓️',
            description: 'Today\'s entry inside the Journal database.',
          },
          {
            id: notesDump.id,
            title: notesDump.title,
            icon: '📝',
            description: 'A single page for rough ideas, scraps, and quick notes.',
          },
        ])
      })
      .catch(() => setInlinePages([]))
  }, [])

  const handleNewPage = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      startNavigation()
      void warmEditorRoute()
      const leaf = await createLeafAndPrimeCache({ title: 'Untitled' }, { parent_id: null, kind: 'page' })
      router.push(`/editor/${leaf.id}`)
    } catch {
      stopNavigation()
      console.error('Failed to create page')
      setCreating(false)
    }
  }, [router, creating, startNavigation, stopNavigation])

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ background: 'var(--leaf-bg-editor)' }}>
      <TopStrip breadcrumbs={[]} currentTitle="Home" />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-10">
      <div className="w-full max-w-xl">
        {/* Greeting */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ color: 'var(--color-primary)' }}>
              <LeafIcon size={26} />
            </span>
            <h1
              className="text-3xl font-medium tracking-tight"
              style={{ color: 'var(--color-text-dark)' }}
              suppressHydrationWarning
            >
              {greeting()}
            </h1>
          </div>
          <p className="text-sm ml-11" style={{ color: 'var(--color-text-muted)' }}>
            Pick up where you left off, or start something new.
          </p>
        </div>

        {/* Recent pages */}
        {inlinePages.length > 0 && (
          <div className="mb-8">
            <p
              className="mb-3 text-[10px] font-medium uppercase tracking-widest"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Quick Access
            </p>
            <div className="space-y-2">
              {inlinePages.map((page) => (
                <Link
                  key={page.id}
                  href={`/editor/${page.id}`}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-150"
                  style={{ borderColor: 'var(--leaf-border-strong)', background: 'var(--leaf-bg-elevated)' }}
                  onClick={() => startNavigation()}
                  onMouseEnter={() => { void warmEditorRoute() }}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)' }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{page.icon}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
                      {page.title}
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--leaf-text-muted)' }}>
                      {page.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent pages */}
        {pages.length > 0 && (
          <div className="mb-8">
            <p
              className="text-[10px] font-medium tracking-widest uppercase mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Recent
            </p>
            <div className="grid grid-cols-2 gap-2">
              {pages.map((page) => (
                <Link
                  key={page.id}
                  href={`/editor/${page.id}`}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-lg transition-colors duration-150"
                  style={{ border: '1px solid var(--color-border)', background: 'var(--leaf-bg-elevated)' }}
                  onClick={() => startNavigation()}
                  onMouseEnter={(e) => {
                    void warmEditorRoute()
                    e.currentTarget.style.backgroundColor = 'var(--color-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--leaf-bg-elevated)'
                  }}
                >
                  <span className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    <LeafIcon size={13} />
                  </span>
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--color-text-dark)' }}
                  >
                    {page.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* New page action */}
        <button
          type="button"
          onClick={handleNewPage}
          onMouseEnter={() => { void warmEditorRoute() }}
          onFocus={() => { void warmEditorRoute() }}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity duration-150 disabled:opacity-50"
          style={{ background: 'var(--color-primary)', color: 'var(--leaf-on-accent)' }}
        >
          <span className="text-base leading-none">+</span>
          {creating ? 'Creating…' : 'New page'}
        </button>
      </div>
      </div>
      <StatusBar saveStatus="saved" wordCount={0} modeLabel="Home" />
    </div>
  )
}
