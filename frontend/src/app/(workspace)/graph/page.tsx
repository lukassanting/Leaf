/**
 * Leaf frontend: Graph view page (`frontend/src/app/(workspace)/graph/page.tsx`).
 *
 * Purpose:
 * - Visualizes the leaf graph (nodes/edges) for explicit wikilinks/backlinks.
 * - Provides a simple text filter and navigates to leaf editor on node click.
 *
 * How to read:
 * - Data is loaded once in `useEffect` via `leavesApi.getGraph()`.
 * - `query` filters nodes/edges using `useMemo` (title + path match).
 * - The SVG is built from `layout.positions` + `filteredEdges` + `visibleNodes`.
 *
 * Update:
 * - To change layout algorithm, modify the `layout` `useMemo` block.
 * - To add better filtering (e.g., by degree), update the `filteredNodeIds` / `degreeMap` logic.
 *
 * Debug:
 * - If graph is empty, check API response shape (`LeafGraph`) and whether `loading` flips to false.
 * - If clicks don’t navigate, verify the `router.push(`/editor/${node.id}`)` call and the node id mapping.
 */


'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { TopStrip } from '@/components/TopStrip'
import { StatusBar } from '@/components/StatusBar'
import { leavesApi, type LeafGraph } from '@/lib/api'

export default function GraphPage() {
  const router = useRouter()
  const { startNavigation } = useNavigationProgress()
  const [graph, setGraph] = useState<LeafGraph>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void leavesApi.getGraph()
      .then((data) => {
        if (!cancelled) setGraph(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const layout = useMemo(() => {
    const width = 900
    const height = 480
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.32
    const positions = new Map<string, { x: number; y: number }>()

    graph.nodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(graph.nodes.length, 1)
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    })

    return { width, height, positions }
  }, [graph])

  const filteredNodeIds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return new Set(graph.nodes.map((node) => node.id))
    }
    return new Set(
      graph.nodes
        .filter((node) => node.title.toLowerCase().includes(normalizedQuery) || node.path.toLowerCase().includes(normalizedQuery))
        .map((node) => node.id),
    )
  }, [graph.nodes, query])

  const filteredEdges = useMemo(() => (
    graph.edges.filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target))
  ), [filteredNodeIds, graph.edges])

  const visibleNodes = useMemo(() => (
    graph.nodes.filter((node) => filteredNodeIds.has(node.id))
  ), [filteredNodeIds, graph.nodes])

  const degreeMap = useMemo(() => {
    const next = new Map<string, number>()
    graph.nodes.forEach((node) => next.set(node.id, 0))
    filteredEdges.forEach((edge) => {
      next.set(edge.source, (next.get(edge.source) ?? 0) + 1)
      next.set(edge.target, (next.get(edge.target) ?? 0) + 1)
    })
    return next
  }, [filteredEdges, graph.nodes])

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'linear-gradient(180deg, var(--leaf-bg-editor), var(--leaf-bg-app))' }}
    >
      <TopStrip breadcrumbs={[]} currentTitle="Graph View" />
      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--leaf-text-title)', marginBottom: 8 }}>
              Graph View
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--leaf-text-muted)', maxWidth: 620, lineHeight: 1.6 }}>
              Leaf v4 graph mode visualizes explicit wikilinks between pages, using the same structured relationship model that powers linked mentions and backlinks.
            </div>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-4">
            {[
              { label: 'Visible pages', value: visibleNodes.length },
              { label: 'Visible links', value: filteredEdges.length },
              { label: 'All pages', value: graph.nodes.length },
              { label: 'All links', value: graph.edges.length },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: 'var(--leaf-border-soft)',
                  background: 'var(--leaf-glass)',
                  boxShadow: 'var(--leaf-shadow-soft)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--leaf-text-muted)', marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--leaf-text-title)' }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="mb-5 flex items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by page title or path…"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: 'var(--leaf-border-strong)',
                background: 'var(--leaf-glass)',
                color: 'var(--leaf-text-title)',
              }}
            />
          </div>

          <div
            className="rounded-[24px] border"
            style={{
              minHeight: 480,
              borderColor: 'var(--leaf-border-soft)',
              background: 'linear-gradient(180deg, var(--leaf-bg-elevated), var(--leaf-bg-editor))',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--leaf-shadow-soft)',
            }}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
              {filteredEdges.map((edge) => {
                const source = layout.positions.get(edge.source)
                const target = layout.positions.get(edge.target)
                if (!source || !target) return null
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="rgba(99,102,241,0.26)"
                    strokeWidth="1.2"
                  />
                )
              })}
              {visibleNodes.map((node) => {
                const position = layout.positions.get(node.id)
                if (!position) return null
                const degree = degreeMap.get(node.id) ?? 0
                const radius = Math.min(18, Math.max(9, 8 + degree * 1.5))
                return (
                  <g
                    key={node.id}
                    onClick={() => {
                      startNavigation()
                      router.push(`/editor/${node.id}`)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r={radius}
                      style={{
                        fill: 'color-mix(in srgb, var(--leaf-green) 14%, transparent)',
                        stroke: 'var(--leaf-green)',
                      }}
                      strokeWidth="1.2"
                    />
                    <text x={position.x + radius + 6} y={position.y - 1} fontSize="12" fill="var(--leaf-text-title)">
                      {node.title}
                    </text>
                    <text x={position.x + radius + 6} y={position.y + 13} fontSize="10" fill="var(--leaf-text-muted)">
                      {node.path}
                    </text>
                  </g>
                )
              })}
            </svg>
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, fontSize: 11.5, color: 'var(--leaf-text-muted)' }}>
              {loading
                ? 'Loading graph…'
                : `${visibleNodes.length} visible pages · ${filteredEdges.length} visible links`}
            </div>
          </div>
        </div>
      </div>
      <StatusBar saveStatus="saved" wordCount={0} modeLabel="Graph" />
    </div>
  )
}
