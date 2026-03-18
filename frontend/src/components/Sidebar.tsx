'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { createLeafAndPrimeCache } from '@/lib/leafMutations'
import { databasesApi, leavesApi } from '@/lib/api'
import { warmEditorRoute } from '@/lib/warmEditorRoute'
import { useWarmWorkspaceRoutes } from '@/hooks/useWarmWorkspaceRoutes'
import { SidebarTree } from './SidebarTree'
import { DatabaseIcon, LeafIcon, type LeafShapeIcon, ShapeIcon } from './Icons'

type SidebarIdentityData = {
  kind: 'page' | 'database'
  title: string
  description?: string | null
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  viewType?: string
  icon?: { type: 'emoji' | 'svg' | 'image'; value: string } | null
}

type BacklinkItem = {
  id: string
  title: string
}

function SmallIdentityIcon({
  kind,
  icon,
}: {
  kind: 'page' | 'database'
  icon?: SidebarIdentityData['icon']
}) {
  if (icon?.type === 'emoji' && icon.value) {
    return <span style={{ fontSize: 16, lineHeight: 1 }}>{icon.value}</span>
  }

  if (icon?.type === 'image' && icon.value) {
    return <Image src={icon.value} alt="" width={32} height={32} unoptimized style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }} />
  }

  if (icon?.type === 'svg' && icon.value !== 'leaf') {
    return <ShapeIcon shape={icon.value as LeafShapeIcon} size={16} />
  }

  return kind === 'database' ? <DatabaseIcon size={16} /> : <LeafIcon size={16} />
}

export function Sidebar({ activeId }: { activeId?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { startNavigation, stopNavigation } = useNavigationProgress()
  const [creatingPage, setCreatingPage] = useState(false)
  const [identity, setIdentity] = useState<SidebarIdentityData | null>(null)
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])

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

  useEffect(() => {
    let cancelled = false

    async function loadIdentity() {
      if (!activeId) {
        setIdentity(null)
        setBacklinks([])
        return
      }

      try {
        if (pathname?.startsWith('/databases/')) {
          const database = await databasesApi.get(activeId)
          if (cancelled) return
          setIdentity({
            kind: 'database',
            title: database.title,
            description: database.description || (database.parent_leaf_id ? 'Embedded database' : 'Standalone database'),
            tags: database.tags ?? [],
            createdAt: database.created_at,
            updatedAt: database.updated_at,
            viewType: database.view_type,
            icon: database.icon ?? null,
          })
          setBacklinks([])
          return
        }

        const [leaf, linkedLeaves] = await Promise.all([
          leavesApi.get(activeId),
          leavesApi.getBacklinks(activeId),
        ])

        if (cancelled) return

        setIdentity({
          kind: 'page',
          title: leaf.title || 'Untitled',
          description: leaf.description,
          tags: leaf.tags ?? [],
          createdAt: leaf.created_at,
          updatedAt: leaf.updated_at,
          icon: leaf.icon ?? null,
        })
        setBacklinks(linkedLeaves.map((item) => ({ id: item.id, title: item.title || 'Untitled' })))
      } catch {
        if (cancelled) return
        setIdentity(null)
        setBacklinks([])
      }
    }

    void loadIdentity()

    return () => {
      cancelled = true
    }
  }, [activeId, pathname])

  const propertyRows = useMemo(() => {
    if (!identity) return []
    const rows: { key: string; value: string | string[] }[] = [
      { key: 'Kind', value: identity.kind === 'database' ? 'Database' : 'Page' },
    ]
    if (identity.viewType) rows.push({ key: 'View', value: identity.viewType })
    if (identity.createdAt) rows.push({ key: 'Created', value: new Date(identity.createdAt).toLocaleDateString() })
    if (identity.updatedAt) rows.push({ key: 'Updated', value: new Date(identity.updatedAt).toLocaleDateString() })
    if (identity.tags?.length) rows.push({ key: 'Tags', value: identity.tags })
    return rows
  }, [identity])

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
      <div
        style={{
          padding: '14px 14px 10px',
          borderBottom: '0.5px solid var(--leaf-border-strong)',
        }}
      >
        <div
          onClick={() => window.dispatchEvent(new CustomEvent('leaf-focus-header-field', { detail: 'icon' }))}
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
            overflow: 'hidden',
            cursor: identity?.kind === 'page' ? 'pointer' : 'default',
          }}
        >
          <SmallIdentityIcon kind={identity?.kind ?? 'page'} icon={identity?.icon} />
        </div>
        <div
          onClick={() => window.dispatchEvent(new CustomEvent('leaf-focus-header-field', { detail: 'title' }))}
          style={{ fontSize: 13, fontWeight: 500, color: 'var(--leaf-text-title)', marginBottom: 3, lineHeight: 1.3, cursor: identity ? 'pointer' : 'default' }}
        >
          {identity?.title ?? 'Select a page'}
        </div>
        <div
          onClick={() => window.dispatchEvent(new CustomEvent('leaf-focus-header-field', { detail: 'description' }))}
          style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', lineHeight: 1.5, cursor: identity?.kind === 'page' ? 'pointer' : 'default' }}
        >
          {identity?.description || (identity ? 'No description yet' : 'Select a page')}
        </div>
        {identity?.tags?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {identity.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10.5,
                  background: '#edf5e8',
                  color: '#3b6b4a',
                  borderRadius: 3,
                  padding: '2px 6px',
                  border: '0.5px solid #c5ddb8',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

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
        {propertyRows.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', padding: '4px 5px' }}>
            No properties yet
          </div>
        ) : propertyRows.map((row) => (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 5px', fontSize: 11.5 }}>
            <div style={{ width: 64, flexShrink: 0, color: '#7a9e87', fontSize: 11 }}>{row.key}</div>
            <div style={{ color: 'var(--leaf-text-title)', flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Array.isArray(row.value)
                ? row.value.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 10,
                      background: '#edf5e8',
                      color: '#3b6b4a',
                      borderRadius: 3,
                      padding: '1px 5px',
                      border: '0.5px solid #c5ddb8',
                    }}
                  >
                    {tag}
                  </span>
                ))
                : row.value}
            </div>
          </div>
        ))}
      </div>

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
        {backlinks.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', padding: '4px 5px' }}>
            No backlinks yet
          </div>
        ) : backlinks.map((item) => (
          <Link
            key={item.id}
            href={`/editor/${item.id}`}
            onClick={() => startNavigation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 5px',
              borderRadius: 5,
              fontSize: 11.5,
              color: '#4d7a60',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M7 2H10V5M10 2L6 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 3H3.5C2.67 3 2 3.67 2 4.5V8.5C2 9.33 2.67 10 3.5 10H7.5C8.33 10 9 9.33 9 8.5V7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            <span>{item.title}</span>
          </Link>
        ))}
      </div>

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
