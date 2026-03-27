'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback, useRef } from 'react'

const MAX_W = 900
const MIN_W = 64

export function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string) || ''
  const width = node.attrs.width as number | null | undefined
  const imgRef = useRef<HTMLImageElement>(null)

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      const startX = e.clientX
      const startW = width || imgRef.current?.offsetWidth || 320
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const next = Math.min(MAX_W, Math.max(MIN_W, startW + dx))
        updateAttributes({ width: Math.round(next) })
      }
      const onUp = (ev: PointerEvent) => {
        ;(e.target as HTMLElement).releasePointerCapture(ev.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [width, updateAttributes],
  )

  const displayW = width && width > 0 ? Math.min(width, MAX_W) : undefined

  return (
    <NodeViewWrapper className="leaf-image-node my-2">
      <div
        className={`relative inline-block max-w-full ${selected ? 'rounded-md ring-2 ring-[var(--leaf-green)]' : ''}`}
        style={{ maxWidth: MAX_W }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className="block h-auto max-w-full rounded-md border"
          style={{ width: displayW, borderColor: 'var(--leaf-border-soft)' }}
          draggable={false}
        />
        {selected ? (
          <button
            type="button"
            className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-se-resize rounded-sm border bg-[var(--leaf-bg-elevated)] text-[10px] leading-none opacity-90"
            style={{ borderColor: 'var(--leaf-border-strong)' }}
            onPointerDown={startResize}
            aria-label="Resize image"
          >
            ◢
          </button>
        ) : null}
      </div>
    </NodeViewWrapper>
  )
}
