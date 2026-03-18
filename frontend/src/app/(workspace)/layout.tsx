'use client'

import { useParams } from 'next/navigation'
import { NavigationProgressProvider } from '@/components/NavigationProgress'
import { Sidebar } from '@/components/Sidebar'

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  // params.id is present on /editor/[id] routes; undefined elsewhere
  const activeId = params?.id as string | undefined

  return (
    <NavigationProgressProvider>
      <div className="flex min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <Sidebar activeId={activeId} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </NavigationProgressProvider>
  )
}
