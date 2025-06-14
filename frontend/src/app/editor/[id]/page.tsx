// frontend/src/app/editor/[id]/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

export default function EditorPage() {
  const params = useParams()
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
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/leaves/${leafId}`, {
        title,
        content: newContent,
      })
    } catch (err) {
      console.error('Failed to save leaf:', err)
    }
  }

  if (loading) return <div className="p-4 text-gray-500">Loading leaf...</div>

  return (
    <div className="min-h-screen bg-leaf-50 p-6">
      <h1 className="text-3xl font-serif text-leaf-800 mb-4">{title}</h1>
      <Editor content={content} onUpdate={handleUpdate} />
    </div>
  )
}
