/**
 * TipTap `callout` block — classic colored panels + campaign accent / flavor variants.
 * Uses a React node view so a colour picker appears when the callout is selected.
 */
import { Node, mergeAttributes } from '@tiptap/core'

export const CALLOUT_VARIANTS = ['gray', 'blue', 'red', 'yellow', 'green', 'flavor'] as const
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number]

/** Visible labels + border colors used in the inline picker. */
export const CALLOUT_VARIANT_META: Record<CalloutVariant, { label: string; dot: string }> = {
  gray:   { label: 'Neutral',   dot: '#a1a1aa' },
  blue:   { label: 'Info',      dot: '#3b82f6' },
  yellow: { label: 'Caution',   dot: '#eab308' },
  green:  { label: 'Success',   dot: '#22c55e' },
  red:    { label: 'Danger',    dot: '#ef4444' },
  flavor: { label: 'Flavor',    dot: '#c9a84c' },
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: 'gray',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-variant') || 'gray',
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const v = (node.attrs.variant as string) || 'gray'
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
