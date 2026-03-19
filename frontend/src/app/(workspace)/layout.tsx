'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { NavigationProgressProvider } from '@/components/NavigationProgress'
import { AIAssistant } from '@/components/AIAssistant'
import { SidebarLeft } from '@/components/SidebarLeft'
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

type PaneVisCtx = {
  leftOpen: boolean
  setLeftOpen: (v: boolean) => void
  rightOpen: boolean
  setRightOpen: (v: boolean) => void
}
const PaneVisContext = createContext<PaneVisCtx>({
  leftOpen: true,
  setLeftOpen: () => {},
  rightOpen: true,
  setRightOpen: () => {},
})
export function usePaneVis() { return useContext(PaneVisContext) }

type AICtx = {
  aiOpen: boolean
  setAiOpen: (v: boolean) => void
}
const AIContext = createContext<AICtx>({ aiOpen: false, setAiOpen: () => {} })
export function useAI() { return useContext(AIContext) }

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const activeId = params?.id as string | undefined
  const [focusMode, setFocusMode] = useState(false)
  const [contentWidth, setContentWidth] = useState<ContentWidth>('normal')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setAiOpen((current) => !current)
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '.') {
        event.preventDefault()
        setFocusMode((current) => !current)
      }
      if (event.key === 'Escape') {
        setAiOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode }}>
    <ContentWidthContext.Provider value={{ contentWidth, setContentWidth }}>
    <SidebarVisContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
    <PaneVisContext.Provider value={{ leftOpen, setLeftOpen, rightOpen, setRightOpen }}>
    <AIContext.Provider value={{ aiOpen, setAiOpen }}>
    <NavigationProgressProvider>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)' }}
      >
        {!focusMode && leftOpen ? <SidebarLeft activeId={activeId} /> : null}

        <main
          className="relative flex min-w-0 flex-1 flex-col"
          style={{
            background: 'var(--leaf-bg-editor)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
          }}
        >
          {children}
        </main>

        {!focusMode && rightOpen ? <Sidebar activeId={activeId} /> : null}
      </div>

      {!focusMode && !aiOpen ? (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-150 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(180deg, rgba(16,185,129,0.96), rgba(5,150,105,0.96))',
            color: '#fff',
            boxShadow: '0 18px 44px rgba(16,185,129,0.24), 0 0 0 1px rgba(255,255,255,0.35) inset',
          }}
          title="Open AI companion"
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>✦</span>
        </button>
      ) : null}

      {aiOpen && !focusMode ? <AIAssistant onClose={() => setAiOpen(false)} /> : null}

      {/* Focus mode exit button */}
      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors duration-150"
          style={{
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--leaf-text-sidebar)',
            border: '1px solid var(--leaf-border-strong)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
            <path d="M5 2H2V5M10 2H13V5M13 10V13H10M5 13H2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Exit focus
        </button>
      )}
    </NavigationProgressProvider>
    </AIContext.Provider>
    </PaneVisContext.Provider>
    </SidebarVisContext.Provider>
    </ContentWidthContext.Provider>
    </FocusModeContext.Provider>
  )
}
