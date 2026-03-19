# `frontend/src/app/(workspace)/databases` Overview

This route segment implements the **database UI**:

- `page.tsx`: list all databases and create new ones.
- `[id]/page.tsx`: render a specific database table view (rows/columns + metadata editing).

Most row/cell editing behavior lives in:

- `frontend/src/hooks/useDatabasePage.ts`
- `frontend/src/components/database/*`

