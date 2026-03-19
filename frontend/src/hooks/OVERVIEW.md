# `frontend/src/hooks` Overview

This folder contains client-side React hooks used to load state, coordinate saves, and provide derived values to routes/components.

Common responsibilities:

- Loading a leaf/database model into route state (`useLeafPageData`, `useDatabasePage`)
- Scheduling autosaves and returning status (`useLeafAutosave`)
- Breadcrumb building for navigation context (`useLeafBreadcrumbs`, `useDatabaseBreadcrumbs`)

