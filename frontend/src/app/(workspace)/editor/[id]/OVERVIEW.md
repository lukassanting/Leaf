# `frontend/src/app/(workspace)/editor/[id]` Overview

This folder contains the dynamic **Leaf editor** route.

## Route meaning

- The `[id]` segment is the leaf UUID.
- The page loads the leaf content + metadata, renders `components/Editor`, and performs autosave.

## What to edit

- Route UI/state orchestration: `page.tsx`
- Autosave scheduling/state: `frontend/src/hooks/useLeafAutosave.ts`
- Data loading: `frontend/src/hooks/useLeafPageData.ts`
- Persistence helpers (client API wrappers + cache priming): `frontend/src/lib/*Mutations*`

