'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { databasesApi } from '@/lib/api'
import type { Database } from '@/lib/api'

export default function DatabasesPage() {
  const router = useRouter()
  const [list, setList] = useState<Database[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

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
      const db = await databasesApi.create({ title })
      setList((prev) => [...prev, db])
      setNewTitle('')
      router.push(`/databases/${db.id}`)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }, [newTitle, router])

  return (
    <main className="flex-1 p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-leaf-900 mb-1">Databases</h1>
      <p className="text-leaf-500 text-sm mb-6">
        Table views for structured data. Rows can link to pages.
      </p>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          placeholder="Database name…"
          className="border border-leaf-200 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-leaf-400"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createDb()}
        />
        <button
          type="button"
          onClick={createDb}
          disabled={creating}
          className="bg-leaf-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-leaf-700 disabled:opacity-50 transition"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>

      {loading ? (
        <p className="text-leaf-400 text-sm">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-leaf-400 text-sm">No databases yet.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((db) => (
            <li key={db.id}>
              <Link
                href={`/databases/${db.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-leaf-50 group"
              >
                <span className="text-leaf-400 text-sm">⊞</span>
                <span className="text-sm font-medium text-leaf-800 group-hover:text-leaf-900">
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
