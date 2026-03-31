'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback, useMemo, useState } from 'react'
import { LinkCardEditDialog } from '@/components/editor/LinkCardEditDialog'

function displayDomain(href: string): string {
  const u = href.trim()
  if (!u) return ''
  try {
    const parsed = new URL(u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return u.length > 40 ? `${u.slice(0, 37)}…` : u
  }
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M2 8h12M8 2c2 2.5 2 11.5 0 14M8 2c-2 2.5-2 11.5 0 14" />
    </svg>
  )
}

function ImagePlaceholder() {
  return (
    <div className="flex h-full min-h-[100px] w-full flex-col items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--leaf-text-hint)' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M21 17l-5-5-4 4-3-3-4 4" />
      </svg>
      <span>Image</span>
    </div>
  )
}

export function LinkCardView({ node, updateAttributes, selected }: NodeViewProps) {
  const url = (node.attrs.url as string) || ''
  const title = (node.attrs.title as string) || 'Link'
  const description = (node.attrs.description as string) || ''
  const image = (node.attrs.image as string) || ''

  const [editOpen, setEditOpen] = useState(false)

  const domain = useMemo(() => displayDomain(url), [url])

  const openEdit = useCallback(() => setEditOpen(true), [])

  const handleSave = useCallback(
    (next: { url: string; title: string; description: string; image: string }) => {
      updateAttributes(next)
      setEditOpen(false)
    },
    [updateAttributes],
  )

  return (
    <NodeViewWrapper className="leaf-link-card-node my-3">
      <div
        className={`overflow-hidden rounded-xl border transition-shadow ${selected ? 'ring-2 ring-[var(--leaf-green)]' : ''}`}
        style={{
          borderColor: 'var(--leaf-border-soft)',
          background: 'var(--leaf-bg-elevated)',
          boxShadow: '0 4px 24px color-mix(in srgb, var(--foreground) 8%, transparent), 0 1px 3px color-mix(in srgb, var(--foreground) 5%, transparent)',
        }}
      >
        <div className="flex flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
            <a
              href={url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[15px] font-semibold leading-snug hover:underline"
              style={{ color: 'var(--leaf-text-title)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {title || url || 'Untitled link'}
            </a>
            {description ? (
              <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--leaf-text-muted)' }}>
                {description}
              </p>
            ) : null}
            {domain ? (
              <div className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: 'var(--leaf-text-hint)' }}>
                <GlobeIcon />
                <span className="truncate">{domain}</span>
              </div>
            ) : null}
            {selected ? (
              <button
                type="button"
                className="mt-1 self-start rounded-lg px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--leaf-db-chrome-hover)', color: 'var(--leaf-text-body)' }}
                onClick={openEdit}
              >
                Edit card
              </button>
            ) : null}
          </div>
          <div
            className="flex w-[min(34%,148px)] shrink-0 items-stretch border-l sm:min-h-[112px]"
            style={{
              borderColor: 'var(--leaf-border-soft)',
              background: 'color-mix(in srgb, var(--leaf-text-title) 4%, var(--leaf-bg-app))',
            }}
          >
            {image ? (
              <div className="relative min-h-[100px] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <ImagePlaceholder />
            )}
          </div>
        </div>
      </div>

      <LinkCardEditDialog
        open={editOpen}
        heading="Edit bookmark"
        initial={{ url, title, description, image }}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
    </NodeViewWrapper>
  )
}
