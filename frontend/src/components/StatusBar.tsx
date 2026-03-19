/**
 * Leaf UI: save/status bar (`frontend/src/components/StatusBar.tsx`).
 *
 * Purpose:
 * - Displays autosave state (`saving`/`saved`/`error`/`offline`) and word count summary.
 * - Optionally shows a “mode label” (e.g., Rich vs Markdown or view name).
 *
 * How to read:
 * - `Props` defines `saveStatus`, `wordCount`, and optional `modeLabel`.
 * - Derived values:
 *   - `saveLabel` maps status -> text
 *   - `saveDotColor` maps status -> dot color
 *   - `readingTime` shows a rough `wordCount`-based estimate
 *
 * Update:
 * - To change wording/colors, adjust the ternaries in `saveLabel` and `saveDotColor`.
 * - If word count rules change, update the `readingTime` calculation block.
 *
 * Debug:
 * - If the bar doesn’t update, confirm the parent passes `saveStatus` and `wordCount`
 *   consistently (typically coming from `useLeafAutosave` and editor status callbacks).
 */


'use client'

type Props = {
  saveStatus: string
  wordCount: number
  modeLabel?: string
}

export function StatusBar({ saveStatus, wordCount, modeLabel }: Props) {
  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Synced' :
    saveStatus === 'error' ? 'Error' :
    saveStatus === 'offline' ? 'Offline' : 'Synced'

  const saveDotColor =
    saveStatus === 'error' ? '#dc2626' :
    saveStatus === 'saving' ? 'var(--leaf-text-muted)' :
    saveStatus === 'offline' ? '#d97706' : 'var(--leaf-green)'

  const readingTime = wordCount > 1000
    ? `~${Math.ceil(wordCount / 200)} min read`
    : `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        height: 28,
        padding: '0 20px',
        background: 'var(--leaf-bg-app)',
        borderTop: '1px solid var(--leaf-border-soft)',
      }}
    >
      <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--leaf-text-muted)' }}>
        <span className="flex items-center gap-1.5" data-testid="status-save-label">
          <span
            className="rounded-full"
            style={{ width: 5, height: 5, backgroundColor: saveDotColor }}
          />
          {saveLabel}
        </span>
        {wordCount > 0 && (
          <span>{readingTime}</span>
        )}
      </div>

      {modeLabel && (
        <div style={{ fontSize: 11, color: 'var(--leaf-text-muted)' }}>
          {modeLabel}
        </div>
      )}
    </div>
  )
}
