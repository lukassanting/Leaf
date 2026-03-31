/**
 * Leaf UI: AI assistant companion (`frontend/src/components/AIAssistant.tsx`).
 *
 * Purpose:
 * - Renders a floating “AI Companion” command/input panel.
 * - Provides a simple prompt input and a few starter suggestions.
 * - Closes on `Esc` and calls the `onClose` prop.
 *
 * How to read:
 * - `AIAssistant` is currently a UI-only shell:
 *   - `submit()` simulates a “thinking” delay then resets the input.
 *   - `suggestions` are a fixed list of sample prompts.
 *
 * Update:
 * - To wire real AI integration, replace the `setTimeout` behavior with a call to your AI backend/provider.
 * - Update suggestions and/or placeholder text to match desired UX.
 *
 * Debug:
 * - If the panel doesn’t close with Esc, ensure the `onClose` prop is stable and that
 *   the keydown listener is mounted (it is in the `useEffect`).
 */


'use client'

import { useEffect, useRef, useState } from 'react'

export function AIAssistant({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim()) return
    setProcessing(true)
    window.setTimeout(() => {
      setProcessing(false)
      setInput('')
    }, 1200)
  }

  const suggestions = [
    'Summarize this page',
    'Create a table',
    'Extract action items',
  ]

  return (
    <div className="fixed bottom-20 right-5 z-50 w-[min(420px,calc(100vw-2rem))]">
      <div
        className="overflow-hidden rounded-2xl border shadow-lg"
        style={{
          background: 'var(--leaf-glass)',
          backdropFilter: 'blur(22px)',
          borderColor: 'color-mix(in srgb, var(--leaf-green) 18%, transparent)',
          boxShadow:
            '0 24px 60px color-mix(in srgb, var(--foreground) 8%, transparent), 0 0 0 1px color-mix(in srgb, var(--leaf-green) 10%, transparent)',
        }}
      >
        <div
          style={{
            height: 2,
            background:
              'linear-gradient(90deg, transparent, color-mix(in srgb, var(--leaf-green) 72%, transparent), transparent)',
            opacity: 0.6,
          }}
        />
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--leaf-border-soft)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--leaf-green)' }}
        >
          <span className="flex items-center gap-2">
            <span className={processing ? 'animate-pulse' : ''}>✦</span>
            AI Companion
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-2.5 py-1 text-[10px]"
            style={{
              borderColor: 'var(--leaf-border-strong)',
              color: 'var(--leaf-text-muted)',
              background: 'var(--leaf-bg-app)',
            }}
          >
            Esc
          </button>
        </div>

        {!input && (
          <div className="flex gap-2 overflow-x-auto px-3 py-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setInput(item)}
                className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors duration-150"
                style={{
                  borderColor: 'var(--leaf-border-strong)',
                  color: 'var(--leaf-text-body)',
                  background: 'var(--leaf-bg-app)',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 pt-3 text-[12px]" style={{ color: 'var(--leaf-text-muted)' }}>
          Floating command bubble for future page-aware writing, search, and summarization workflows.
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 px-3 py-3">
          <div style={{ color: 'var(--leaf-text-muted)' }} title="macOS: ⌘+K">
            Ctrl+K
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything, generate content, or search..."
            className="flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: 'var(--leaf-text-title)' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || processing}
            className="rounded-lg px-3 py-2 text-xs transition-colors duration-150 disabled:opacity-50"
            style={{
              background: input.trim() && !processing ? 'var(--leaf-green)' : 'var(--leaf-segment-bg)',
              color: input.trim() && !processing ? 'var(--leaf-on-accent)' : 'var(--leaf-text-muted)',
            }}
          >
            {processing ? 'Thinking…' : 'Run'}
          </button>
        </form>
      </div>
    </div>
  )
}
