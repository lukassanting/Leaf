"""Trash: list (`GET /trash`), permanent delete (`DELETE`), purge all (`POST /trash/purge-all`)."""

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.responses import Response

from app.config import ConfigSettings
from app.runtime_config import inject_app_settings
from app.database.operations.trash_operations import TrashOperations
from app.dtos.trash_dtos import TrashListResponse, TrashPurgeAllResponse

router = APIRouter()


@router.get("/trash", response_model=TrashListResponse)
def list_trash(
    cfg: ConfigSettings = Depends(inject_app_settings),
    ops: TrashOperations = Depends(TrashOperations),
):
    """Items older than `TRASH_RETENTION_DAYS` are permanently deleted before listing."""
    return ops.list_trash(cfg.TRASH_RETENTION_DAYS)


@router.delete("/trash/leaves/{leaf_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_trashed_leaf(
    leaf_id: str,
    ops: TrashOperations = Depends(TrashOperations),
):
    """Remove a soft-deleted page from Trash immediately. Returns 404 if it is not in Trash."""
    if not ops.permanently_delete_trashed_leaf(leaf_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leaf not in trash or not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/trash/databases/{database_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_trashed_database(
    database_id: str,
    ops: TrashOperations = Depends(TrashOperations),
):
    """Remove a soft-deleted database from Trash immediately. Returns 404 if it is not in Trash."""
    if not ops.permanently_delete_trashed_database(database_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database not in trash or not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/trash/purge-all", response_model=TrashPurgeAllResponse)
def purge_all_trash(
    ops: TrashOperations = Depends(TrashOperations),
):
    """Permanently delete every item currently in Trash (no retention wait)."""
    return ops.purge_all_trashed()
