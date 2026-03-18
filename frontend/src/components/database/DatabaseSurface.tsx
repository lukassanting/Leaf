'use client'

import type { DatabaseRow, PropertyDefinition, ViewType } from '@/lib/api'
import { AddColumnModal, BoardView, DatabaseToolbar, GalleryView, TableView } from '@/components/database/DatabaseViews'

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
    </>
  )
}
