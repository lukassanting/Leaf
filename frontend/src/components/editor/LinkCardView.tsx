'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback } from 'react'

export function LinkCardView({ node, updateAttributes, selected }: NodeViewProps) {
  const url = (node.attrs.url as string) || ''
  const title = (node.attrs.title as string) || 'Link'
  const description = (node.attrs.description as string) || ''
  const image = (node.attrs.image as string) || ''

  const editCard = useCallback(() => {
    if (typeof window === 'undefined') return
    const nextUrl = window.prompt('URL', url)
    if (nextUrl === null) return
    const nextTitle = window.prompt('Title', title)
    if (nextTitle === null) return
    const nextDesc = window.prompt('Description (optional)', description)
    if (nextDesc === null) return
    const nextImg = window.prompt('Image URL (optional)', image)
    if (nextImg === null) return
    updateAttributes({
      url: nextUrl.trim(),
      title: (nextTitle || 'Link').trim(),
      description: nextDesc.trim(),
      image: nextImg.trim(),
    })
  }, [url, title, description, image, updateAttributes])

  return (
    <NodeViewWrapper className="leaf-link-card-node my-3">
      <div
        className={`overflow-hidden rounded-xl border transition-shadow ${selected ? 'ring-2 ring-[var(--leaf-green)]' : ''}`}
        style={{
          borderColor: 'var(--leaf-border-soft)',
          background: 'var(--leaf-bg-elevated)',
          boxShadow: '0 1px 3px color-mix(in srgb, var(--foreground) 6%, transparent)',
        }}
      >
        <div className="flex flex-col gap-0 sm:flex-row">
          {image ? (
            <div className="relative h-28 w-full shrink-0 sm:h-auto sm:w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
            <a
              href={url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:underline"
              style={{ color: 'var(--leaf-text-title)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {title || url || 'Untitled link'}
            </a>
            {description ? (
              <p className="line-clamp-2 text-xs" style={{ color: 'var(--leaf-text-muted)' }}>{description}</p>
            ) : null}
            {url ? (
              <span className="truncate text-[11px]" style={{ color: 'var(--leaf-text-hint)' }}>{url}</span>
            ) : null}
            {selected ? (
              <button
                type="button"
                className="mt-1 self-start rounded px-2 py-1 text-[11px]"
                style={{ background: 'var(--leaf-db-chrome-hover)', color: 'var(--leaf-text-body)' }}
                onClick={editCard}
              >
                Edit card
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  )
}
