/**
 * Leaf UI: page/database identity header (`frontend/src/components/page/PageIdentityHeader.tsx`).
 *
 * Purpose:
 * - Provides the editor/table header UI for:
 *   - title input
 *   - optional description input
 *   - optional tags input
 *   - icon display + icon picker slot
 *   - optional extra content area
 *
 * How to read:
 * - The component is highly controlled via props:
 *   - `title`, `onTitleChange`, `onTitleBlur`, `onTitleEnter`
 *   - `description` + change/blur handlers (presence indicates editability)
 *   - `tags` + onTagsChange (presence indicates editability)
 *   - `iconPicker` is injected by the route page when open.
 * - There’s also a focus-bridge:
 *   - listens to `window` events (`leaf-focus-header-field`) to focus icon/title/description inputs.
 *
 * Update:
 * - To add fields, add new props + local refs and wire them similarly.
 * - To change focus behavior, update the event listener and detail keys.
 *
 * Debug:
 * - If title blur doesn’t save, confirm route passes correct `onTitleBlur` and that
 *   input `onBlur` calls it with `event.target.value`.
 * - If icon click doesn’t open picker, ensure `onIconClick` is provided.
 */


'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import type { LeafHeaderBanner, LeafIcon as LeafIconValue } from '@/lib/api'
import { TagsInput } from '@/components/editor/TagsInput'
import { DatabaseIcon, LeafIcon, type LeafShapeIcon, ShapeIcon } from '@/components/Icons'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  kind: 'page' | 'database'
  icon?: LeafIconValue | null
  title: string
  onTitleChange: (value: string) => void
  onTitleBlur?: (value: string) => void
  onTitleEnter?: () => void
  titlePlaceholder?: string
  description?: string
  onDescriptionChange?: (value: string) => void
  onDescriptionBlur?: (value: string) => void
  descriptionPlaceholder?: string
  tags?: string[]
  onTagsChange?: (tags: string[]) => void
  onIconClick?: () => void
  iconPicker?: ReactNode
  extraContent?: ReactNode
  showTags?: boolean
  /** Optional cover image (stored on leaf `properties.headerBanner`). */
  headerBanner?: LeafHeaderBanner | null
  onHeaderBannerChange?: (next: LeafHeaderBanner | null) => void
  /** With `kind="database"`, title becomes a control that opens rename + delete (Notion-style). */
  databaseMenu?: { onDelete: () => void }
}

function parseObjectPosition(pos: string | undefined): { x: number; y: number } {
  if (!pos || typeof pos !== 'string') return { x: 50, y: 50 }
  const m = pos.trim().match(/^([\d.]+)%\s+([\d.]+)%$/)
  if (m) {
    return {
      x: Math.max(0, Math.min(100, parseFloat(m[1]))),
      y: Math.max(0, Math.min(100, parseFloat(m[2]))),
    }
  }
  return { x: 50, y: 50 }
}

function formatObjectPosition(f: { x: number; y: number }): string {
  return `${Math.round(f.x)}% ${Math.round(f.y)}%`
}

function HeaderBannerEditor({
  banner,
  onChange,
}: {
  banner: LeafHeaderBanner | null
  onChange: (next: LeafHeaderBanner | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const focalRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 })
  const [local, setLocal] = useState<{ x: number; y: number }>(() => parseObjectPosition(banner?.objectPosition))

  useEffect(() => {
    const p = parseObjectPosition(banner?.objectPosition)
    focalRef.current = p
    setLocal(p)
  }, [banner?.objectPosition, banner?.src])

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!banner?.src || !boxRef.current) return
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const fx = focalRef.current.x
      const fy = focalRef.current.y
      const src = banner.src

      const onMove = (e: PointerEvent) => {
        const r = boxRef.current!.getBoundingClientRect()
        const dx = ((e.clientX - startX) / Math.max(r.width, 1)) * 100
        const dy = ((e.clientY - startY) / Math.max(r.height, 1)) * 100
        const next = {
          x: Math.max(0, Math.min(100, fx - dx)),
          y: Math.max(0, Math.min(100, fy - dy)),
        }
        focalRef.current = next
        setLocal(next)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        onChange({ src, objectPosition: formatObjectPosition(focalRef.current) })
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [banner?.src, onChange],
  )

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result ?? '')
      if (src) {
        setLocal({ x: 50, y: 50 })
        onChange({ src, objectPosition: '50% 50%' })
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div style={{ width: '100%' }}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {banner?.src ? (
        <div
          ref={boxRef}
          className="group relative overflow-hidden"
          style={{
            width: '100%',
            height: 200,
            cursor: 'grab',
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          title="Drag to reposition the visible area"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.src}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-cover"
            style={{ objectPosition: formatObjectPosition(local) }}
          />
          {/* Hover controls */}
          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
              className="rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-sm"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              Change cover
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              className="rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-sm"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div style={{ paddingTop: 8 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-md px-2 py-1 text-xs transition-opacity opacity-0 hover:opacity-100"
            style={{ color: 'var(--leaf-text-muted)' }}
          >
            + Add cover image
          </button>
        </div>
      )}
    </div>
  )
}

function DefaultHeaderIcon({ kind }: { kind: 'page' | 'database' }) {
  return kind === 'database' ? <DatabaseIcon size={26} /> : <LeafIcon size={26} />
}

function HeaderIcon({
  kind,
  icon,
}: {
  kind: 'page' | 'database'
  icon?: LeafIconValue | null
}) {
  if (icon?.type === 'emoji' && icon.value) {
    return <span style={{ fontSize: 28, lineHeight: 1 }}>{icon.value}</span>
  }

  if (icon?.type === 'image' && icon.value) {
    return (
      <Image
        src={icon.value}
        alt=""
        width={52}
        height={52}
        unoptimized
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
      />
    )
  }

  if (icon?.type === 'svg' && icon.value && icon.value !== 'leaf') {
    return <ShapeIcon shape={icon.value as LeafShapeIcon} size={28} />
  }

  return <DefaultHeaderIcon kind={kind} />
}

export function PageIdentityHeader({
  kind,
  icon,
  title,
  onTitleChange,
  onTitleBlur,
  onTitleEnter,
  titlePlaceholder = '',
  description,
  onDescriptionChange,
  onDescriptionBlur,
  descriptionPlaceholder = 'Add a description...',
  tags,
  onTagsChange,
  onIconClick,
  iconPicker,
  extraContent,
  showTags = true,
  headerBanner,
  onHeaderBannerChange,
  databaseMenu,
}: Props) {
  const canEditDescription = typeof onDescriptionChange === 'function'
  const canEditTags = Array.isArray(tags) && typeof onTagsChange === 'function'
  const canEditBanner = typeof onHeaderBannerChange === 'function'
  const iconButtonRef = useRef<HTMLButtonElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titlePopoverInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const dbTitleWrapRef = useRef<HTMLDivElement>(null)
  const [dbTitleMenuOpen, setDbTitleMenuOpen] = useState(false)
  const titleLiveRef = useRef(title)
  titleLiveRef.current = title

  const useDbTitlePopover = kind === 'database' && Boolean(databaseMenu)

  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event as CustomEvent<'icon' | 'title' | 'description'>).detail
      if (target === 'icon') iconButtonRef.current?.focus()
      if (target === 'title') {
        if (useDbTitlePopover) setDbTitleMenuOpen(true)
        else titleInputRef.current?.focus()
      }
      if (target === 'description') descriptionInputRef.current?.focus()
    }

    window.addEventListener('leaf-focus-header-field', handler)
    return () => window.removeEventListener('leaf-focus-header-field', handler)
  }, [useDbTitlePopover])

  useEffect(() => {
    if (!useDbTitlePopover || !dbTitleMenuOpen) return
    titlePopoverInputRef.current?.focus()
    titlePopoverInputRef.current?.select()
  }, [useDbTitlePopover, dbTitleMenuOpen])

  useEffect(() => {
    if (!useDbTitlePopover) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (dbTitleWrapRef.current && !dbTitleWrapRef.current.contains(e.target as Node)) {
        setDbTitleMenuOpen(false)
        onTitleBlur?.(titleLiveRef.current)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [useDbTitlePopover, onTitleBlur])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--leaf-border-soft)',
      }}
    >
      {/* Cover image — full-width above everything */}
      {canEditBanner ? (
        <HeaderBannerEditor banner={headerBanner ?? null} onChange={onHeaderBannerChange!} />
      ) : headerBanner?.src ? (
        <div
          className="overflow-hidden"
          style={{ width: '100%', height: 200 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={headerBanner.src}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: headerBanner.objectPosition ?? '50% 50%' }}
          />
        </div>
      ) : null}

      <div style={{ position: 'relative', display: 'inline-block', marginTop: headerBanner?.src ? 16 : 28, marginBottom: 14 }}>
        <button
          ref={iconButtonRef}
          type="button"
          onClick={onIconClick}
          disabled={!onIconClick}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--leaf-bg-tag)',
            border: '1px solid var(--leaf-border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            color: 'var(--leaf-text-title)',
            cursor: onIconClick ? 'pointer' : 'default',
          }}
        >
          <HeaderIcon kind={kind} icon={icon} />
        </button>
        {onIconClick && (
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 16,
              height: 16,
              background: 'var(--leaf-green)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--leaf-bg-editor)',
              pointerEvents: 'none',
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 1V7M1 4H7" stroke="var(--leaf-on-accent)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {iconPicker ?? null}

      {useDbTitlePopover && databaseMenu ? (
        <div ref={dbTitleWrapRef} className="relative w-full" style={{ maxWidth: 680 }}>
          <button
            type="button"
            className="w-full bg-transparent text-left font-medium leading-tight outline-none transition-opacity hover:opacity-90"
            style={{
              fontSize: 30,
              fontWeight: 500,
              color: 'var(--leaf-text-title)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              cursor: 'pointer',
            }}
            onClick={() => setDbTitleMenuOpen((open) => !open)}
          >
            {title || titlePlaceholder}
          </button>
          {dbTitleMenuOpen ? (
            <div
              className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] max-w-md rounded-xl border p-3 shadow-lg"
              style={{
                background: 'var(--leaf-bg-elevated)',
                borderColor: 'var(--leaf-border-strong)',
                boxShadow: 'var(--leaf-shadow-soft)',
              }}
            >
              <div className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--leaf-text-muted)' }}>
                Database name
              </div>
              <input
                ref={titlePopoverInputRef}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--leaf-border-strong)',
                  background: 'var(--leaf-bg-subtle)',
                  color: 'var(--leaf-text-title)',
                  caretColor: 'var(--leaf-green)',
                }}
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                onBlur={(event) => onTitleBlur?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onTitleEnter?.()
                    ;(event.target as HTMLInputElement).blur()
                    setDbTitleMenuOpen(false)
                  }
                  if (event.key === 'Escape') setDbTitleMenuOpen(false)
                }}
                placeholder={titlePlaceholder}
              />
              <button
                type="button"
                className="mt-3 w-full rounded-lg px-2 py-2 text-left text-[13px] transition-colors"
                style={{ color: '#dc2626' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--leaf-db-chrome-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                onClick={() => {
                  databaseMenu.onDelete()
                  setDbTitleMenuOpen(false)
                }}
              >
                Delete database…
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <input
          ref={titleInputRef}
          className="bg-transparent border-none outline-none font-medium leading-tight"
          style={{
            fontSize: 30,
            fontWeight: 500,
            color: 'var(--leaf-text-title)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            width: '100%',
            maxWidth: 680,
            caretColor: 'var(--leaf-green)',
          }}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={(event) => onTitleBlur?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onTitleEnter?.()
              ;(event.target as HTMLInputElement).blur()
            }
          }}
          placeholder={titlePlaceholder}
        />
      )}

      {description !== undefined && (
        <textarea
          ref={descriptionInputRef}
          className="bg-transparent border-none outline-none resize-none"
          rows={1}
          style={{
            fontSize: 14,
            color: description ? 'var(--leaf-text-body)' : 'var(--leaf-text-hint)',
            marginTop: 6,
            maxWidth: 680,
            width: '100%',
            lineHeight: 1.6,
            overflow: 'hidden',
            caretColor: canEditDescription ? 'var(--leaf-green)' : undefined,
            cursor: canEditDescription ? 'text' : 'default',
            ...({ fieldSizing: 'content' } as Record<string, string>),
          }}
          value={description}
          onChange={(event) => onDescriptionChange?.(event.target.value)}
          onBlur={(event) => onDescriptionBlur?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              ;(event.target as HTMLTextAreaElement).blur()
            }
          }}
          readOnly={!canEditDescription}
          placeholder={descriptionPlaceholder}
        />
      )}

      {extraContent ? <div style={{ marginTop: 10 }}>{extraContent}</div> : null}

      {showTags && canEditTags && (
        <div style={{ marginTop: 10 }}>
          <TagsInput tags={tags} onChange={onTagsChange} />
        </div>
      )}
    </div>
  )
}
