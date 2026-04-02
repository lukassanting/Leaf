/**
 * Leaf frontend: route “warming” helpers (`frontend/src/lib/warmEditorRoute.ts`).
 *
 * Purpose:
 * - Improves perceived performance by pre-loading heavy client bundles on idle/hover.
 * - Currently warms:
 *   - the Editor component chunk
 *   - the database view page chunk
 *
 * How to read:
 * - `warmEditorRoute()` and `warmDatabaseRoute()` use dynamic `import(...)` and
 *   cache promises so repeated calls don’t re-import.
 * - `scheduleWarmEditorRoute()` / `scheduleWarmDatabaseRoute()` attach an idle callback
 *   (or fallback timeout) and return a cancellation function.
 *
 * Update:
 * - To warm a new route/component, add a new cached `Promise<void>` and a new warm function.
 * - Keep guards like `typeof window === 'undefined'` to avoid SSR issues.
 *
 * Debug:
 * - If warming doesn’t seem to work, verify that callers invoke the schedule function
 *   (hover/focus/click) before navigation.
 */
let warmEditorPromise: Promise<void> | null = null
let warmDatabasePromise: Promise<void> | null = null

export function warmEditorRoute(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  if (!warmEditorPromise) {
    // Load the editor chunk early so the first real navigation does not pay
    // the TipTap bundle cost on demand.
    warmEditorPromise = import('@/components/Editor')
      .then(() => undefined)
      .catch(() => undefined)
  }

  return warmEditorPromise
}

export function warmDatabaseRoute(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  if (!warmDatabasePromise) {
    warmDatabasePromise = import('@/app/(workspace)/databases/[id]/page')
      .then(() => undefined)
      .catch(() => undefined)
  }

  return warmDatabasePromise
}

export function scheduleWarmEditorRoute(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const run = () => {
    void warmEditorRoute()
  }

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(run, { timeout: 1500 })
    return () => window.cancelIdleCallback(idleId)
  }

  const timeoutId = setTimeout(run, 250)
  return () => clearTimeout(timeoutId)
}

export function scheduleWarmDatabaseRoute(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const run = () => {
    void warmDatabaseRoute()
  }

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(run, { timeout: 1500 })
    return () => window.cancelIdleCallback(idleId)
  }

  const timeoutId = setTimeout(run, 400)
  return () => clearTimeout(timeoutId)
}
