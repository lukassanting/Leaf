/**
 * Leaf UI: editor toolbar controls (`frontend/src/components/EditorToolbar.tsx`).
 *
 * Purpose:
 * - Renders formatting buttons for the TipTap editor instance.
 * - Supports toggling headings and inline block marks via `editor.chain()...run()`.
 *
 * How to read:
 * - `items` is a list of buttons and separators.
 * - For each button:
 *   - `active()` decides styling (based on `editor.isActive(...)`)
 *   - `action()` applies the command chain.
 *
 * Update:
 * - To add a new formatting command, add a new item to `items`.
 * - Ensure the command matches what the editor extensions support.
 *
 * Debug:
 * - If a button does nothing, verify the editor instance exposes the relevant chain command
 *   and that the required extension is loaded in `components/editor/LeafEditor.tsx`.
 */


'use client'

import type { Editor } from '@tiptap/react'

type Props = { editor: Editor }

type ToolbarButton = {
  label: string
  title: string
  active?: () => boolean
  action: () => void
}

type Separator = { type: 'sep' }

export function EditorToolbar({ editor }: Props) {
  const items: (ToolbarButton | Separator)[] = [
    {
      label: 'H1',
      title: 'Heading 1',
      active: () => editor.isActive('heading', { level: 1 }),
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'H2',
      title: 'Heading 2',
      active: () => editor.isActive('heading', { level: 2 }),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'H3',
      title: 'Heading 3',
      active: () => editor.isActive('heading', { level: 3 }),
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    { type: 'sep' },
    {
      label: 'B',
      title: 'Bold',
      active: () => editor.isActive('bold'),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'I',
      title: 'Italic',
      active: () => editor.isActive('italic'),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'S',
      title: 'Strikethrough',
      active: () => editor.isActive('strike'),
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: '<>',
      title: 'Inline code',
      active: () => editor.isActive('code'),
      action: () => editor.chain().focus().toggleCode().run(),
    },
    { type: 'sep' },
    {
      label: '—',
      title: 'Bullet list',
      active: () => editor.isActive('bulletList'),
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: '1.',
      title: 'Ordered list',
      active: () => editor.isActive('orderedList'),
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: '```',
      title: 'Code block',
      active: () => editor.isActive('codeBlock'),
      action: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: '❝',
      title: 'Blockquote',
      active: () => editor.isActive('blockquote'),
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ]

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {items.map((item, i) => {
        if ('type' in item) {
          return <div key={i} className="mx-1 h-4 w-px" style={{ background: 'var(--leaf-border-strong)' }} />
        }
        const isActive = item.active?.() ?? false
        return (
          <button
            key={item.label}
            type="button"
            title={item.title}
            onClick={item.action}
            className={[
              'px-1.5 py-1 rounded text-xs font-mono transition',
              isActive
                ? 'font-medium'
                : '',
            ].join(' ')}
            style={isActive
              ? { background: 'color-mix(in srgb, var(--leaf-green) 9%, transparent)', color: 'var(--leaf-green)' }
              : { color: 'var(--leaf-text-muted)' }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
