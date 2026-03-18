'use client'

import { createContext, useContext, useState } from 'react'
import { useParams } from 'next/navigation'
import { NavigationProgressProvider } from '@/components/NavigationProgress'
import { Sidebar } from '@/components/Sidebar'

// ─── Focus mode context ──────────────────────────────────────────────────────
type FocusModeCtx = {
  focusMode: boolean
  setFocusMode: (v: boolean) => void
}
const FocusModeContext = createContext<FocusModeCtx>({ focusMode: false, setFocusMode: () => {} })
export function useFocusMode() { return useContext(FocusModeContext) }

// ─── Content width context ───────────────────────────────────────────────────
export type ContentWidth = 'normal' | 'wide' | 'full'
type ContentWidthCtx = {
  contentWidth: ContentWidth
  setContentWidth: (v: ContentWidth) => void
}
const ContentWidthContext = createContext<ContentWidthCtx>({ contentWidth: 'normal', setContentWidth: () => {} })
export function useContentWidth() { return useContext(ContentWidthContext) }

// ─── Sidebar visibility (mobile) ─────────────────────────────────────────────
type SidebarVisCtx = {
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}
const SidebarVisContext = createContext<SidebarVisCtx>({ sidebarOpen: false, setSidebarOpen: () => {} })
export function useSidebarVis() { return useContext(SidebarVisContext) }

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const activeId = params?.id as string | undefined
  const [focusMode, setFocusMode] = useState(false)
  const [contentWidth, setContentWidth] = useState<ContentWidth>('normal')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode }}>
    <ContentWidthContext.Provider value={{ contentWidth, setContentWidth }}>
    <SidebarVisContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
    <NavigationProgressProvider>
      <div className="flex min-h-screen" style={{ backgroundColor: 'var(--leaf-bg-editor)' }}>
        {/* Editor area fills remaining space */}
        <div className="flex-1 min-w-0">{children}</div>

        {/* Right sidebar — always visible on desktop, toggled on mobile */}
        {!focusMode && (
          <Sidebar activeId={activeId} />
        )}
      </div>

      {/* Focus mode exit button */}
      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors duration-150"
          style={{
            background: 'var(--leaf-bg-sidebar)',
            color: 'var(--leaf-text-sidebar)',
            border: '0.5px solid var(--leaf-border-strong)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
            <path d="M5 2H2V5M10 2H13V5M13 10V13H10M5 13H2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Exit focus
        </button>
      )}
    </NavigationProgressProvider>
    </SidebarVisContext.Provider>
    </ContentWidthContext.Provider>
    </FocusModeContext.Provider>
  )
}
