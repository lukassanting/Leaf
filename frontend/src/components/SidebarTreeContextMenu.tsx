'use client'

import type { SidebarNode } from './sidebarTreeUtils'

export function SidebarTreeContextMenu({
  contextNode,
  nodes,
  onClose,
  onStartRename,
  onDelete,
}: {
  contextNode: { id: string; kind: 'page' | 'database'; x: number; y: number } | null
  nodes: SidebarNode[]
  onClose: () => void
  onStartRename: (node: SidebarNode) => void
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
          background: '#fff',
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
