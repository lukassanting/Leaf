/**
 * TipTap block extensions: resizable image, link preview card.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { LinkCardView } from '@/components/editor/LinkCardView'
import { ResizableImageView } from '@/components/editor/ResizableImageView'

export const LeafImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLImageElement).getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs) => (attrs.width ? { width: String(attrs.width) } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView as never)
  },
}).configure({ inline: false, allowBase64: true })

export const LinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      title: { default: 'Link' },
      description: { default: '' },
      image: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-leaf-link-card]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-leaf-link-card': 'true' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkCardView as never)
  },
})
