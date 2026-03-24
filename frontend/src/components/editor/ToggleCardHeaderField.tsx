'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { computeSlashMatch, type EditorSlashMatch } from '@/components/editor/slashMatchUtils'
import { SlashMenuPanel, type SlashMenuState } from '@/components/SlashCommands'
import { rankToggleHeaderSlashItems, applyToggleHeaderSlashAction } from '@/components/editor/toggleCardHeaderSlash'
import { toggleCardHeaderFieldExtensions } from '@/components/editor/toggleCardHeaderFieldExtensions'

/** Plain text or HTML fragment stored on toggle card attrs. */
export function attrStringToToggleHeaderHtml(raw: string): string {
  const t = raw ?? ''
  if (!t.trim()) return '<p></p>'
  if (t.trimStart().startsWith('<')) return t
  const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<p>${esc}</p>`
}

type Props = {
  value: string
  placeholder: string
  ariaLabel: string
  className: string
  style?: CSSProperties
  onChange: (html: string) => void
  onMouseDown?: (e: MouseEvent) => void
  onClick?: (e: MouseEvent) => void
}

export function ToggleCardHeaderField({
  value,
  placeholder,
  ariaLabel,
  className,
  style,
  onChange,
  onMouseDown,
  onClick,
}: Props) {
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const slashMatchRef = useRef<EditorSlashMatch | null>(null)
  const slashMenuRef = useRef<SlashMenuState | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  slashMenuRef.current = slashMenu

  const extensions = useMemo(() => toggleCardHeaderFieldExtensions(placeholder), [placeholder])

  const updateSlashMenu = useCallback((ed: Editor) => {
    const m = computeSlashMatch(ed)
    slashMatchRef.current = m
    if (!m) {
      setSlashMenu(null)
      return
    }
    const items = rankToggleHeaderSlashItems(m.query)
    if (items.length === 0) {
      setSlashMenu(null)
      return
    }
    setSlashMenu((cur) => {
      const same =
        cur &&
        cur.items.length === items.length &&
        cur.items.every((it, i) => it.action === items[i]?.action)
      if (same) return { ...cur, rect: m.rect }
      return { items, selectedIndex: 0, rect: m.rect }
    })
  }, [])

  const editor = useEditor({
    extensions,
    content: attrStringToToggleHeaderHtml(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: `leaf-toggle-card-field-pm ${className}`.trim(),
        'aria-label': ariaLabel,
      },
      handleDOMEvents: {
        mousedown: (_view, event) => {
          onMouseDown?.(event as unknown as MouseEvent)
          return false
        },
        click: (_view, event) => {
          onClick?.(event as unknown as MouseEvent)
          return false
        },
        keydown: (_view, event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
          }
          const active = slashMenuRef.current
          const ed = editorRef.current
          if (active && ed) {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSlashMenu((c) => (c ? { ...c, selectedIndex: (c.selectedIndex - 1 + c.items.length) % c.items.length } : c))
              return true
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSlashMenu((c) => (c ? { ...c, selectedIndex: (c.selectedIndex + 1) % c.items.length } : c))
              return true
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              const item = active.items[active.selectedIndex]
              const match = slashMatchRef.current
              setSlashMenu(null)
              slashMatchRef.current = null
              if (item && match) {
                applyToggleHeaderSlashAction(ed, item.action, match.range)
              }
              return true
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              slashMatchRef.current = null
              setSlashMenu(null)
              return true
            }
          }
          return false
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current(ed.getHTML())
    },
  })

  editorRef.current = editor

  useEffect(() => {
    if (!editor) return
    const next = attrStringToToggleHeaderHtml(value)
    if (next === editor.getHTML()) return
    if (editor.isFocused) return
    editor.commands.setContent(next, false)
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    const sync = () => {
      const ed = editorRef.current
      if (ed) updateSlashMenu(ed)
    }
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    editor.on('focus', sync)
    const onBlur = () => setTimeout(sync, 0)
    editor.on('blur', onBlur)
    sync()
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
      editor.off('focus', sync)
      editor.off('blur', onBlur)
    }
  }, [editor, updateSlashMenu])

  if (!editor) {
    return null
  }

  return (
    <>
      <div
        className="leaf-toggle-card-field-shell"
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <EditorContent editor={editor} />
      </div>
      {slashMenu ? (
        <SlashMenuPanel
          menu={slashMenu}
          onSelect={(item) => {
            const ed = editorRef.current
            const match = slashMatchRef.current
            setSlashMenu(null)
            slashMatchRef.current = null
            if (!ed || !match) return
            applyToggleHeaderSlashAction(ed, item.action, match.range)
          }}
        />
      ) : null}
    </>
  )
}
