"""
Top-level API router mount (`backend/app/api/routes/api.py`).

Purpose:
- Creates a single `router` and includes:
  - leaf endpoints (`app.api.routes.leaf.leaf_crud_controller`)
  - database endpoints (`app.api.routes.database.database_controller`)

How to read:
- `router.include_router(..., tags=[...])` groups endpoints in OpenAPI.
- Prefix is `""` so the paths are defined inside each controller.

Update:
- To add new endpoint groups, create a new controller/router module and include it here.

Debug:
- If endpoints are missing from Swagger/OpenAPI, verify the controller is imported and included here.
"""

from fastapi import APIRouter

# Local imports
from app.api.routes.leaf.leaf_crud_controller import router as leaf_router
from app.api.routes.database.database_controller import router as database_router
from app.api.routes.sync.sync_controller import router as sync_router
from app.api.routes.trash.trash_controller import router as trash_router

router = APIRouter()

router.include_router(sync_router, prefix="", tags=["sync"])
router.include_router(trash_router, prefix="", tags=["trash"])
router.include_router(leaf_router, prefix="", tags=["leaf"])
router.include_router(database_router, prefix="", tags=["database"])
