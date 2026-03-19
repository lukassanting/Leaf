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
      style={{ borderColor: 'rgba(16,185,129,0.18)', borderTopColor: 'var(--leaf-green)' }}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/65 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white px-6 py-5 shadow-lg" style={{ borderColor: 'var(--leaf-border-strong)', boxShadow: 'var(--leaf-shadow-soft)' }}>
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
