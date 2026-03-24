/**
 * Leaf frontend: Workspace shell layout (`frontend/src/app/(workspace)/layout.tsx`).
 *
 * Purpose:
 * - Provides the shared UI chrome for workspace pages: sidebars, focus mode, AI companion, and sizing/layout state.
 * - Exposes small React contexts/hooks (`useFocusMode`, `useContentWidth`, `useSidebarVis`, `usePaneVis`, `useAI`) that pages/components read.
 *
 * How to read:
 * - Start from the exported hooks (they are simple context wrappers).
 * - Then read `WorkspaceLayout` return tree: the providers wrap `children` plus the left/right sidebar and overlay buttons.
 * - Keybindings are handled in the `useEffect` block (Cmd/Ctrl+K toggles AI, Cmd/Ctrl+. toggles focus mode, `Escape` closes AI).
 *
 * Update:
 * - To add a new global workspace toggle, add a new context + hook, then wire it in the return JSX.
 * - If you change keyboard shortcuts, update the `onKeyDown` handler.
 * - If you add/remove sidebars, update the conditional rendering that checks `focusMode`, `leftOpen/rightOpen`, and `aiOpen`.
 *
 * Debug:
 * - If something seems “stuck”, check state initialization and provider wiring order.
 * - Keyboard shortcut issues: verify the `keydown` handler is mounted and that `event.preventDefault()` matches your desired behavior.
 */


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
        className="leaf-workspace-shell flex h-screen overflow-hidden"
        style={{ background: 'var(--leaf-bg-app)' }}
      >
        {!focusMode && leftOpen ? <SidebarLeft activeId={activeId} /> : null}

        <main
          className="relative flex min-w-0 flex-1 flex-col"
          style={{ background: 'var(--leaf-bg-editor)' }}
        >
          {children}
        </main>

        {!focusMode && rightOpen ? <Sidebar activeId={activeId} /> : null}
      </div>

      {!focusMode && !aiOpen ? (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-150 hover:scale-[1.02]"
          style={{
            background: 'var(--leaf-green)',
            color: 'var(--leaf-on-accent)',
            boxShadow:
              '0 12px 32px color-mix(in srgb, var(--leaf-green) 35%, transparent), 0 0 0 1px color-mix(in srgb, var(--leaf-on-accent) 35%, transparent) inset',
          }}
          title="Open AI companion"
        >
          <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L7 4.5L10.5 5L7.5 7.5L8.5 11L6 9L3.5 11L4.5 7.5L1.5 5L5 4.5L6 1Z" fill="currentColor" />
          </svg>
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
            background: 'var(--leaf-bg-elevated)',
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
