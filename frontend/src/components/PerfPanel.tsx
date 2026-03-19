/**
 * Leaf dev UI: performance panel (`frontend/src/components/PerfPanel.tsx`).
 *
 * Purpose:
 * - Conditionally renders a small “Perf (dev)” widget that displays timing samples
 *   captured during the mounting of editor-like routes/components.
 *
 * How to read:
 * - The panel is disabled unless `process.env.NEXT_PUBLIC_LEAF_PERF_PANEL === 'true'`.
 * - On mount/update, it measures a duration window for `mountLabel`.
 *
 * Update:
 * - To track additional mounts, call this component with a different `mountLabel`.
 * - To change sample list size, adjust the `prev.slice(0, 9)` trimming logic.
 *
 * Debug:
 * - If the panel shows nothing, verify `NEXT_PUBLIC_LEAF_PERF_PANEL` is set to `'true'`
 *   in your Next.js environment.
 */


'use client'

import { useEffect, useState } from 'react'

type Sample = {
  label: string
  valueMs: number
}

type PerfPanelProps = {
  mountLabel?: string
}

export function PerfPanel({ mountLabel = 'editor-mount' }: PerfPanelProps) {
  const [samples, setSamples] = useState<Sample[]>([])

  useEffect(() => {
    if (typeof performance === 'undefined') return
    const startMark = `${mountLabel}-start`
    const endMark = `${mountLabel}-end`

    if (!performance.getEntriesByName(startMark).length) {
      performance.mark(startMark)
    }

    performance.mark(endMark)
    const measureName = `${mountLabel}-duration`
    performance.measure(measureName, startMark, endMark)
    const [entry] = performance.getEntriesByName(measureName)

    if (entry) {
      setSamples((prev) => [
        { label: mountLabel, valueMs: entry.duration },
        ...prev.slice(0, 9),
      ])
      // Clear to avoid unbounded buffer.
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(measureName)
    }
  }, [mountLabel])

  if (process.env.NEXT_PUBLIC_LEAF_PERF_PANEL !== 'true') {
    return null
  }

  if (!samples.length) return null

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-lg bg-black/70 text-xs text-emerald-100 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="font-semibold mb-1 text-emerald-200">Perf (dev)</div>
      <ul className="space-y-0.5">
        {samples.map((sample, index) => (
          <li key={index} className="flex justify-between gap-2">
            <span className="text-emerald-300">{sample.label}</span>
            <span className="tabular-nums">{sample.valueMs.toFixed(1)}ms</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

