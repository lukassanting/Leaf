'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useRouter } from 'next/navigation'

type Leaf = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export default function HomePage() {
  const [leaves, setLeaves] = useState<Leaf[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const router = useRouter()

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/leaves`)
        // TODO: if (res.data.length === 0), render something else.
        setLeaves(res.data)
      } catch (err) {
        console.error('Failed to load leaves:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaves()
  }, [])

  if (loading) return <p className="p-4 text-gray-500">Loading leaves...</p>

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/leaves`, {
        title: newTitle,
      })
      const newLeaf = res.data
      router.push(`/editor/${newLeaf.id}`)
    } catch (err) {
      console.error('Failed to create leaf:', err)
    }
  }

  return (
    <div className="min-h-screen bg-leaf-50 text-leaf-800 p-6">
      <h1 className="text-3xl font-serif mb-6">🌿 My Leaves</h1>

      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="New leaf title..."
          className="border border-leaf-300 rounded px-3 py-2"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button
          onClick={handleCreate}
          className="bg-leaf-500 text-white px-4 py-2 rounded hover:bg-leaf-600"
        >
          ➕ Create
        </button>
      </div>

      <ul className="space-y-4">
        {leaves.map(leaf => (
          <li key={leaf.id} className="p-4 bg-white rounded-xl shadow hover:shadow-md transition">
            <Link href={`/editor/${leaf.id}`} className="text-xl font-semibold underline">
              {leaf.title || '(Untitled)'}
            </Link>
            <div className="text-sm text-leaf-600 mt-1">
              Updated: {new Date(leaf.updated_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
