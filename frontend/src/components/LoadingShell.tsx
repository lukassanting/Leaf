/**
 * Leaf UI: loading placeholder shell (`frontend/src/components/LoadingShell.tsx`).
 *
 * Purpose:
 * - Provides a consistent centered loading/empty state wrapper used by route
 *   loading boundaries.
 *
 * How to read:
 * - `LoadingShell` takes `label` and renders spinner + text.
 *
 * Update:
 * - To tweak spinner colors or sizing, edit the inline `style` props.
 * - To change background/border, adjust the outer div classes.
 *
 * Debug:
 * - If loading screens look unstyled, confirm this component is used in route
 *   `loading.tsx` files and the relevant CSS variables exist (`globals.css`).
 */


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
