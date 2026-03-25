"""
Leaf CRUD & graph endpoints controller (`backend/app/api/routes/leaf/leaf_crud_controller.py`).

Purpose:
- Defines the HTTP API for leaf tree pages/projects:
  - create/read/update/delete
  - content autosave (`PATCH /leaves/{leaf_id}/content`)
  - reorder children (`PUT /leaves/{leaf_id}/reorder-children`)
  - lightweight tree (`GET /leaves/tree`)
  - backlinks + explicit wikilink graph (`backlinks`, `graph`)

How to read:
- Each endpoint delegates to `LeafOperations` via FastAPI `Depends(LeafOperations)`.
- DTO types in `app.dtos.leaf_dtos` define request/response schemas.
- Path vs query params: `read_leaf_tree` uses optional filters (`type`, `parent_id`) plus `limit/offset`.

Update:
- To change the behavior of an endpoint, prefer editing `LeafOperations` in `app/database/operations/leaf_operations.py`.
- To add a new leaf endpoint, add a new function here and route it into `LeafOperations`.

Debug:
- If you get validation errors, check the DTO types in `app/dtos/leaf_dtos.py`.
- If operations throw DB errors, inspect the corresponding `LeafOperations.*` method called by the endpoint.
"""

from fastapi import APIRouter, Depends, Query, Response, status
from uuid import UUID

# Local imports
from app.database.operations.leaf_operations import LeafOperations
from app.dtos.leaf_dtos import Leaf, LeafContentUpdate, LeafCreate, LeafGraph, LeafReorderChildren, LeafTreeItem, LeafType, LeafUpdate

router = APIRouter()

@router.post("/leaves", response_model=Leaf)
async def create_leaf(
    leaf: LeafCreate,
    leaf_ops: LeafOperations = Depends(LeafOperations)
):
    return await leaf_ops.create_leaf(leaf)

@router.get("/leaves", response_model=list[Leaf])
async def read_leaves(leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.get_all_leaves()

@router.get("/leaves/tree", response_model=list[LeafTreeItem])
async def read_leaf_tree(
    leaf_ops: LeafOperations = Depends(LeafOperations),
    type: LeafType | None = Query(None, alias="type"),
    parent_id: str | None = Query(None),
    limit: int | None = Query(None, ge=1, le=500),
    offset: int | None = Query(None, ge=0),
    include_db_rows: bool = Query(False),
):
    """
    Returns lightweight tree items (no content). Optional: type, parent_id, limit, offset.
    Pass include_db_rows=true to also return database row pages (for wikilink search).
    """
    return await leaf_ops.get_leaf_tree(
        type_filter=type,
        parent_id=parent_id,
        limit=limit,
        offset=offset,
        include_db_rows=include_db_rows,
    )

@router.get("/leaves/{leaf_id}/backlinks", response_model=list[LeafTreeItem])
async def get_backlinks(
    leaf_id: UUID,
    leaf_ops: LeafOperations = Depends(LeafOperations),
):
    """Return pages that link to this leaf via [[wikilinks]]."""
    return await leaf_ops.get_backlinks(leaf_id)

@router.get("/leaves/graph", response_model=LeafGraph)
async def get_leaf_graph(
    leaf_ops: LeafOperations = Depends(LeafOperations),
):
    return await leaf_ops.get_leaf_graph()

@router.post("/leaves/{leaf_id}/restore", response_model=Leaf)
async def restore_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    """Restore a page/project from Trash (and trashed ancestors/descendants as needed)."""
    return await leaf_ops.restore_leaf(leaf_id)

@router.get("/leaves/{leaf_id}", response_model=Leaf)
async def read_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.get_leaf(leaf_id)

@router.patch("/leaves/{leaf_id}/content", response_model=Leaf)
async def patch_leaf_content(
    leaf_id: UUID,
    body: LeafContentUpdate,
    leaf_ops: LeafOperations = Depends(LeafOperations),
):
    """Autosave: update only content. Send optional updated_at for conflict detection."""
    return await leaf_ops.patch_leaf_content(leaf_id, body)

@router.put("/leaves/{leaf_id}/reorder-children", response_model=Leaf)
async def reorder_leaf_children(
    leaf_id: UUID,
    body: LeafReorderChildren,
    leaf_ops: LeafOperations = Depends(LeafOperations),
):
    """Set the order of children for this leaf (parent). Body: { "child_ids": ["id1", "id2", ...] }."""
    return await leaf_ops.reorder_children(leaf_id, body.child_ids)

@router.put("/leaves/{leaf_id}", response_model=Leaf)
async def update_leaf(leaf_id: UUID, leaf: LeafUpdate, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.update_leaf(leaf_id, leaf)

@router.delete("/leaves/{leaf_id}")
async def delete_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    await leaf_ops.delete_leaf(leaf_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)