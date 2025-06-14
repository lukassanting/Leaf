'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'

type Leaf = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export default function HomePage() {
  const [leaves, setLeaves] = useState<Leaf[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="min-h-screen bg-leaf-50 text-leaf-800 p-6">
      <h1 className="text-3xl font-serif mb-6">🌿 Your Forest</h1>
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
