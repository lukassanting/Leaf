import type { Editor } from '@tiptap/core'
import { rankSlashItems, SLASH_ITEMS, type SlashGroup, type SlashItem } from '@/components/SlashCommands'
import { LEAF_TEXT_COLOR_SWATCHES, STORY_TAG_VARIANTS, storyTagAction, parseStoryTagAction, STORY_TAG_PRESETS } from '@/lib/editorRichText'

const HEADER_ACTIONS = new Set<string>([
  'bold',
  'italic',
  'strike',
  'code',
  'align_left',
  'align_center',
  'align_right',
  'textColor_clear',
])

for (const v of STORY_TAG_VARIANTS) {
  HEADER_ACTIONS.add(storyTagAction(v))
}

const COLOR_SLASH_ITEMS: SlashItem[] = LEAF_TEXT_COLOR_SWATCHES.map((sw) => ({
  label: `Colour · ${sw.title}`,
  description: `Apply ${sw.title} to text`,
  action: `textColor_${sw.id}`,
  group: 'Style' as SlashGroup,
  keywords: ['color', 'colour', sw.id, sw.title.toLowerCase()],
}))

function headerSlashPool(): SlashItem[] {
  const base = SLASH_ITEMS.filter((i) => HEADER_ACTIONS.has(i.action))
  const seen = new Set(base.map((b) => b.action))
  return [...base, ...COLOR_SLASH_ITEMS.filter((c) => !seen.has(c.action))]
}

export function rankToggleHeaderSlashItems(query: string): SlashItem[] {
  const pool = headerSlashPool()
  const allowed = new Set(pool.map((p) => p.action))
  if (!query.trim()) return pool
  return rankSlashItems(query).filter((i) => allowed.has(i.action))
}

export function applyToggleHeaderSlashAction(
  editor: Editor,
  action: string,
  deleteRange: { from: number; to: number },
): void {
  editor.chain().focus().deleteRange(deleteRange).run()
  const selectionPos = deleteRange.from

  switch (action) {
    case 'bold':
      editor.chain().focus().setTextSelection(selectionPos).toggleBold().run()
      return
    case 'italic':
      editor.chain().focus().setTextSelection(selectionPos).toggleItalic().run()
      return
    case 'strike':
      editor.chain().focus().setTextSelection(selectionPos).toggleStrike().run()
      return
    case 'code':
      editor.chain().focus().setTextSelection(selectionPos).toggleCode().run()
      return
    case 'align_left':
      editor.chain().focus().setTextSelection(selectionPos).setTextAlign('left').run()
      return
    case 'align_center':
      editor.chain().focus().setTextSelection(selectionPos).setTextAlign('center').run()
      return
    case 'align_right':
      editor.chain().focus().setTextSelection(selectionPos).setTextAlign('right').run()
      return
    case 'textColor_clear':
      editor.chain().focus().setTextSelection(selectionPos).unsetColor().run()
      return
    default:
      break
  }

  const storyVariant = parseStoryTagAction(action)
  if (storyVariant) {
    const preset = STORY_TAG_PRESETS.find((p) => p.variant === storyVariant)
    editor
      .chain()
      .focus()
      .insertContentAt(selectionPos, [
        { type: 'storyTag', attrs: { label: preset?.label ?? 'FLAG', variant: storyVariant } },
        { type: 'text', text: ' ' },
      ])
      .run()
    return
  }

  for (const sw of LEAF_TEXT_COLOR_SWATCHES) {
    if (action === `textColor_${sw.id}`) {
      editor.chain().focus().setTextSelection(selectionPos).setColor(sw.value).run()
      return
    }
  }
}
