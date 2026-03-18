'use client'

import Link from 'next/link'
import { DatabaseIcon, LeafIcon } from './Icons'
import type { TreeNode } from './sidebarTreeUtils'

type SidebarTreeRowProps = {
  node: TreeNode
  depth: number
  activeId?: string
  renameId: string | null
  renameValue: string
  setRenameValue: (value: string) => void
  draggedId: string | null
  dropTargetId: string | null
  hoverNodeId: string | null
  creatingChildOf: string | null
  isExpanded: boolean
  onToggle: (id: string) => void
  onRename: (id: string, value: string) => void
  onNavigate: () => void
  onWarmRoute: (kind: 'page' | 'database') => void
  onHoverChange: (id: string | null) => void
  onContextMenu: (args: { id: string; kind: 'page' | 'database'; x: number; y: number }) => void
  onCreateChild: (parentId: string) => void
  onDragStart: (event: React.DragEvent, node: TreeNode) => void
  onDragOver: (event: React.DragEvent, node: TreeNode) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent, node: TreeNode) => void
}

export function SidebarTreeRow({
  node,
  depth,
  activeId,
  renameId,
  renameValue,
  setRenameValue,
  draggedId,
  dropTargetId,
  hoverNodeId,
  creatingChildOf,
  isExpanded,
  onToggle,
  onRename,
  onNavigate,
  onWarmRoute,
  onHoverChange,
  onContextMenu,
  onCreateChild,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: SidebarTreeRowProps) {
  const isActive = node.id === activeId
  const hasChildren = node.children.length > 0
  const isEditing = renameId === node.id
  const isDropTarget = dropTargetId === node.id
  const isHovered = hoverNodeId === node.id
  const isDatabase = node.kind === 'database'
  const href = isDatabase ? `/databases/${node.id}` : `/editor/${node.id}`

  return (
    <div
      className={[
        'flex items-center gap-1 pr-1 rounded-md text-sm group transition-colors duration-150',
        draggedId === node.id ? 'opacity-40' : '',
        isDropTarget ? 'ring-1 ring-leaf-500' : '',
      ].join(' ')}
      style={{
        paddingLeft: 8 + depth * 14,
        backgroundColor: isActive ? 'var(--color-active)' : undefined,
        color: isActive ? 'var(--color-text-dark)' : 'var(--color-text-body)',
      }}
      onMouseEnter={(event) => {
        onHoverChange(node.id)
        if (!isActive) event.currentTarget.style.backgroundColor = 'var(--color-hover)'
      }}
      onMouseLeave={(event) => {
        onHoverChange(null)
        if (!isActive) event.currentTarget.style.backgroundColor = ''
      }}
      draggable={!isDatabase}
      onDragStart={(event) => onDragStart(event, node)}
      onDragOver={(event) => onDragOver(event, node)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, node)}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu({ id: node.id, kind: node.kind, x: event.clientX, y: event.clientY })
      }}
    >
      <button
        type="button"
        onClick={() => hasChildren && onToggle(node.id)}
        className="w-4 h-4 flex items-center justify-center shrink-0 transition-transform duration-200"
        style={{
          color: 'var(--color-text-muted)',
          transform: hasChildren && isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
      >
        {hasChildren ? (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ) : null}
      </button>

      <span className="shrink-0" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
        {isDatabase ? <DatabaseIcon size={13} /> : <LeafIcon size={13} />}
      </span>

      {isEditing ? (
        <input
          autoFocus
          className="flex-1 min-w-0 rounded px-1 py-0.5 text-sm focus:outline-none"
          style={{ background: '#fff', border: '1px solid var(--color-border)' }}
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onBlur={() => onRename(node.id, renameValue)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onRename(node.id, renameValue)
          }}
        />
      ) : (
        <Link
          href={href}
          className="flex-1 truncate py-1 text-sm"
          style={{ fontWeight: isActive ? 500 : 400 }}
          onClick={(event) => {
            if (renameId) {
              event.preventDefault()
              return
            }
            onNavigate()
          }}
          onMouseEnter={() => onWarmRoute(node.kind)}
        >
          {node.title || 'Untitled'}
        </Link>
      )}

      {isHovered && !isEditing && !isDatabase && (
        <button
          type="button"
          title="Add sub-page"
          disabled={creatingChildOf === node.id}
          onClick={(event) => { event.stopPropagation(); onCreateChild(node.id) }}
          className="w-5 h-5 flex items-center justify-center rounded text-sm leading-none shrink-0 transition-colors duration-150"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(event) => (event.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={(event) => (event.currentTarget.style.color = 'var(--color-text-muted)')}
        >
          +
        </button>
      )}
    </div>
  )
}
