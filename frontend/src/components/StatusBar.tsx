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
