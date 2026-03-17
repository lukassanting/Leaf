'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { databasesApi, leavesApi } from '@/lib/api'
import { SidebarTree } from './SidebarTree'

type DbItem = { id: string; title: string }

export function Sidebar({ activeId }: { activeId?: string }) {
  const router = useRouter()
  const [databases, setDatabases] = useState<DbItem[]>([])
  const [creatingPage, setCreatingPage] = useState(false)

  const fetchDatabases = useCallback(() => {
    databasesApi.list().then(setDatabases).catch(() => {})
  }, [])

  useEffect(() => {
    fetchDatabases()
    // Refresh sidebar when a database is created elsewhere (e.g. from the editor)
    window.addEventListener('leaf-database-created', fetchDatabases)
    return () => window.removeEventListener('leaf-database-created', fetchDatabases)
  }, [fetchDatabases])

  const handleNewPage = useCallback(async () => {
    if (creatingPage) return
    setCreatingPage(true)
    try {
      const leaf = await leavesApi.create({ title: 'Untitled' })
      router.push(`/editor/${leaf.id}`)
    } catch {
      console.error('Failed to create page')
    } finally {
      setCreatingPage(false)
    }
  }, [router, creatingPage])

  return (
    <aside className="w-60 shrink-0 border-r border-leaf-100 bg-white hidden md:flex md:flex-col">
      {/* Branding */}
      <div className="px-4 h-11 flex items-center border-b border-leaf-100 shrink-0">
        <Link href="/" className="text-sm font-semibold text-leaf-800 hover:text-leaf-600">
          Leaf
        </Link>
      </div>

      {/* Pages tree */}
      <div className="flex-1 overflow-hidden py-1">
        <SidebarTree activeId={activeId} />
      </div>

      {/* Databases list */}
      {databases.length > 0 && (
        <div className="border-t border-leaf-100 py-1 max-h-40 overflow-y-auto shrink-0">
          <p className="px-3 pt-1 pb-0.5 text-xs font-medium text-leaf-400 uppercase tracking-wide">
            Databases
          </p>
          <ul>
            {databases.map((db) => (
              <li key={db.id}>
                <Link
                  href={`/databases/${db.id}`}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-leaf-700 hover:bg-leaf-50 truncate"
                >
                  <span className="text-leaf-300 text-xs shrink-0">⊞</span>
                  {db.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create actions */}
      <div className="border-t border-leaf-100 p-2 shrink-0">
        <button
          type="button"
          onClick={handleNewPage}
          disabled={creatingPage}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-leaf-700 hover:bg-leaf-50 disabled:opacity-50 transition text-left"
        >
          <span className="text-base leading-none text-leaf-400">+</span>
          {creatingPage ? 'Creating…' : 'New page'}
        </button>
      </div>
    </aside>
  )
}
