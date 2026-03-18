'use client'

export function LoadingShell({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/5 bg-white px-6 py-5 shadow-sm">
        <div
          className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(0,0,0,0.12)', borderTopColor: 'var(--color-primary)' }}
          aria-hidden="true"
        />
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  )
}
