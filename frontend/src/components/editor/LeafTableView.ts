/**
 * TipTap table node view: same resizing/colgroup behaviour as the default `TableView`,
 * plus Notion-style + controls to append a row (bottom) or column (right).
 */
import { TableView } from '@tiptap/extension-table'
import { TableMap, addColumn, addRow } from '@tiptap/pm/tables'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView, ViewMutationRecord } from '@tiptap/pm/view'

export class LeafTableView extends TableView {
  private readonly editorView: EditorView

  private readonly addRowBar: HTMLDivElement

  private readonly addColWrap: HTMLDivElement

  constructor(node: PMNode, cellMinWidth: number, editorView?: EditorView) {
    super(node, cellMinWidth)
    this.table.classList.add('leaf-prose-table')
    this.editorView = editorView!

    const tableWrapper = this.dom
    const root = document.createElement('div')
    root.className = 'leaf-table-root'

    const mainRow = document.createElement('div')
    mainRow.className = 'leaf-table-main-row'

    root.appendChild(mainRow)
    mainRow.appendChild(tableWrapper)

    this.addColWrap = document.createElement('div')
    this.addColWrap.className = 'leaf-table-add-col'
    this.addColWrap.setAttribute('contenteditable', 'false')
    const addColBtn = document.createElement('button')
    addColBtn.type = 'button'
    addColBtn.className = 'leaf-table-add-col-btn'
    addColBtn.setAttribute('aria-label', 'Add column')
    addColBtn.title = 'Add column'
    addColBtn.textContent = '+'
    addColBtn.addEventListener('mousedown', (e) => e.preventDefault())
    addColBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.appendColumn()
    })
    this.addColWrap.appendChild(addColBtn)
    mainRow.appendChild(this.addColWrap)

    this.addRowBar = document.createElement('div')
    this.addRowBar.className = 'leaf-table-add-row-bar'
    this.addRowBar.setAttribute('contenteditable', 'false')
    const addRowBtn = document.createElement('button')
    addRowBtn.type = 'button'
    addRowBtn.className = 'leaf-table-add-row-btn'
    addRowBtn.setAttribute('aria-label', 'Add row')
    addRowBtn.title = 'Add row'
    addRowBtn.textContent = '+'
    addRowBtn.addEventListener('mousedown', (e) => e.preventDefault())
    addRowBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.appendRow()
    })
    this.addRowBar.appendChild(addRowBtn)
    root.appendChild(this.addRowBar)

    this.dom = root

    this.syncChromeEditable()
  }

  private syncChromeEditable() {
    const on = this.editorView?.editable !== false
    this.addRowBar.style.display = on ? '' : 'none'
    this.addColWrap.style.display = on ? '' : 'none'
  }

  update(node: PMNode) {
    const ok = super.update(node)
    this.syncChromeEditable()
    return ok
  }

  ignoreMutation(record: ViewMutationRecord) {
    const t = record.target
    if (t instanceof HTMLElement) {
      if (this.addRowBar.contains(t) || this.addColWrap.contains(t)) return true
    }
    return super.ignoreMutation(record)
  }

  private resolveTableFromDom(): { table: PMNode; tableStart: number; map: InstanceType<typeof TableMap> } | null {
    const view = this.editorView
    if (!view) return null
    const pos = view.posAtDOM(this.table, 0)
    if (pos == null || pos < 0) return null
    const $p = view.state.doc.resolve(pos)
    for (let d = $p.depth; d > 0; d--) {
      const n = $p.node(d)
      if (n.type.name === 'table') {
        return {
          table: n,
          tableStart: $p.start(d),
          map: TableMap.get(n),
        }
      }
    }
    return null
  }

  private appendRow() {
    const view = this.editorView
    const ctx = this.resolveTableFromDom()
    if (!view || !ctx) return
    const { state, dispatch } = view
    const tr = state.tr
    const rect = {
      map: ctx.map,
      tableStart: ctx.tableStart,
      table: ctx.table,
      top: 0,
      left: 0,
      right: ctx.map.width,
      bottom: ctx.map.height,
    }
    addRow(tr, rect, ctx.map.height)
    dispatch(tr.scrollIntoView())
    view.focus()
  }

  private appendColumn() {
    const view = this.editorView
    const ctx = this.resolveTableFromDom()
    if (!view || !ctx) return
    const { state, dispatch } = view
    const tr = state.tr
    const rect = {
      map: ctx.map,
      tableStart: ctx.tableStart,
      table: ctx.table,
      top: 0,
      left: 0,
      right: ctx.map.width,
      bottom: ctx.map.height,
    }
    addColumn(tr, rect, ctx.map.width)
    dispatch(tr.scrollIntoView())
    view.focus()
  }
}
