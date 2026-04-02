/**
 * Shared presets for TipTap rich-text: story flags (inline pills), text colours, slash actions.
 */

import type { StoryTagVariant } from '@/lib/api'

export type { StoryTagVariant }

export const STORY_TAG_VARIANTS: StoryTagVariant[] = [
  'combat',
  'political',
  'character',
  'lore',
  'environment',
  'boss',
  'neutral',
]

export const STORY_TAG_PRESETS: {
  variant: StoryTagVariant
  label: string
  slashLabel: string
  slashDescription: string
  keywords: string[]
}[] = [
  { variant: 'combat', label: 'Crimson', slashLabel: 'Crimson', slashDescription: 'Crimson story flag', keywords: ['flag', 'combat', 'fight', 'crimson', 'red'] },
  { variant: 'political', label: 'Gold', slashLabel: 'Gold', slashDescription: 'Gold story flag', keywords: ['flag', 'political', 'stakes', 'gold', 'yellow', 'amber'] },
  { variant: 'character', label: 'Blue', slashLabel: 'Blue', slashDescription: 'Blue story flag', keywords: ['flag', 'character', 'npc', 'blue'] },
  { variant: 'lore', label: 'Purple', slashLabel: 'Purple', slashDescription: 'Purple story flag', keywords: ['flag', 'lore', 'purple', 'arcane'] },
  {
    variant: 'environment',
    label: 'Orange',
    slashLabel: 'Orange',
    slashDescription: 'Orange story flag',
    keywords: ['flag', 'environment', 'setting', 'scene', 'atmosphere', 'weather', 'orange'],
  },
  { variant: 'boss', label: 'Rose', slashLabel: 'Rose', slashDescription: 'Rose story flag', keywords: ['flag', 'boss', 'rose', 'pink', 'magenta'] },
  { variant: 'neutral', label: 'Gray', slashLabel: 'Gray', slashDescription: 'Gray story flag', keywords: ['flag', 'label', 'pill', 'gray', 'grey', 'neutral'] },
]

/**
 * Dot colours shared with callout / stat-strip variant pickers (`CALLOUT_VARIANT_META`).
 * Text swatches below reuse these where names match so inline colour ≈ block accents.
 */
export const LEAF_CALLOUT_VARIANT_COLORS = {
  gray: '#a1a1aa',
  blue: '#3b82f6',
  purple: '#a855f7',
  yellow: '#eab308',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  rose: '#f43f5e',
  flavor: '#c9a84c',
} as const

/** Extra text-only hues (story flags reference the same names). Now also in callout variants. */
export const LEAF_TEXT_EXTRA_SWATCH_COLORS = {
  orange: LEAF_CALLOUT_VARIANT_COLORS.orange,
  rose: LEAF_CALLOUT_VARIANT_COLORS.rose,
} as const

/** Swatch `value` is applied via TipTap Color (inline style). */
export const LEAF_TEXT_COLOR_SWATCHES: { id: string; title: string; value: string }[] = [
  { id: 'accent', title: 'Accent', value: 'var(--leaf-green)' },
  { id: 'success', title: 'Success', value: LEAF_CALLOUT_VARIANT_COLORS.green },
  { id: 'gold', title: 'Gold', value: LEAF_CALLOUT_VARIANT_COLORS.flavor },
  { id: 'caution', title: 'Caution', value: LEAF_CALLOUT_VARIANT_COLORS.yellow },
  { id: 'orange', title: 'Orange', value: LEAF_TEXT_EXTRA_SWATCH_COLORS.orange },
  { id: 'danger', title: 'Danger', value: LEAF_CALLOUT_VARIANT_COLORS.red },
  { id: 'rose', title: 'Rose', value: LEAF_TEXT_EXTRA_SWATCH_COLORS.rose },
  { id: 'arcane', title: 'Arcane', value: LEAF_CALLOUT_VARIANT_COLORS.purple },
  { id: 'info', title: 'Info', value: LEAF_CALLOUT_VARIANT_COLORS.blue },
  { id: 'neutral', title: 'Neutral', value: LEAF_CALLOUT_VARIANT_COLORS.gray },
  { id: 'muted', title: 'Muted', value: 'var(--leaf-text-muted)' },
]

export function storyTagAction(variant: StoryTagVariant): string {
  return `storyTag_${variant}`
}

export function parseStoryTagAction(action: string): StoryTagVariant | null {
  if (!action.startsWith('storyTag_')) return null
  const v = action.slice('storyTag_'.length) as StoryTagVariant
  return STORY_TAG_VARIANTS.includes(v) ? v : null
}
