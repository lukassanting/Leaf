/**
 * Leaf UI: database surface router (`frontend/src/components/database/DatabaseSurface.tsx`).
 *
 * Purpose:
 * - Provides the top-level UI for `/databases/[id]`:
 *   - view toolbar + switching between views
 *   - table/list/board/gallery renderers (via `DatabaseViews.tsx`)
 *   - add-row flow and add-column modal toggling
 *
 * How to read:
 * - Props are pure wiring into:
 *   - `DatabaseToolbar`
 *   - view components in `DatabaseViews.tsx`:
 *     `TableView`, `BoardView`, `GalleryView`, `ListView`
 * - `activeView` determines which view block renders.
 *
 * Update:
 * - To add a new view type:
 *   - extend `ViewType` types and backend support
 *   - add a new renderer + branch here
 *   - update the toolbar to offer the new option
 *
 * Debug:
 * - If switching views doesn’t change UI:
 *   - confirm `setViewType` updates hook state (`useDatabasePage`)
 *   - ensure `activeView` matches the expected `ViewType` union values.
 */


'use client'

import type { DatabaseRow, PropertyDefinition, ViewType } from '@/lib/api'
import { AddColumnModal, BoardView, DatabaseToolbar, GalleryView, ListView, TableView } from '@/components/database/DatabaseViews'

type Props = {
  activeView: ViewType
  rows: DatabaseRow[]
  columns: PropertyDefinition[]
  addRow: () => void | Promise<void>
  updateName: (rowId: string, title: string) => void | Promise<void>
  updateCell: (rowId: string, key: string, value: string) => void | Promise<void>
  deleteRow: (rowId: string) => void | Promise<void>
  setViewType: (view: ViewType) => void | Promise<void>
  showAddCol: boolean
  setShowAddCol: (value: boolean) => void
  addColumn: (definition: PropertyDefinition) => void | Promise<void>
}

export function DatabaseSurface({
  activeView,
  rows,
  columns,
  addRow,
  updateName,
  updateCell,
  deleteRow,
  setViewType,
  showAddCol,
  setShowAddCol,
  addColumn,
}: Props) {
  return (
    <>
      {showAddCol && <AddColumnModal onAdd={(definition) => { void addColumn(definition) }} onClose={() => setShowAddCol(false)} />}

      <DatabaseToolbar activeView={activeView} onSetView={(view) => { void setViewType(view) }} onAddRow={() => { void addRow() }} />

      {activeView === 'table' && (
        <TableView
          rows={rows}
          columns={columns}
          onUpdateName={(rowId, title) => { void updateName(rowId, title) }}
          onUpdateCell={(rowId, key, value) => { void updateCell(rowId, key, value) }}
          onDeleteRow={(rowId) => { void deleteRow(rowId) }}
          onAddRow={() => { void addRow() }}
          onAddColumn={() => setShowAddCol(true)}
        />
      )}
      {activeView === 'board' && (
        <BoardView
          rows={rows}
          columns={columns}
          onUpdateName={(rowId, title) => { void updateName(rowId, title) }}
          onDeleteRow={(rowId) => { void deleteRow(rowId) }}
          onAddRow={() => { void addRow() }}
        />
      )}
      {activeView === 'gallery' && (
        <GalleryView
          rows={rows}
          columns={columns}
          onUpdateName={(rowId, title) => { void updateName(rowId, title) }}
          onDeleteRow={(rowId) => { void deleteRow(rowId) }}
          onAddRow={() => { void addRow() }}
        />
      )}
      {activeView === 'list' && (
        <ListView
          rows={rows}
          columns={columns}
          onUpdateName={(rowId, title) => { void updateName(rowId, title) }}
          onDeleteRow={(rowId) => { void deleteRow(rowId) }}
          onAddRow={() => { void addRow() }}
        />
      )}
    </>
  )
}
