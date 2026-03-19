'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

function SectionHeader({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-2 pt-1">
      {icon && <span style={{ color: 'var(--leaf-text-muted)' }}>{icon}</span>}
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--leaf-text-muted)',
        }}
      >
        {children}
      </span>
    </div>
  )
}

export function Sidebar({ activeId }: { activeId?: string }) {
  const pathname = usePathname()
  const { startNavigation } = useNavigationProgress()
  const [identity, setIdentity] = useState<SidebarIdentityData | null>(null)
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [isPinned, setIsPinned] = useState(false)

  // Load pin state when activeId changes
  useEffect(() => {
    if (!activeId) { setIsPinned(false); return }
    try {
      const pins: string[] = JSON.parse(localStorage.getItem('leaf-quick-access-pins') || '[]')
      setIsPinned(pins.includes(activeId))
    } catch {
      setIsPinned(false)
    }
  }, [activeId])

  const togglePin = useCallback(() => {
    if (!activeId || !identity) return
    try {
      const pins: string[] = JSON.parse(localStorage.getItem('leaf-quick-access-pins') || '[]')
      let nextPins: string[]
      if (pins.includes(activeId)) {
        nextPins = pins.filter((id) => id !== activeId)
      } else {
        nextPins = [...pins, activeId]
      }
      localStorage.setItem('leaf-quick-access-pins', JSON.stringify(nextPins))
      setIsPinned(!isPinned)
      window.dispatchEvent(new CustomEvent('leaf-quick-access-changed'))
    } catch {
      // ignore
    }
  }, [activeId, identity, isPinned])

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

  const metadataRows = useMemo(() => {
    if (!identity) return []
    const rows: { key: string; value: string | string[]; type?: string }[] = []
    if (identity.createdAt) {
      rows.push({
        key: 'Created',
        value: new Date(identity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      })
    }
    if (identity.tags?.length) rows.push({ key: 'Tags', value: identity.tags, type: 'tags' })
    return rows
  }, [identity])

  return (
    <aside
      className="hidden shrink-0 border-l md:flex md:flex-col"
      style={{
        width: 280,
        minWidth: 280,
        background: 'var(--leaf-bg-sidebar)',
        borderLeftColor: 'var(--leaf-border-strong)',
      }}
    >
      {/* Page Info header */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--leaf-border-soft)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--leaf-text-title)' }}>
          Page Info
        </div>
      </div>

      {/* Pin to Quick Access */}
      {activeId && identity && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--leaf-border-soft)' }}>
          <button
            type="button"
            onClick={togglePin}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
            style={{
              fontSize: 12,
              color: isPinned ? 'var(--leaf-green)' : 'var(--leaf-text-body)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M9.5 2L13 5.5L10.5 8L11 11.5L4.5 5L8 5.5L9.5 2Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
                fill={isPinned ? 'currentColor' : 'none'}
              />
              <path d="M5.5 10.5L2.5 13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontWeight: 500 }}>{isPinned ? 'Pinned to Quick Access' : 'Pin to Quick Access'}</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px 18px' }}>
        {/* METADATA section */}
        <SectionHeader icon={
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 3H10M2 6H7M2 9H9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        }>
          Metadata
        </SectionHeader>

        <div style={{ marginBottom: 16 }}>
          {metadataRows.length === 0 && !identity ? (
            <div style={{ fontSize: 12, color: 'var(--leaf-text-muted)', padding: '2px 4px' }}>
              Select a page
            </div>
          ) : (
            <>
              {metadataRows.map((row) => (
                <div key={row.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 2px', fontSize: 12 }}>
                  <div style={{ width: 64, flexShrink: 0, color: 'var(--leaf-text-muted)', fontSize: 11.5 }}>{row.key}</div>
                  <div style={{ color: 'var(--leaf-text-title)', flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {row.type === 'tags' && Array.isArray(row.value)
                      ? row.value.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            background: 'var(--color-tag-bg)',
                            color: 'var(--color-tag-text)',
                            borderRadius: 4,
                            padding: '2px 8px',
                            border: '1px solid var(--color-tag-border)',
                          }}
                        >
                          {tag}
                        </span>
                      ))
                      : <span style={{ fontSize: 12, color: 'var(--leaf-text-body)' }}>{String(row.value)}</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Description */}
        {identity?.description ? (
          <div style={{ marginBottom: 16 }}>
            <SectionHeader icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
                <path d="M3.5 4H8.5M3.5 6H7M3.5 8H8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
              </svg>
            }>
              Description
            </SectionHeader>
            <div
              onClick={() => window.dispatchEvent(new CustomEvent('leaf-focus-header-field', { detail: 'description' }))}
              style={{
                fontSize: 12,
                color: 'var(--leaf-text-body)',
                lineHeight: 1.6,
                padding: '0 2px',
                cursor: identity ? 'pointer' : 'default',
              }}
            >
              {identity.description}
            </div>
          </div>
        ) : null}

        {/* PAGE OUTLINE section */}
        <div style={{ marginBottom: 16 }}>
          <SectionHeader icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
              <path d="M6 3.5V6.5L8 7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          }>
            Page Outline
          </SectionHeader>
          {outline.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--leaf-text-muted)', padding: '2px 4px' }}>
              No headings yet
            </div>
          ) : (
            <div style={{ marginLeft: 4 }}>
              {outline.map((item, index) => {
                const prefix = item.level === 1
                  ? `${index + 1}.`
                  : item.level === 2
                    ? `${index + 1}.1`
                    : `${index + 1}.1`

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-md px-1.5 py-1 transition-colors duration-150"
                    style={{
                      marginLeft: item.level === 1 ? 0 : item.level === 2 ? 12 : 24,
                      cursor: 'default',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                  >
                    {index === 0 ? (
                      <span
                        className="mt-1.5 shrink-0 rounded-full"
                        style={{ width: 6, height: 6, background: 'var(--leaf-green)' }}
                      />
                    ) : (
                      <span className="mt-1.5 shrink-0" style={{ width: 6 }} />
                    )}
                    <span
                      style={{
                        fontSize: item.level === 1 ? 12.5 : 12,
                        color: index === 0 ? 'var(--leaf-green)' : item.level === 1 ? 'var(--leaf-text-title)' : 'var(--leaf-text-body)',
                        fontWeight: item.level === 1 ? 500 : 400,
                        lineHeight: 1.5,
                      }}
                    >
                      {prefix} {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* LINKED MENTIONS section */}
        <div>
          <SectionHeader icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M5 7L3.5 8.5C2.9 9.1 2.9 9.1 3.5 9.7C4.1 10.3 4.1 10.3 4.7 9.7L6.5 7.9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M7 5L8.5 3.5C9.1 2.9 9.1 2.9 8.5 2.3C7.9 1.7 7.9 1.7 7.3 2.3L5.5 4.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M4.5 7.5L7.5 4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          }>
            Linked Mentions
          </SectionHeader>
          {backlinks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--leaf-text-muted)', padding: '2px 4px' }}>
              No linked mentions yet
            </div>
          ) : backlinks.map((item) => (
            <Link
              key={item.id}
              href={`/editor/${item.id}`}
              onClick={() => startNavigation()}
              className="block rounded-lg transition-colors duration-150"
              style={{
                padding: '8px 10px',
                fontSize: 12,
                color: 'var(--leaf-text-body)',
                background: 'rgba(255,255,255,0.7)',
                borderLeft: '3px solid var(--leaf-green)',
                marginBottom: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)' }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--leaf-text-title)', marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: 'var(--leaf-text-muted)', lineHeight: 1.5 }}>
                {item.snippet}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}
