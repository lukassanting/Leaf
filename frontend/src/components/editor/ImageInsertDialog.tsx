'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Max size for data-URL embeds (keeps documents and sync payloads reasonable). */
export const IMAGE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (src: string, alt: string) => void
}

export function ImageInsertDialog({ open, onClose, onInsert }: Props) {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setUrl('')
    setAlt('')
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      setError(`Image must be under ${Math.round(IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024))} MB.`)
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setUrl(result)
      }
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsDataURL(file)
  }, [])

  const handleInsert = useCallback(() => {
    const src = url.trim()
    if (!src) {
      setError('Add an image URL or upload a file.')
      return
    }
    onInsert(src, alt.trim())
  }, [url, alt, onInsert])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-none bg-black/40 p-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaf-image-insert-title"
        className="relative w-full max-w-md rounded-xl border p-4 shadow-lg"
        style={{
          background: 'var(--leaf-bg-elevated)',
          borderColor: 'var(--leaf-border-strong)',
          boxShadow: '0 8px 32px color-mix(in srgb, var(--foreground) 12%, transparent)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="leaf-image-insert-title" className="mb-3 text-sm font-semibold" style={{ color: 'var(--leaf-text-body)' }}>
          Insert image
        </h2>

        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>
          Image URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null) }}
          placeholder="https://…"
          className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          style={{
            background: 'var(--leaf-bg-app)',
            borderColor: 'var(--leaf-border-soft)',
            color: 'var(--leaf-text-body)',
          }}
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-90"
            style={{
              borderColor: 'var(--leaf-border-strong)',
              color: 'var(--leaf-text-body)',
              background: 'var(--leaf-bg-app)',
            }}
          >
            Upload from device
          </button>
          <span className="text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
            PNG, JPEG, GIF, WebP · max {Math.round(IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024))} MB
          </span>
        </div>

        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>
          Alt text (optional)
        </label>
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Describe the image for accessibility"
          className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          style={{
            background: 'var(--leaf-bg-app)',
            borderColor: 'var(--leaf-border-soft)',
            color: 'var(--leaf-text-body)',
          }}
        />

        {error ? (
          <p className="mb-3 text-[12px]" style={{ color: 'var(--leaf-red, #ef4444)' }}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{ borderColor: 'var(--leaf-border-strong)', color: 'var(--leaf-text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white"
            style={{ background: 'var(--leaf-green)' }}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}
