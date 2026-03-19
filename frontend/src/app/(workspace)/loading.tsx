/**
 * Leaf frontend: Workspace loading fallback (`frontend/src/app/(workspace)/loading.tsx`).
 *
 * Purpose:
 * - Displays a simple loading UI while Next.js is streaming/loading workspace routes.
 *
 * How to read:
 * - This is intentionally small: it just renders `LoadingShell` with a label.
 *
 * Update:
 * - Change the label text (or the `LoadingShell` component itself) to tweak the UX.
 *
 * Debug:
 * - If you don’t see this, confirm the route uses Next.js loading boundaries as expected.
 */


'use client'

import { LoadingShell } from '@/components/LoadingShell'

export default function WorkspaceLoading() {
  return <LoadingShell label="Loading workspace…" />
}
