'use client'

import Link from 'next/link'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { useFocusMode, useContentWidth, type ContentWidth } from '@/app/(workspace)/layout'
import { warmDatabaseRoute, warmEditorRoute } from '@/lib/warmEditorRoute'

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

  if (focusMode) return null

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        height: 38,
        padding: '0 20px',
        background: 'var(--leaf-bg-editor)',
        borderBottom: '0.5px solid var(--leaf-border-soft)',
      }}
    >
      {/* Left — Breadcrumbs */}
      <nav className="flex items-center gap-1 overflow-hidden" style={{ fontSize: 11.5, color: 'var(--leaf-text-muted)' }}>
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.id} className="flex items-center gap-1 min-w-0">
            {index > 0 && <span style={{ color: 'var(--leaf-border-strong)' }} className="mx-0.5">/</span>}
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
              {crumb.title}
            </Link>
          </span>
        ))}
        {breadcrumbs.length > 0 && <span style={{ color: 'var(--leaf-border-strong)' }} className="mx-0.5">/</span>}
        <span
          className="truncate max-w-[180px]"
          style={{ color: 'var(--leaf-text-sidebar)', fontWeight: 500 }}
        >
          {currentTitle || 'Untitled'}
        </span>
      </nav>

      {/* Right — Controls */}
      <div className="flex items-center gap-1.5">
        {/* Width toggle */}
        <div
          className="flex items-center gap-0.5"
          style={{
            background: '#eef3eb',
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
                background: contentWidth === opt.key ? '#fff' : 'transparent',
                color: contentWidth === opt.key ? 'var(--leaf-text-sidebar)' : '#7a9e87',
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
          style={{ width: 28, height: 28, color: '#7a9e87', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,140,82,0.1)'; e.currentTarget.style.color = '#2d5040' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#7a9e87' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M2 5V2H5M10 2H13V5M13 10V13H10M5 13H2V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Quick search (placeholder) */}
        <button
          type="button"
          title="Search (⌘K)"
          className="flex items-center justify-center rounded-md transition-colors duration-150"
          style={{ width: 28, height: 28, color: '#7a9e87', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,140,82,0.1)'; e.currentTarget.style.color = '#2d5040' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#7a9e87' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
