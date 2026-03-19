/**
 * Leaf UI: tags input (`frontend/src/components/editor/TagsInput.tsx`).
 *
 * Purpose:
 * - Renders an editable list of tags as “chips”.
 * - Supports adding via:
 *   - pressing `Enter` or `,`
 *   - blur (if draft is non-empty)
 * - Supports removing via an `×` button.
 * - Keeps tag list deduplicated (won’t add an existing tag).
 *
 * How to read:
 * - `tags` comes from parent state.
 * - `onChange(nextTags)` is called whenever the chip list changes.
 *
 * Update:
 * - To change separators/UX:
 *   - edit the `onKeyDown` handler (Enter/Comma)
 *   - edit the `onBlur` handler
 *
 * Debug:
 * - If tags don’t update, ensure parent passes a stable `onChange` and that
 *   the parent stores the tag array as `string[]`.
 */


'use client'

import { useState } from 'react'

export function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setDraft('')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'var(--color-tag-bg)', border: '1px solid var(--color-tag-border)', color: 'var(--color-tag-text)' }}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((currentTag) => currentTag !== tag))}
            className="leading-none transition-opacity opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="text-xs bg-transparent border-none outline-none w-24"
        style={{ color: 'var(--color-text-muted)', caretColor: 'var(--color-primary)' }}
        placeholder={tags.length ? '' : 'Add tag…'}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(draft) }
          if (event.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => draft.trim() && addTag(draft)}
      />
    </div>
  )
}
