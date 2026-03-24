/**
 * Leaf UI: navigation progress overlay (`frontend/src/components/NavigationProgress.tsx`).
 *
 * Purpose:
 * - Provides a context (`NavigationProgressProvider`) that other pages/components
 *   can use to show a short “Loading…” spinner overlay during route transitions.
 *
 * How to read:
 * - `startNavigation()` schedules the overlay to appear after a small delay (120ms).
 * - `stopNavigation()` immediately hides it and cancels the pending timer.
 * - The provider listens to `usePathname()` changes and hides overlay on route changes.
 *
 * Update:
 * - To change delay duration or overlay UI, edit `startNavigation()` and the JSX at the bottom.
 * - If you want different behavior per route, you can add props or more context fields.
 *
 * Debug:
 * - If overlay never appears, check that callers call `startNavigation()` and later call
 *   `stopNavigation()` (or rely on pathname change).
 * - If overlay is stuck, ensure timers are cleared in both `stopNavigation()` and cleanup.
 */


'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type NavigationProgressValue = {
  startNavigation: () => void
  stopNavigation: () => void
}

const NavigationProgressContext = createContext<NavigationProgressValue | null>(null)

function Spinner() {
  return (
    <div
      className="w-10 h-10 rounded-full border-2 animate-spin"
      style={{
        borderColor: 'color-mix(in srgb, var(--leaf-green) 20%, transparent)',
        borderTopColor: 'var(--leaf-green)',
      }}
      aria-hidden="true"
    />
  )
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const showTimerRef = useRef<number | null>(null)

  const stopNavigation = useCallback(() => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    setVisible(false)
  }, [])

  const startNavigation = useCallback(() => {
    if (typeof window === 'undefined') return
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current)
    }
    showTimerRef.current = window.setTimeout(() => {
      setVisible(true)
      showTimerRef.current = null
    }, 120)
  }, [])

  useEffect(() => {
    stopNavigation()
  }, [pathname, stopNavigation])

  useEffect(() => () => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current)
    }
  }, [])

  const value = useMemo(() => ({ startNavigation, stopNavigation }), [startNavigation, stopNavigation])

  return (
    <NavigationProgressContext.Provider value={value}>
      {children}
      {visible && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-[2px]"
          style={{ background: 'var(--leaf-overlay-scrim)' }}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-2xl border px-6 py-5 shadow-lg"
            style={{
              background: 'var(--leaf-bg-elevated)',
              borderColor: 'var(--leaf-border-strong)',
              boxShadow: 'var(--leaf-shadow-soft)',
            }}
          >
            <Spinner />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Loading…
            </span>
          </div>
        </div>
      )}
    </NavigationProgressContext.Provider>
  )
}

export function useNavigationProgress() {
  const context = useContext(NavigationProgressContext)

  return context ?? {
    startNavigation: () => {},
    stopNavigation: () => {},
  }
}
