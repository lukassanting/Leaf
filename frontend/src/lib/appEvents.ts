/**
 * Leaf frontend: cross-component event bridge (`frontend/src/lib/appEvents.ts`).
 *
 * Purpose:
 * - Provides typed helpers for emitting/listening to `window` events so loosely-coupled
 *   UI pieces (editor vs sidebar) can stay in sync without prop drilling.
 *
 * Events emitted:
 * - `leaf-created`
 * - `leaf-title-changed`
 * - `leaf-tree-changed`
 * - `leaf-database-created`
 *
 * How to read:
 * - Start with `emitEvent` / `subscribeEvent`.
 * - Then look at each exported `emit*` / `on*` helper (they are thin wrappers).
 *
 * Update:
 * - To add a new event:
 *   1) add a new `type ...Detail`
 *   2) add `emitX(detail)` and `onX(handler)` wrappers
 *   3) update listeners where needed (e.g. `SidebarTree` / `useSidebarTreeModel`).
 *
 * Debug:
 * - If sidebar doesn’t update after an editor action, verify:
 *   - the emitter function is called
 *   - listener registration runs in the mounted component/hook
 *   - the event name string matches exactly.
 */
'use client'

export type NodeKind = 'page' | 'database'

export type LeafCreatedDetail = {
  id: string
  title: string
  parent_id: string | null
  kind: NodeKind
}

export type LeafTitleChangedDetail = {
  id: string
  title: string
}

type EventHandler<T> = (detail: T) => void

function emitEvent<T>(name: string, detail: T) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<T>(name, { detail }))
}

function subscribeEvent<T>(name: string, handler: EventHandler<T>) {
  if (typeof window === 'undefined') return () => {}

  const wrapped = (event: Event) => handler((event as CustomEvent<T>).detail)
  window.addEventListener(name, wrapped)
  return () => window.removeEventListener(name, wrapped)
}

export function emitLeafCreated(detail: LeafCreatedDetail) {
  emitEvent('leaf-created', detail)
}

export function onLeafCreated(handler: EventHandler<LeafCreatedDetail>) {
  return subscribeEvent('leaf-created', handler)
}

export function emitLeafTitleChanged(detail: LeafTitleChangedDetail) {
  emitEvent('leaf-title-changed', detail)
}

export function onLeafTitleChanged(handler: EventHandler<LeafTitleChangedDetail>) {
  return subscribeEvent('leaf-title-changed', handler)
}

export function emitLeafTreeChanged() {
  emitEvent('leaf-tree-changed', {})
}

export function onLeafTreeChanged(handler: EventHandler<Record<string, never>>) {
  return subscribeEvent('leaf-tree-changed', handler)
}

export function emitLeafDatabaseCreated() {
  emitEvent('leaf-database-created', {})
}

export function onLeafDatabaseCreated(handler: EventHandler<Record<string, never>>) {
  return subscribeEvent('leaf-database-created', handler)
}
