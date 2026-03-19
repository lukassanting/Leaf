'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { databasesApi, leavesApi } from '@/lib/api'
import { getLeafContentText, parseLeafContent } from '@/lib/leafDocument'
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
  snippet?: string
}

type OutlineItem = {
  id: string
  label: string
  level: 1 | 2 | 3
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
  const pathname = usePathname()
  const { startNavigation } = useNavigationProgress()
  const [identity, setIdentity] = useState<SidebarIdentityData | null>(null)
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [outline, setOutline] = useState<OutlineItem[]>([])

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
          setOutline([])
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
        const document = parseLeafContent(leaf.content ?? null)
        const nextOutline: OutlineItem[] = []
        document.content.forEach((node, index) => {
          if (node.type === 'heading') {
            const text = (node.content ?? []).map((item) => item.type === 'text' ? item.text : '\n').join('').trim()
            if (text) {
              nextOutline.push({
                id: `heading-${index}-${text}`,
                label: text,
                level: node.attrs.level,
              })
            }
          }
        })
        setOutline(nextOutline)

        const linkedLeafDetails = await Promise.all(linkedLeaves.slice(0, 6).map(async (item) => {
          try {
            const sourceLeaf = await leavesApi.get(item.id)
            const sourceText = getLeafContentText(parseLeafContent(sourceLeaf.content ?? null))
            const target = leaf.title.trim()
            const marker = `[[${target}]]`
            const markerIndex = sourceText.indexOf(marker)
            const snippet = markerIndex >= 0
              ? sourceText.slice(Math.max(0, markerIndex - 48), Math.min(sourceText.length, markerIndex + marker.length + 72)).trim()
              : sourceText.slice(0, 120).trim()
            return {
              id: item.id,
              title: item.title || 'Untitled',
              snippet: snippet || 'Linked mention',
            }
          } catch {
            return {
              id: item.id,
              title: item.title || 'Untitled',
              snippet: 'Linked mention',
            }
          }
        }))

        if (cancelled) return
        setBacklinks(linkedLeafDetails)
      } catch {
        if (cancelled) return
        setIdentity(null)
        setBacklinks([])
        setOutline([])
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
      className="hidden shrink-0 border-l md:flex md:flex-col"
      style={{
        width: 320,
        minWidth: 320,
        background: 'linear-gradient(180deg, rgba(250,250,250,0.98), rgba(244,244,245,0.98))',
        borderLeftColor: 'var(--leaf-border-strong)',
      }}
    >
      <div
        style={{
          padding: '18px 18px 16px',
          borderBottom: '1px solid var(--leaf-border-soft)',
          background: 'rgba(255,255,255,0.84)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--leaf-text-muted)', marginBottom: 12 }}>
          Page Info
        </div>
        <div
          onClick={() => window.dispatchEvent(new CustomEvent('leaf-focus-header-field', { detail: 'icon' }))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#fff',
            border: '1px solid var(--leaf-border-strong)',
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
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--leaf-text-title)', marginBottom: 5, lineHeight: 1.3, cursor: identity ? 'pointer' : 'default' }}
        >
          {identity?.title ?? 'Select a page'}
        </div>
        <div
          onClick={() => window.dispatchEvent(new CustomEvent('leaf-focus-header-field', { detail: 'description' }))}
          style={{ fontSize: 12, color: 'var(--leaf-text-muted)', lineHeight: 1.6, cursor: identity?.kind === 'page' ? 'pointer' : 'default' }}
        >
          {identity?.description || (identity ? 'No description yet' : 'Select a page')}
        </div>
        {identity?.tags?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {identity.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10.5,
                  background: 'var(--color-tag-bg)',
                  color: 'var(--color-tag-text)',
                  borderRadius: 999,
                  padding: '2px 6px',
                  border: '1px solid var(--color-tag-border)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '14px 14px 18px' }}>
        <div style={{ border: '1px solid var(--leaf-border-soft)', background: 'rgba(255,255,255,0.74)', borderRadius: 18, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase' as const, color: 'var(--leaf-text-muted)', padding: '0 2px 8px' }}>
            Properties
          </div>
          {propertyRows.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', padding: '2px 4px' }}>
              No properties yet
            </div>
          ) : propertyRows.map((row) => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 4px', fontSize: 11.5 }}>
              <div style={{ width: 72, flexShrink: 0, color: 'var(--leaf-text-muted)', fontSize: 11 }}>{row.key}</div>
              <div style={{ color: 'var(--leaf-text-title)', flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Array.isArray(row.value)
                  ? row.value.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10,
                        background: 'var(--color-tag-bg)',
                        color: 'var(--color-tag-text)',
                        borderRadius: 999,
                        padding: '1px 6px',
                        border: '1px solid var(--color-tag-border)',
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

        <div style={{ border: '1px solid var(--leaf-border-soft)', background: 'rgba(255,255,255,0.74)', borderRadius: 18, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase' as const, color: 'var(--leaf-text-muted)', padding: '0 2px 8px' }}>
            Overview
          </div>
          <div
            onClick={() => window.dispatchEvent(new CustomEvent('leaf-focus-header-field', { detail: 'description' }))}
            style={{
              fontSize: 12,
              color: 'var(--leaf-text-body)',
              lineHeight: 1.65,
              padding: '2px 4px',
              cursor: identity ? 'pointer' : 'default',
            }}
          >
            {identity?.description || 'No description yet'}
          </div>
        </div>

        <div style={{ border: '1px solid var(--leaf-border-soft)', background: 'rgba(255,255,255,0.74)', borderRadius: 18, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase' as const, color: 'var(--leaf-text-muted)', padding: '0 2px 8px' }}>
            Outline
          </div>
          {outline.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', padding: '2px 4px' }}>
              No headings yet
            </div>
          ) : (
            <div style={{ borderLeft: '1px solid var(--leaf-border-strong)', marginLeft: 8 }}>
              {outline.map((item, index) => (
                <div key={item.id} style={{ position: 'relative' }}>
                  {index === 0 ? (
                    <div style={{ position: 'absolute', left: -4, top: 12, width: 6, height: 6, borderRadius: 999, background: 'var(--leaf-green)' }} />
                  ) : null}
                  <div
                    style={{
                      padding: '4px 0 4px 12px',
                      fontSize: item.level === 1 ? 13 : 11.5,
                      color: item.level === 1 ? 'var(--leaf-text-title)' : 'var(--leaf-text-body)',
                      marginLeft: item.level === 1 ? 0 : item.level === 2 ? 10 : 18,
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: '1px solid var(--leaf-border-soft)', background: 'rgba(255,255,255,0.74)', borderRadius: 18, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase' as const, color: 'var(--leaf-text-muted)', padding: '0 2px 8px' }}>
            Backlinks
          </div>
          {backlinks.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)', padding: '2px 4px' }}>
              No linked mentions yet
            </div>
          ) : backlinks.map((item) => (
            <Link
              key={item.id}
              href={`/editor/${item.id}`}
              onClick={() => startNavigation()}
              style={{
                display: 'block',
                padding: '10px 10px',
                borderRadius: 12,
                fontSize: 11.5,
                color: 'var(--leaf-text-body)',
                background: '#fff',
                border: '1px solid var(--leaf-border-strong)',
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--leaf-text-title)', marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: 'var(--leaf-text-muted)', lineHeight: 1.55 }}>
                {item.snippet}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}
