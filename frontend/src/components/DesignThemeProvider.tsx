'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  applyLeafDesignToDocument,
  LEAF_DESIGN_STORAGE_KEY,
  readStoredLeafDesign,
  type LeafDesignId,
} from '@/lib/designTheme'

type Ctx = {
  design: LeafDesignId
  setDesign: (d: LeafDesignId) => void
  toggleDesign: () => void
}

const DesignThemeContext = createContext<Ctx>({
  design: 'default',
  setDesign: () => {},
  toggleDesign: () => {},
})

export function useLeafDesign() {
  return useContext(DesignThemeContext)
}

export function DesignThemeProvider({ children }: { children: React.ReactNode }) {
  const [design, setDesignState] = useState<LeafDesignId>(() =>
    typeof window !== 'undefined' ? readStoredLeafDesign() : 'default',
  )

  useEffect(() => {
    applyLeafDesignToDocument(design)
    try {
      localStorage.setItem(LEAF_DESIGN_STORAGE_KEY, design)
    } catch {
      // ignore
    }
  }, [design])

  const setDesign = useCallback((d: LeafDesignId) => {
    setDesignState(d)
  }, [])

  const toggleDesign = useCallback(() => {
    setDesignState((prev) => (prev === 'campaign' ? 'default' : 'campaign'))
  }, [])

  const value = useMemo(
    () => ({ design, setDesign, toggleDesign }),
    [design, setDesign, toggleDesign],
  )

  return <DesignThemeContext.Provider value={value}>{children}</DesignThemeContext.Provider>
}
