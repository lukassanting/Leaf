import type { Editor } from '@tiptap/core'
import type { LeafTreeItem } from '@/lib/api/types'
import type { SlashMenuState } from '@/components/SlashCommands'

export type EditorSlashMatch = {
  range: { from: number; to: number }
  query: string
  rect: SlashMenuState['rect']
}

export function computeSlashMatch(editor: Editor): EditorSlashMatch | null {
  const { state, view } = editor
  const { selection } = state

  if (!selection.empty) return null

  const $from = selection.$from
  const rect = view.coordsAtPos(selection.from)

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (!node.isTextblock) continue

    const start = $from.start(d)
    const rel = $from.pos - start
    const textBefore = node.textBetween(0, rel, '\0', '\0')
    const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore)
    if (!match) continue

    const slashIndex = textBefore.length - match[0].length + match[0].lastIndexOf('/')
    const from = start + slashIndex

    return {
      range: { from, to: selection.from },
      query: match[1] ?? '',
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
      },
    }
  }

  return null
}

export function computeWikilinkMatch(editor: Editor): EditorSlashMatch | null {
  const { state, view } = editor
  const { selection } = state

  if (!selection.empty) return null

  const $from = selection.$from
  const rect = view.coordsAtPos(selection.from)

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (!node.isTextblock) continue

    const start = $from.start(d)
    const rel = $from.pos - start
    const textBefore = node.textBetween(0, rel, '\0', '\0')
    const match = /(?:^|[\s(])\[\[([^\]]*)$/.exec(textBefore)
    if (!match) continue

    const token = `[[${match[1] ?? ''}`
    const from = $from.pos - token.length

    return {
      range: { from, to: selection.from },
      query: match[1] ?? '',
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
      },
    }
  }

  return null
}

/** Rank tree items for wikilink / link popover search (shared with editor link UI). */
export function rankWikilinkItems(items: LeafTreeItem[], query: string, maxResults = 12): LeafTreeItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return items
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, maxResults)
  }

  return items
    .map((item) => {
      const title = item.title.toLowerCase()
      const path = item.path.toLowerCase()
      const exact = title === normalizedQuery || path === normalizedQuery
      const starts = title.startsWith(normalizedQuery) || path.startsWith(normalizedQuery)
      const includes = title.includes(normalizedQuery) || path.includes(normalizedQuery)
      const score = exact ? 0 : starts ? 1 : includes ? 2 : 3
      return { item, score }
    })
    .filter((entry) => entry.score < 3)
    .sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title))
    .map((entry) => entry.item)
    .slice(0, maxResults)
}
