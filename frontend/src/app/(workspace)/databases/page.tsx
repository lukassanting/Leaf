'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { databasesApi } from '@/lib/api'
import { useNavigationProgress } from '@/components/NavigationProgress'
import { createDatabaseAndEmit } from '@/lib/databaseMutations'
import { useWarmWorkspaceRoutes } from '@/hooks/useWarmWorkspaceRoutes'
import { warmDatabaseRoute } from '@/lib/warmEditorRoute'
import type { Database } from '@/lib/api'

export default function DatabasesPage() {
  const router = useRouter()
  const { startNavigation, stopNavigation } = useNavigationProgress()
  const [list, setList] = useState<Database[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useWarmWorkspaceRoutes()

  useEffect(() => {
    databasesApi.list()
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const createDb = useCallback(async () => {
    const title = newTitle.trim() || 'Untitled Database'
    setCreating(true)
    try {
      startNavigation()
      void warmDatabaseRoute()
      const db = await createDatabaseAndEmit({ title })
      setList((prev) => [...prev, db])
      setNewTitle('')
      router.push(`/databases/${db.id}`)
    } catch (e) {
      stopNavigation()
      console.error(e)
    } finally {
      setCreating(false)
    }
  }, [newTitle, router, startNavigation, stopNavigation])

  return (
    <main className="flex-1 p-8 max-w-3xl">
      <h1 className="mb-1 text-2xl font-medium" style={{ color: 'var(--leaf-text-title)' }}>Databases</h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--leaf-text-muted)' }}>
        Table views for structured data. Rows can link to pages.
      </p>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          placeholder="Database name…"
          className="max-w-xs flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--leaf-border-strong)' }}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createDb()}
        />
        <button
          type="button"
          onClick={createDb}
          disabled={creating}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
          style={{ background: 'var(--leaf-green)' }}
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--leaf-text-muted)' }}>Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--leaf-text-muted)' }}>No databases yet.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((db) => (
            <li key={db.id}>
              <Link
                href={`/databases/${db.id}`}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ transition: 'background-color 150ms ease' }}
                onClick={() => startNavigation()}
                onMouseEnter={() => { void warmDatabaseRoute() }}
              >
                <span className="text-sm" style={{ color: 'var(--leaf-text-muted)' }}>⊞</span>
                <span className="text-sm font-medium" style={{ color: 'var(--leaf-text-title)' }}>
                  {db.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
