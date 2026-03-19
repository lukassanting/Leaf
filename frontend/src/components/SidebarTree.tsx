/**
 * Leaf UI: sidebar tree view (`frontend/src/components/SidebarTree.tsx`).
 *
 * Purpose:
 * - Renders the hierarchical navigation tree of pages and databases.
 * - Supports:
 *   - expansion/collapse
 *   - search filtering
 *   - context menu actions (rename/delete/create child)
 *   - drag/drop reorder for pages
 *
 * How to read:
 * - This component is mostly UI wiring around `useSidebarTreeModel(activeId)`.
 * - It delegates all interaction handlers (rename/delete/reorder/etc.) to the hook.
 * - For row-level UI, it uses `SidebarTreeRow` and `SidebarTreeContextMenu`.
 *
 * Update:
 * - If you change the tree interaction model, update `useSidebarTreeModel` and then
 *   adjust the props/handler wiring here.
 * - If you add new node actions, update the context menu component and hook.
 *
 * Debug:
 * - If the tree is empty, check `useSidebarTreeModel` network/cache behavior.
 * - If drag/drop doesn’t work, verify the `onDragStart/onDragOver/onDrop`
 *   handlers are being passed to `SidebarTreeRow`.
 */


'use client'

import { SidebarTreeContextMenu } from './SidebarTreeContextMenu'
import { SidebarTreeRow } from './SidebarTreeRow'
import { useSidebarTreeModel } from '@/hooks/useSidebarTreeModel'
import { warmDatabaseRoute, warmEditorRoute } from '@/lib/warmEditorRoute'

export function SidebarTree({ activeId }: { activeId?: string }) {
  const {
    nodes,
    loading,
    networkError,
    search,
    setSearch,
    filteredFlat,
    expanded,
    toggle,
    collapseAll,
    contextNode,
    setContextNode,
    renameId,
    setRenameId,
    renameValue,
    setRenameValue,
    draggedId,
    dropTargetId,
    hoverNodeId,
    setHoverNodeId,
    creatingChildOf,
    handleRename,
    handleDelete,
    handleCreateChild,
    onDragStart,
    onDragOver,
    onDrop,
    setDropTargetId,
    startNavigation,
  } = useSidebarTreeModel(activeId)

  if (loading) {
    return <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
  }

  if (networkError) {
    return (
      <div className="px-3 py-2 text-xs rounded" style={{ color: '#92400e', background: '#fffbeb' }}>
        {networkError}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pb-1 space-y-1 shrink-0">
        <input
          type="search"
          placeholder="Search…"
          className="w-full rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1"
          style={{
            background: 'rgba(255,255,255,0.6)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-body)',
            caretColor: 'var(--color-primary)',
          }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {Object.keys(expanded).length > 0 && (
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs transition-colors duration-150"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Collapse all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 px-1">
        {filteredFlat.length === 0 ? (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {search ? 'No matches.' : 'No pages yet.'}
          </div>
        ) : (
          filteredFlat.map(({ node, depth }) => (
            <div key={node.id}>
              <SidebarTreeRow
                node={node}
                depth={depth}
                activeId={activeId}
                renameId={renameId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                draggedId={draggedId}
                dropTargetId={dropTargetId}
                hoverNodeId={hoverNodeId}
                creatingChildOf={creatingChildOf}
                isExpanded={expanded[node.id] ?? false}
                onToggle={toggle}
                onRename={(id, value) => { void handleRename(id, value) }}
                onNavigate={startNavigation}
                onWarmRoute={(kind) => {
                  if (kind === 'database') {
                    void warmDatabaseRoute()
                    return
                  }
                  void warmEditorRoute()
                }}
                onHoverChange={setHoverNodeId}
                onContextMenu={setContextNode}
                onCreateChild={(parentId) => { void handleCreateChild(parentId) }}
                onDragStart={(event, currentNode) => onDragStart(event, currentNode.id)}
                onDragOver={(event, currentNode) => onDragOver(event, currentNode)}
                onDragLeave={() => setDropTargetId(null)}
                onDrop={(event, currentNode) => onDrop(event, currentNode)}
              />
            </div>
          ))
        )}
      </div>

      <SidebarTreeContextMenu
        contextNode={contextNode}
        nodes={nodes}
        onClose={() => setContextNode(null)}
        onStartRename={(node) => {
          setRenameId(node.id)
          setRenameValue(node.title)
        }}
        onDelete={(id, kind) => { void handleDelete(id, kind) }}
      />
    </div>
  )
}
