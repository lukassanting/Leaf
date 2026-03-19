# `backend/app/api/routes/leaf` Overview

Leaf endpoints for page/project nodes in the tree.

- `leaf_crud_controller.py` defines:
  - leaf CRUD
  - content autosave + metadata updates
  - tree listing (`/leaves/tree`)
  - backlinks and graph (`/leaves/{id}/backlinks`, `/leaves/graph`)

Persistence and query behavior is implemented in `backend/app/database/operations/leaf_operations.py`.

