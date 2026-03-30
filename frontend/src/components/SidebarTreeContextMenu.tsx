/**
 * Leaf UI: sidebar tree context menu (`frontend/src/components/SidebarTreeContextMenu.tsx`).
 *
 * Purpose:
 * - Provides a right-click menu for sidebar nodes (rename/delete).
 * - Renders at the clicked screen coordinates (`contextNode.x/y`).
 *
 * How to read:
 * - It returns `null` when `contextNode` is null.
 * - The “Rename” action calls `onStartRename(node)` then closes.
 * - “Move to…” opens the destination picker (not shown for database row entries).
 * - The “Delete” action calls `onDelete(id, kind)` then closes.
 *
 * Update:
 * - To add more menu actions (e.g. create child), extend props and add more buttons.
 * - Keep the `onClose` behavior consistent so the overlay disappears correctly.
 *
 * Debug:
 * - If the menu doesn’t open, check:
 *   - `SidebarTreeRow` passes `onContextMenu` with correct `{x,y,id,kind}`
 *   - `contextNode` state in `useSidebarTreeModel` is updated.
 */


'use client'

import type { SidebarNode } from './sidebarTreeUtils'

export function SidebarTreeContextMenu({
  contextNode,
  nodes,
  onClose,
  onStartRename,
  onMoveTo,
  onDelete,
}: {
  contextNode: { id: string; kind: 'page' | 'database'; x: number; y: number } | null
  nodes: SidebarNode[]
  onClose: () => void
  onStartRename: (node: SidebarNode) => void
  onMoveTo: (node: SidebarNode) => void
  onDelete: (id: string, kind: 'page' | 'database') => void
}) {
  if (!contextNode) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed z-50 min-w-[130px] rounded-lg py-1 shadow-lg"
        style={{
          left: contextNode.x,
          top: contextNode.y,
          background: 'var(--leaf-bg-elevated)',
          border: '1px solid var(--color-border)',
        }}
      >
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left text-sm transition-colors duration-150"
          style={{ color: 'var(--color-text-body)' }}
          onMouseEnter={(event) => (event.currentTarget.style.backgroundColor = 'var(--color-hover)')}
          onMouseLeave={(event) => (event.currentTarget.style.backgroundColor = '')}
          onClick={() => {
            const node = nodes.find((item) => item.id === contextNode.id)
            if (node) onStartRename(node)
            onClose()
          }}
        >
          Rename
        </button>
        {(() => {
          const node = nodes.find((item) => item.id === contextNode.id)
          if (!node || node.isDbRow) return null
          return (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm transition-colors duration-150"
              style={{ color: 'var(--color-text-body)' }}
              onMouseEnter={(event) => (event.currentTarget.style.backgroundColor = 'var(--color-hover)')}
              onMouseLeave={(event) => (event.currentTarget.style.backgroundColor = '')}
              onClick={() => {
                onMoveTo(node)
                onClose()
              }}
            >
              Move to…
            </button>
          )
        })()}
        <button
          type="button"
          className="w-full px-3 py-1.5 text-left text-sm transition-colors duration-150"
          style={{ color: '#dc2626' }}
          onMouseEnter={(event) => (event.currentTarget.style.backgroundColor = 'var(--color-hover)')}
          onMouseLeave={(event) => (event.currentTarget.style.backgroundColor = '')}
          onClick={() => onDelete(contextNode.id, contextNode.kind)}
        >
          Delete
        </button>
      </div>
    </>
  )
}
