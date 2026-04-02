export const LEAF_DESIGN_STORAGE_KEY = 'leaf-design'

export type LeafDesignId = 'default' | 'campaign'

export function isLeafDesignId(v: string | null): v is LeafDesignId {
  return v === 'default' || v === 'campaign'
}

export function readStoredLeafDesign(): LeafDesignId {
  if (typeof localStorage === 'undefined') return 'default'
  try {
    const raw = localStorage.getItem(LEAF_DESIGN_STORAGE_KEY)
    return isLeafDesignId(raw) ? raw : 'default'
  } catch {
    return 'default'
  }
}

export function applyLeafDesignToDocument(design: LeafDesignId) {
  const el = document.documentElement
  if (design === 'campaign') {
    el.setAttribute('data-leaf-design', 'campaign')
  } else {
    el.removeAttribute('data-leaf-design')
  }
}
