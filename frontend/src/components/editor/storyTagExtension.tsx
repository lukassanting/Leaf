'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'

function StoryTagView({ node, updateAttributes, selected }: NodeViewProps) {
  const variant = String(node.attrs.variant || 'neutral')
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={['leaf-story-tag', `leaf-story-tag--${variant}`, selected ? 'leaf-story-tag--selected' : ''].filter(Boolean).join(' ')}
    >
      <input
        type="text"
        value={String(node.attrs.label ?? '')}
        onChange={(e) => updateAttributes({ label: e.target.value })}
        onMouseDown={(e) => e.stopPropagation()}
        className="leaf-story-tag-input"
        aria-label="Story flag label"
        size={Math.max(2, String(node.attrs.label ?? '').length + 1)}
      />
    </NodeViewWrapper>
  )
}

export const StoryTag = Node.create({
  name: 'storyTag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      label: { default: 'Gray' },
      variant: { default: 'neutral' },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-type="story-tag"]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false
          return {
            label: element.getAttribute('data-label') || element.textContent?.trim() || 'Gray',
            variant: element.getAttribute('data-variant') || 'neutral',
          }
        },
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? 'Gray')
    const variant = String(node.attrs.variant ?? 'neutral')
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'story-tag',
          'data-label': label,
          'data-variant': variant,
          class: `leaf-story-tag leaf-story-tag--${variant}`,
        },
        HTMLAttributes,
      ),
      label,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(StoryTagView as never)
  },
})
