/**
 * Leaf UI: “Move to…” destination picker (`frontend/src/components/SidebarMoveTargetDialog.tsx`).
 *
 * Purpose:
 * - Modal opened from the sidebar context menu to reparent a page or database under a page (or top level).
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collectDescendantPageIds,
  sidebarPagePathLabel,
  type SidebarNode,
} from './sidebarTreeUtils'

export function SidebarMoveTargetDialog({
  source,
  nodes,
  onCancel,
  onConfirm,
}: {
  source: SidebarNode | null
  nodes: SidebarNode[]
  onCancel: () => void
  onConfirm: (targetPageSidebarId: string | null) => void
}) {
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!source) setFilter('')
  }, [source])

  useEffect(() => {
    if (!source) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [source, onCancel])

  const excluded = useMemo(() => {
    if (!source) return new Set<string>()
    if (source.kind === 'database') return new Set<string>()
    if (source.isDbRow) return new Set<string>()
    const ex = collectDescendantPageIds(source.id, nodes)
    ex.add(source.id)
    return ex
  }, [source, nodes])

  const candidates = useMemo(() => {
    if (!source) return []
    const pages = nodes.filter(
      (n) => n.kind === 'page' && !n.isDbRow && !excluded.has(n.id),
    )
    const q = filter.trim().toLowerCase()
    return pages
      .map((n) => ({
        node: n,
        label: sidebarPagePathLabel(n.id, nodes),
      }))
      .filter(({ label }) => !q || label.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [nodes, source, excluded, filter])

  if (!source) return null
  if (source.kind === 'page' && source.isDbRow) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/25" onClick={onCancel} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="sidebar-move-to-title"
        className="relative flex max-h-[min(28rem,85vh)] w-full max-w-md flex-col gap-3 rounded-xl border p-5 shadow-lg"
        style={{
          borderColor: 'var(--leaf-border-strong)',
          boxShadow: 'var(--leaf-shadow-soft)',
          background: 'var(--leaf-bg-elevated)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sidebar-move-to-title" className="text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
          Move to…
        </h2>
        <p className="truncate text-xs" style={{ color: 'var(--leaf-text-muted)' }} title={source.title}>
          {source.title}
        </p>
        <input
          autoFocus
          type="search"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--leaf-border-strong)', color: 'var(--color-text-body)' }}
          placeholder="Filter pages…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors"
          style={{
            borderColor: 'var(--leaf-border-strong)',
            color: 'var(--color-text-body)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
          onClick={() => onConfirm(null)}
        >
          Top level
        </button>
        <ul
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-lg border p-1 text-sm"
          style={{ borderColor: 'var(--leaf-border-strong)' }}
        >
          {candidates.length === 0 ? (
            <li className="px-2 py-2 text-xs" style={{ color: 'var(--leaf-text-muted)' }}>
              {filter.trim() ? 'No matching pages.' : 'No other pages.'}
            </li>
          ) : (
            candidates.map(({ node, label }) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left transition-colors"
                  style={{ color: 'var(--color-text-body)' }}
                  title={label}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  onClick={() => onConfirm(node.id)}
                >
                  {label}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex justify-end">
          <button
            type="button"
            className="px-3 py-1.5 text-sm"
            style={{ color: 'var(--leaf-text-muted)' }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
