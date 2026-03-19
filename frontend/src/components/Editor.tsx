/**
 * Leaf UI: editor barrel export (`frontend/src/components/Editor.tsx`).
 *
 * Purpose:
 * - Re-exports the default editor component and its action type from
 *   `frontend/src/components/editor/LeafEditor.tsx`.
 *
 * How to read:
 * - If you need editor behavior, go to `components/editor/LeafEditor.tsx`.
 * - This file exists so route pages can import `@/components/Editor` instead.
 *
 * Update:
 * - If you rename `LeafEditor` or change its exported action type, update re-exports here.
 *
 * Debug:
 * - If the editor import fails, verify path alias `@/components/editor/LeafEditor`
 *   and that the default export is present.
 */


export { type EditorActions } from '@/components/editor/LeafEditor'
export { default } from '@/components/editor/LeafEditor'
