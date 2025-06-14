'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const leafId = params?.id as string

  const [content, setContent] = useState<string>('')
  const [title, setTitle] = useState<string>('Loading...')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaf = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/leaves/${leafId}`)
        setTitle(res.data.title)
        setContent(res.data.content || '')
      } catch (err) {
        console.error('Failed to load leaf:', err)
        setTitle('Error loading leaf')
      } finally {
        setLoading(false)
      }
    }
    fetchLeaf()
  }, [leafId])

  const handleUpdate = async (newContent: string) => {
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/leaves`, {
        title,
        content: newContent,
        parent_id: leafId,
      })
    } catch (err) {
      console.error('Failed to save leaf:', err)
    }
  }

  const createChild = async () => {
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/leaves`, {
        title: 'Untitled',
        parent_id: leafId,
      })
      router.push(`/editor/${res.data.id}`)
    } catch (err) {
      console.error('Failed to create child leaf:', err)
    }
  }

  if (loading) return <div className="p-4 text-gray-500">Loading leaf...</div>

  return (
    <div className="min-h-screen bg-leaf-50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-serif text-leaf-800">{title}</h1>
        <button
          onClick={createChild}
          className="bg-earth-500 text-white px-4 py-2 rounded hover:bg-earth-600"
        >
          ➕ New Child Leaf
        </button>
      </div>
      <Editor content={content} onUpdate={handleUpdate} />
    </div>
  )
}
