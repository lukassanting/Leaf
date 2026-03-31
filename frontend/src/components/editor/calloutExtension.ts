/**
 * TipTap `callout` block — classic colored panels + campaign accent / flavor variants.
 * Uses a React node view so a colour picker appears when the callout is selected.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { LEAF_CALLOUT_VARIANT_COLORS } from '@/lib/editorRichText'

export const CALLOUT_VARIANTS = ['gray', 'blue', 'purple', 'yellow', 'green', 'red', 'flavor'] as const
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number]

/** Visible labels + picker dots — hexes match `LEAF_CALLOUT_VARIANT_COLORS` / text swatches. */
export const CALLOUT_VARIANT_META: Record<CalloutVariant, { label: string; dot: string }> = {
  gray:   { label: 'Neutral',   dot: LEAF_CALLOUT_VARIANT_COLORS.gray },
  blue:   { label: 'Info',      dot: LEAF_CALLOUT_VARIANT_COLORS.blue },
  purple: { label: 'Arcane',    dot: LEAF_CALLOUT_VARIANT_COLORS.purple },
  yellow: { label: 'Caution',   dot: LEAF_CALLOUT_VARIANT_COLORS.yellow },
  green:  { label: 'Success',   dot: LEAF_CALLOUT_VARIANT_COLORS.green },
  red:    { label: 'Danger',    dot: LEAF_CALLOUT_VARIANT_COLORS.red },
  flavor: { label: 'Flavor',    dot: LEAF_CALLOUT_VARIANT_COLORS.flavor },
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: 'green',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-variant') || 'green',
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const v = (node.attrs.variant as string) || 'green'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        'data-variant': v,
        class: `leaf-callout leaf-callout--${v}`,
      }),
      0,
    ]
  },
})
