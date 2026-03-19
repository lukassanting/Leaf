# `frontend/src/components/database` Overview

This folder contains the UI for database table views:

- `DatabaseSurface` / `DatabaseViews`: renders the table and view switching UI.
- `EmbeddedDatabaseBlock`: embeds database/table output in leaf content.
- `DatabaseViews` and related components manage columns/rows display and interaction.

Most data state/action logic lives in `frontend/src/hooks/useDatabasePage.ts`.

