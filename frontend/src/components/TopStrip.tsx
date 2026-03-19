'use client'

import Link from 'next/link'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { useFocusMode, useContentWidth, usePaneVis, type ContentWidth } from '@/app/(workspace)/layout'
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
  const { focusMode, setFocusMode } = useFocusMode()
  const { contentWidth, setContentWidth } = useContentWidth()
  const { leftOpen, setLeftOpen, rightOpen, setRightOpen } = usePaneVis()

  if (focusMode) return null

  return (
    <div
      className="sticky top-0 z-20 grid shrink-0 grid-cols-[auto,1fr,auto] items-center gap-3"
      style={{
        height: 56,
        padding: '0 18px',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--leaf-border-soft)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          title="Toggle left sidebar"
          onClick={() => setLeftOpen(!leftOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150"
          style={{
            color: leftOpen ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
            borderColor: leftOpen ? 'rgba(16,185,129,0.18)' : 'var(--leaf-border-strong)',
            background: leftOpen ? 'rgba(16,185,129,0.08)' : 'rgba(250,250,250,0.9)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 3V13" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>

      <div className="flex min-w-0 justify-center">
        <div className="min-w-0 text-center">
          <div className="truncate text-[13px] font-medium" style={{ color: 'var(--leaf-text-title)' }}>
            {currentTitle || 'Untitled'}
          </div>
          <nav className="flex items-center justify-center gap-1 overflow-hidden pt-0.5" style={{ fontSize: 11, color: 'var(--leaf-text-muted)' }}>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex min-w-0 items-center gap-1">
                {index > 0 ? <span style={{ color: 'var(--leaf-border-strong)' }}>/</span> : null}
                <Link
                  href={crumb.kind === 'database' ? `/databases/${crumb.id}` : `/editor/${crumb.id}`}
                  className="truncate max-w-[120px] transition-colors duration-150"
                  style={{ color: 'var(--leaf-text-muted)' }}
                  onClick={() => startNavigation()}
                  onMouseEnter={() => {
                    if (crumb.kind === 'database') { void warmDatabaseRoute(); return }
                    void warmEditorRoute()
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {crumb.kind === 'database' ? <DatabaseIcon size={11} /> : <LeafIcon size={11} />}
                    <span className="truncate max-w-[96px]">{crumb.title}</span>
                  </span>
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-0.5"
          style={{
            background: '#fafafa',
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
                width: 28,
                height: 24,
                borderRadius: 4,
                background: contentWidth === opt.key ? '#fff' : 'transparent',
                color: contentWidth === opt.key ? 'var(--leaf-text-sidebar)' : 'var(--leaf-text-muted)',
                cursor: 'pointer',
              }}
            >
              {opt.icon}
            </button>
          ))}
        </div>

        <button
          type="button"
          title="Focus mode"
          onClick={() => setFocusMode(true)}
          className="flex items-center justify-center rounded-md transition-colors duration-150"
          style={{ width: 30, height: 30, color: 'var(--leaf-text-muted)', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(24,24,27,0.05)'; e.currentTarget.style.color = 'var(--leaf-text-title)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--leaf-text-muted)' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M2 5V2H5M10 2H13V5M13 10V13H10M5 13H2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          type="button"
          title="Toggle right sidebar"
          onClick={() => setRightOpen(!rightOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150"
          style={{
            color: rightOpen ? 'var(--leaf-green)' : 'var(--leaf-text-muted)',
            borderColor: rightOpen ? 'rgba(16,185,129,0.18)' : 'var(--leaf-border-strong)',
            background: rightOpen ? 'rgba(16,185,129,0.08)' : 'rgba(250,250,250,0.9)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10 3V13" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>
    </div>
  )
}
