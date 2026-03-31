'use client'

import { useEffect, useState } from 'react'

export type LinkCardFormValues = {
  url: string
  title: string
  description: string
  image: string
}

type Props = {
  open: boolean
  heading?: string
  initial: LinkCardFormValues
  onClose: () => void
  onSave: (values: LinkCardFormValues) => void
}

export function LinkCardEditDialog({ open, heading = 'Edit bookmark', initial, onClose, onSave }: Props) {
  const [url, setUrl] = useState(initial.url)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [image, setImage] = useState(initial.image)

  useEffect(() => {
    if (!open) return
    setUrl(initial.url)
    setTitle(initial.title)
    setDescription(initial.description)
    setImage(initial.image)
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleSave = () => {
    const u = url.trim()
    if (!u) return
    onSave({
      url: u,
      title: (title.trim() || u).trim(),
      description: description.trim(),
      image: image.trim(),
    })
  }

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
        aria-labelledby="link-card-edit-heading"
        className="relative z-[1] w-full max-w-md overflow-hidden rounded-xl border shadow-xl"
        style={{
          background: 'var(--leaf-bg-elevated)',
          borderColor: 'var(--leaf-border-strong)',
          boxShadow: '0 20px 50px color-mix(in srgb, var(--foreground) 18%, transparent)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--leaf-border-soft)' }}>
          <h2 id="link-card-edit-heading" className="text-sm font-semibold" style={{ color: 'var(--leaf-text-title)' }}>
            {heading}
          </h2>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--leaf-bg-app)',
                borderColor: 'var(--leaf-border-soft)',
                color: 'var(--leaf-text-title)',
              }}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--leaf-bg-app)',
                borderColor: 'var(--leaf-border-soft)',
                color: 'var(--leaf-text-title)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-y rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--leaf-bg-app)',
                borderColor: 'var(--leaf-border-soft)',
                color: 'var(--leaf-text-title)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--leaf-text-muted)' }}>Image URL</span>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--leaf-bg-app)',
                borderColor: 'var(--leaf-border-soft)',
                color: 'var(--leaf-text-title)',
              }}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--leaf-border-soft)' }}>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ color: 'var(--leaf-text-muted)' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ background: 'var(--leaf-green)', color: 'var(--leaf-on-accent)' }}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
