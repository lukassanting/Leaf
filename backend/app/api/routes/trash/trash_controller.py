"""Trash listing (`GET /trash`). Purges expired items before returning the list."""

from fastapi import APIRouter, Depends

from app.config import ConfigSettings
from app.database.operations.trash_operations import TrashOperations
from app.dtos.trash_dtos import TrashListResponse

router = APIRouter()


@router.get("/trash", response_model=TrashListResponse)
def list_trash(
    cfg: ConfigSettings = Depends(ConfigSettings),
    ops: TrashOperations = Depends(TrashOperations),
):
    """Items older than `TRASH_RETENTION_DAYS` are permanently deleted before listing."""
    return ops.list_trash(cfg.TRASH_RETENTION_DAYS)
