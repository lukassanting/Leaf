# `frontend/src/app/(workspace)/databases/[id]` Overview

This folder contains the dynamic **database table view** route.

## Route meaning

- `[id]` is the database UUID.
- The page loads the database model + rows/columns state and renders `components/database/DatabaseSurface`.

## What to edit

- Route orchestration & top-level props wiring: `page.tsx`
- State/actions (rows, columns, drafts, actions): `frontend/src/hooks/useDatabasePage.ts`
- Visual table UI: `frontend/src/components/database/DatabaseSurface.tsx` and related components.

