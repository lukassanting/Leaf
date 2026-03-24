/**
 * Leaf UI: sidebar tree row (`frontend/src/components/SidebarTreeRow.tsx`).
 *
 * Purpose:
 * - Renders a single navigation node (page or database) in the sidebar tree.
 * - Handles per-row UI behaviors:
 *   - expand/collapse toggle when the node has children
 *   - inline rename input (based on `renameId`)
 *   - drag-and-drop support for page reorder
 *   - context menu open on right-click
 *   - “+” create-child affordance for non-database nodes
 *
 * How to read:
 * - Props map directly to hook state/handlers from `useSidebarTreeModel`.
 * - Key derived booleans:
 *   - `isActive`, `isEditing`, `hasChildren`, `isDropTarget`, `isHovered`, `isDatabase`
 *
 * Update:
 * - If you add new node actions, you’ll likely need to:
 *   - extend props in this component
 *   - update `SidebarTreeContextMenu` and `useSidebarTreeModel`
 *
 * Debug:
 * - Drag/drop issues: verify row is marked `draggable={!isDatabase}` and
 *   that the correct handler functions are passed from the parent.
 * - Rename issues: confirm `onRename` fires on blur and Enter.
 */


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
  const isDbRow = node.isDbRow === true
  const href = isDatabase ? `/databases/${node.id}` : isDbRow ? `/databases/${node.database_id}?row=${node.id.replace('dbrow:', '')}` : `/editor/${node.id}`

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
      draggable={!isDatabase && !isDbRow}
      onDragStart={(event) => onDragStart(event, node)}
      onDragOver={(event) => onDragOver(event, node)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, node)}
      onContextMenu={(event) => {
        if (isDbRow) return
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
        {isDatabase ? <DatabaseIcon size={13} /> : isDbRow ? (
          <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1.5" y="2.5" width="10" height="8" rx="1" />
            <path d="M1.5 5h10M4 2.5v8" />
          </svg>
        ) : <LeafIcon size={13} />}
      </span>

      {isEditing ? (
        <input
          autoFocus
          className="flex-1 min-w-0 rounded px-1 py-0.5 text-sm focus:outline-none"
          style={{ background: 'var(--leaf-bg-elevated)', border: '1px solid var(--color-border)' }}
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
          onMouseEnter={() => onWarmRoute(isDbRow ? 'database' : node.kind)}
        >
          {node.title || 'Untitled'}
        </Link>
      )}

      {isHovered && !isEditing && !isDatabase && !isDbRow && (
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
