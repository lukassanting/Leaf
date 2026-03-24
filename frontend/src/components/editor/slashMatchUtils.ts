import type { Editor } from '@tiptap/core'
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
