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

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { databasesApi } from '@/lib/api'

export function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const router = useRouter()
  const [tagLeafMap, setTagLeafMap] = useState<Record<string, string>>({})

  // Build a map of tag name → leaf_id from the Tags database
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const databases = await databasesApi.list()
        const tagsDb = databases.find((db) => db.title === 'Tags')
        if (!tagsDb || cancelled) return
        const rows = await databasesApi.listRows(tagsDb.id)
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const row of rows) {
          const name = String(row.properties?.name ?? '')
          if (name && row.leaf_id) map[name.toLowerCase()] = row.leaf_id
        }
        setTagLeafMap(map)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [tags])

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setDraft('')
  }

  const handleTagClick = useCallback((tag: string) => {
    const leafId = tagLeafMap[tag.toLowerCase()]
    if (leafId) {
      router.push(`/editor/${leafId}`)
    }
  }, [tagLeafMap, router])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-md text-xs font-medium"
          style={{
            background: 'var(--color-primary-dk, #047857)',
            color: '#fff',
            padding: '3px 8px 3px 6px',
          }}
        >
          <button
            type="button"
            onClick={() => handleTagClick(tag)}
            className="flex items-center gap-0.5 hover:opacity-80 transition-opacity"
            style={{ cursor: tagLeafMap[tag.toLowerCase()] ? 'pointer' : 'default', color: 'inherit' }}
          >
            <span style={{ opacity: 0.7 }}>#</span>
            {tag}
          </button>
          <button
            type="button"
            onClick={() => onChange(tags.filter((currentTag) => currentTag !== tag))}
            className="leading-none transition-opacity opacity-60 hover:opacity-100"
            style={{ color: 'inherit' }}
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
