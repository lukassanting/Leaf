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
      <div
        className="flex flex-col items-center gap-3 rounded-2xl border px-6 py-5 shadow-sm"
        style={{ borderColor: 'var(--leaf-border-soft)', background: 'var(--leaf-bg-elevated)' }}
      >
        <div
          className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'color-mix(in srgb, var(--foreground) 12%, transparent)',
            borderTopColor: 'var(--color-primary)',
          }}
          aria-hidden="true"
        />
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  )
}
