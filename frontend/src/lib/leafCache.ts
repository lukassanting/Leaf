/**
 * Leaf frontend: local-first cache (`frontend/src/lib/leafCache.ts`).
 *
 * Purpose:
 * - Provides a persistence layer for leaf UI data on the client:
 *   - IndexedDB (primary)
 *   - localStorage fallback (when IndexedDB isn’t available)
 * - Supports offline autosave by queueing pending content updates.
 *
 * How to read:
 * - The cache revolves around object stores:
 *   - `leaves` (leaf snapshots)
 *   - `tree` (sidebar tree items)
 *   - `pendingSaves` (offline autosave queue)
 * - Exports like `getCachedLeaf`, `setCachedLeaf`, `getCachedTree`, `setCachedTree`,
 *   and the pending-save queue helpers.
 *
 * Update:
 * - If you change the IndexedDB schema, update `openDB()` stores and their keyPaths.
 * - If you add fields to `CachedLeaf`, ensure reads/writes still serialize cleanly.
 *
 * Debug:
 * - If cache appears stale: confirm `setCached*` calls are happening and that the stored objects match the cache types.
 * - If offline saves don’t flush: check `pendingSaves` queue functions and `useLeafAutosave` flush logic.
 */
import type { LeafContent, LeafType } from './api'

/**
 * Local-first cache for Leaf: IndexedDB with fallback to localStorage.
 * - Instant load from cache, then revalidate from API.
 * - Writes go to cache first, then sync to API (queue when offline).
 */

const DB_NAME = 'leaf-cache'
const DB_VERSION = 1
const STORE_LEAVES = 'leaves'
const STORE_TREE = 'tree'
const STORE_PENDING = 'pendingSaves'
const TREE_KEY = 'tree'

export type CachedLeaf = {
  id: string
  title: string
  description?: string | null
  content: LeafContent | null
  content_text_length?: number
  updated_at: string
  parent_id: string | null
  database_id?: string | null
  children_ids: string[]
  properties?: Record<string, unknown> | null
  tags?: string[]
}

export type CachedTreeItem = {
  id: string
  title: string
  path?: string
  type: LeafType
  parent_id?: string | null
  children_ids: string[]
  tags?: string[]
  order: number
}

type PendingSave = {
  leafId: string
  content: LeafContent
  updated_at: string | null
  ts: number
}

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_LEAVES)) {
        db.createObjectStore(STORE_LEAVES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_TREE)) {
        db.createObjectStore(STORE_TREE)
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'leafId' })
      }
    }
  })
}

export async function getCachedLeaf(id: string): Promise<CachedLeaf | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEAVES, 'readonly')
      const req = tx.objectStore(STORE_LEAVES).get(id)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  } catch {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`leaf:${id}`) : null
    return raw ? (JSON.parse(raw) as CachedLeaf) : null
  }
}

export async function setCachedLeaf(leaf: CachedLeaf): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEAVES, 'readwrite')
      tx.objectStore(STORE_LEAVES).put(leaf)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`leaf:${leaf.id}`, JSON.stringify(leaf))
    }
  }
}

export async function getCachedTree(): Promise<CachedTreeItem[] | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TREE, 'readonly')
      const req = tx.objectStore(STORE_TREE).get(TREE_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  } catch {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('leaf:tree') : null
    return raw ? (JSON.parse(raw) as CachedTreeItem[]) : null
  }
}

export async function setCachedTree(items: CachedTreeItem[]): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TREE, 'readwrite')
      tx.objectStore(STORE_TREE).put(items, TREE_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('leaf:tree', JSON.stringify(items))
    }
  }
}

export async function enqueuePendingSave(leafId: string, content: LeafContent, updated_at: string | null): Promise<void> {
  try {
    const db = await openDB()
    const entry: PendingSave = { leafId, content, updated_at, ts: Date.now() }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite')
      tx.objectStore(STORE_PENDING).put(entry)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // no-op when storage fails
  }
}

export async function getPendingSaves(): Promise<PendingSave[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly')
      const req = tx.objectStore(STORE_PENDING).getAll()
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  } catch {
    return []
  }
}

export async function clearPendingSave(leafId: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite')
      tx.objectStore(STORE_PENDING).delete(leafId)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // no-op
  }
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}
