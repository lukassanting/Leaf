/**
 * Leaf UI: top strip / editor toolbar header (`frontend/src/components/TopStrip.tsx`).
 *
 * Purpose:
 * - Shows breadcrumbs for the current page/database.
 * - Provides quick controls:
 *   - left/right sidebar toggles
 *   - content width mode selector
 *   - focus mode toggle
 *   - “Ask AI” button (opens the AI assistant)
 *   - Settings (⋯): appearance / design theme (Classic vs Campaign)
 *
 * How to read:
 * - This component consumes multiple contexts from:
 *   - `frontend/src/app/(workspace)/layout.tsx` (focus/content width/pane visibility/AI state)
 *   - `frontend/src/components/NavigationProgress.tsx` (route warming/loading overlay)
 * - It returns `null` when `focusMode` is enabled.
 *
 * Update:
 * - To change keyboard shortcut hints, edit the `Ask AI` button hint (currently `Ctrl+K`).
 * - To add more controls, extend the JSX inside the return block and ensure related
 *   context hooks exist.
 *
 * Debug:
 * - If breadcrumbs render wrong links, check the `crumb.kind` mapping to `/databases/[id]` vs `/editor/[id]`.
 * - If width toggle doesn’t affect layout, verify `useContentWidth` is wired in workspace layout.
 */


'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { useLeafDesign } from '@/components/DesignThemeProvider'
import { useFocusMode, useContentWidth, usePaneVis, useAI, type ContentWidth } from '@/app/(workspace)/layout'
import { warmDatabaseRoute, warmEditorRoute } from '@/lib/warmEditorRoute'
import { DatabaseIcon, LeafIcon } from '@/components/Icons'

type Breadcrumb = {
  id: string
  title: string
  kind?: 'page' | 'database'
}

type Props = {
  breadcrumbs: Breadcrumb[]
  currentTitle: string
}

const WIDTH_OPTIONS: { key: ContentWidth; title: string; icon: React.ReactNode }[] = [
  {
    key: 'normal',
    title: 'Normal width',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M4 6.5H9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'wide',
    title: 'Wide',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="1" y="3" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M3 6.5H10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'full',
    title: 'Full width',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="0.5" y="3.5" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
]

export function TopStrip({ breadcrumbs, currentTitle }: Props) {
  const { startNavigation } = useNavigationProgress()
  const { design, setDesign } = useLeafDesign()
  const { focusMode, setFocusMode } = useFocusMode()
  const { contentWidth, setContentWidth } = useContentWidth()
  const { leftOpen, setLeftOpen, rightOpen, setRightOpen } = usePaneVis()
  const { setAiOpen } = useAI()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    const onDocMouseDown = (event: MouseEvent) => {
      const el = settingsWrapRef.current
      if (el && !el.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [settingsOpen])

  if (focusMode) return null

  return (
    <div
      className="sticky top-0 z-20 flex shrink-0 items-center justify-between"
      style={{
        height: 48,
        padding: '0 16px',
        background: 'var(--leaf-chrome-bar-bg)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--leaf-border-soft)',
      }}
    >
      {/* Left: sidebar toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Toggle left sidebar"
          onClick={() => setLeftOpen(!leftOpen)}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150"
          style={{
            color: leftOpen ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
            background: leftOpen ? 'color-mix(in srgb, var(--leaf-green) 10%, transparent)' : 'transparent',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 3V13" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>

      {/* Center: breadcrumbs */}
      <div className="flex min-w-0 items-center justify-center">
        <nav className="flex items-center gap-1 overflow-hidden" style={{ fontSize: 13, color: 'var(--leaf-text-muted)' }}>
          <span style={{ color: 'var(--leaf-text-muted)' }}>Workspaces</span>
          <span style={{ color: 'var(--leaf-border-strong)', margin: '0 2px' }}>/</span>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.id} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <span style={{ color: 'var(--leaf-border-strong)', margin: '0 2px' }}>/</span> : null}
              <Link
                href={crumb.kind === 'database' ? `/databases/${crumb.id}` : `/editor/${crumb.id}`}
                className="truncate transition-colors duration-150"
                style={{ color: 'var(--leaf-text-muted)', maxWidth: 120 }}
                onClick={() => startNavigation()}
                onMouseEnter={() => {
                  if (crumb.kind === 'database') { void warmDatabaseRoute(); return }
                  void warmEditorRoute()
                }}
              >
                <span className="inline-flex items-center gap-1">
                  {crumb.kind === 'database' ? <DatabaseIcon size={11} /> : <LeafIcon size={11} />}
                  <span className="truncate" style={{ maxWidth: 96 }}>{crumb.title}</span>
                </span>
              </Link>
            </span>
          ))}
          {currentTitle && (
            <>
              {breadcrumbs.length > 0 && <span style={{ color: 'var(--leaf-border-strong)', margin: '0 2px' }}>/</span>}
              <span className="truncate font-medium" style={{ color: 'var(--leaf-text-title)', maxWidth: 160 }}>
                {currentTitle}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Ask AI + controls */}
      <div className="flex items-center gap-2">
        {/* Ask AI button */}
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors duration-150"
          style={{
            background: 'var(--leaf-green)',
            color: 'var(--leaf-on-accent)',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-dk)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--leaf-green)' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l.9 2.7L11.6 4.6l-2 2L10.4 9.4 8 7.8l-2.4 1.6.8-2.8-2-2 2.7-.9L8 1z" fill="currentColor" />
            <path d="M3 11l.4 1.2 1.2.4-1.2.4L3 14.2l-.4-1.2L1.4 12.6l1.2-.4L3 11z" fill="currentColor" opacity="0.7" />
            <path d="M13 2l.3.9.9.3-.9.3L13 4.4l-.3-.9-.9-.3.9-.3L13 2z" fill="currentColor" opacity="0.5" />
          </svg>
          Ask AI
        </button>

        {/* Settings: appearance / design theme */}
        <div ref={settingsWrapRef} className="relative">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150"
            style={{ color: 'var(--leaf-text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
            title="Settings"
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="3.5" cy="7" r="1" fill="currentColor" />
              <circle cx="7" cy="7" r="1" fill="currentColor" />
              <circle cx="10.5" cy="7" r="1" fill="currentColor" />
            </svg>
          </button>
          {settingsOpen ? (
            <div
              role="menu"
              aria-label="Settings"
              className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[220px] rounded-lg border py-1 shadow-lg"
              style={{
                background: 'var(--leaf-bg-elevated)',
                borderColor: 'var(--leaf-border-strong)',
                boxShadow: 'var(--leaf-shadow-soft)',
              }}
            >
              <div
                className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--leaf-text-muted)' }}
              >
                Appearance
              </div>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={design === 'default'}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-100"
                style={{
                  color: 'var(--leaf-text-title)',
                  background: design === 'default' ? 'var(--color-hover)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (design !== 'default') e.currentTarget.style.background = 'var(--color-hover)'
                }}
                onMouseLeave={(e) => {
                  if (design !== 'default') e.currentTarget.style.background = 'transparent'
                }}
                onClick={() => {
                  setDesign('default')
                  setSettingsOpen(false)
                }}
              >
                <span>
                  <span className="block font-medium">Classic</span>
                  <span className="block text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
                    Default Leaf look
                  </span>
                </span>
                {design === 'default' ? (
                  <span style={{ color: 'var(--leaf-green)' }} aria-hidden>✓</span>
                ) : null}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={design === 'campaign'}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-100"
                style={{
                  color: 'var(--leaf-text-title)',
                  background: design === 'campaign' ? 'var(--color-hover)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (design !== 'campaign') e.currentTarget.style.background = 'var(--color-hover)'
                }}
                onMouseLeave={(e) => {
                  if (design !== 'campaign') e.currentTarget.style.background = 'transparent'
                }}
                onClick={() => {
                  setDesign('campaign')
                  setSettingsOpen(false)
                }}
              >
                <span>
                  <span className="block font-medium">Campaign</span>
                  <span className="block text-[11px]" style={{ color: 'var(--leaf-text-muted)' }}>
                    D&amp;D-inspired dark theme
                  </span>
                </span>
                {design === 'campaign' ? (
                  <span style={{ color: 'var(--leaf-green)' }} aria-hidden>✓</span>
                ) : null}
              </button>
            </div>
          ) : null}
        </div>

        {/* Width mode switcher */}
        <div
          className="flex items-center gap-0.5"
          style={{
            background: 'var(--leaf-segment-bg)',
            border: '1px solid var(--leaf-border-strong)',
            borderRadius: 6,
            padding: 2,
          }}
        >
          {WIDTH_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              title={opt.title}
              onClick={() => setContentWidth(opt.key)}
              className="flex items-center justify-center transition-colors duration-120"
              style={{
                width: 26,
                height: 22,
                borderRadius: 4,
                background: contentWidth === opt.key ? 'var(--leaf-segment-active-bg)' : 'transparent',
                color: contentWidth === opt.key ? 'var(--leaf-text-sidebar)' : 'var(--leaf-text-muted)',
                cursor: 'pointer',
              }}
            >
              {opt.icon}
            </button>
          ))}
        </div>

        {/* Focus mode */}
        <button
          type="button"
          title="Focus mode"
          onClick={() => setFocusMode(true)}
          className="flex items-center justify-center rounded-md transition-colors duration-150"
          style={{ width: 28, height: 28, color: 'var(--leaf-text-muted)', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hover)'; e.currentTarget.style.color = 'var(--leaf-text-title)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--leaf-text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
            <path d="M2 5V2H5M10 2H13V5M13 10V13H10M5 13H2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Right sidebar toggle */}
        <button
          type="button"
          title="Toggle right sidebar"
          onClick={() => setRightOpen(!rightOpen)}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150"
          style={{
            color: rightOpen ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
            background: rightOpen ? 'color-mix(in srgb, var(--leaf-green) 10%, transparent)' : 'transparent',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10 3V13" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>
    </div>
  )
}
