'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import type { LeafIcon as LeafIconValue } from '@/lib/api'
import { TagsInput } from '@/components/editor/TagsInput'
import { DatabaseIcon, LeafIcon, type LeafShapeIcon, ShapeIcon } from '@/components/Icons'
import { useEffect, useRef } from 'react'

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
}: Props) {
  const canEditDescription = typeof onDescriptionChange === 'function'
  const canEditTags = Array.isArray(tags) && typeof onTagsChange === 'function'
  const iconButtonRef = useRef<HTMLButtonElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event as CustomEvent<'icon' | 'title' | 'description'>).detail
      if (target === 'icon') iconButtonRef.current?.focus()
      if (target === 'title') titleInputRef.current?.focus()
      if (target === 'description') descriptionInputRef.current?.focus()
    }

    window.addEventListener('leaf-focus-header-field', handler)
    return () => window.removeEventListener('leaf-focus-header-field', handler)
  }, [])

  return (
    <div
      style={{
        padding: '28px 0 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--leaf-border-soft)',
      }}
    >
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
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
              border: '2px solid #fff',
              pointerEvents: 'none',
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 1V7M1 4H7" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {iconPicker ?? null}

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

      {description !== undefined && (
        <input
          ref={descriptionInputRef}
          className="bg-transparent border-none outline-none"
          style={{
            fontSize: 14,
            color: description ? 'var(--leaf-text-body)' : 'var(--leaf-text-hint)',
            marginTop: 6,
            maxWidth: 680,
            width: '100%',
            lineHeight: 1.6,
            caretColor: canEditDescription ? 'var(--leaf-green)' : undefined,
            cursor: canEditDescription ? 'text' : 'default',
          }}
          value={description}
          onChange={(event) => onDescriptionChange?.(event.target.value)}
          onBlur={(event) => onDescriptionBlur?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              ;(event.target as HTMLInputElement).blur()
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
