# `frontend/src/app/(workspace)` Overview

This route segment holds the **workspace shell** and the workspace pages rendered inside it.

## Key files

- `layout.tsx`: client-side shell that wraps `children` with sidebar/focus/AI providers and keyboard shortcuts.
- `page.tsx`: workspace home (greeting, recent pages, create-new flow).
- `loading.tsx`: loading boundary for workspace routes.
- `editor/[id]/page.tsx`: leaf editor route.
- `databases/page.tsx` and `databases/[id]/page.tsx`: database list + database table view.
- `graph/page.tsx`: graph visualization view.

