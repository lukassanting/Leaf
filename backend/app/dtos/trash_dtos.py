"""API DTOs for Trash listing (`GET /trash`)."""

from datetime import datetime

from pydantic import BaseModel, Field


class TrashLeafItem(BaseModel):
    id: str
    title: str
    deleted_at: datetime
    purge_at: datetime


class TrashDatabaseItem(BaseModel):
    id: str
    title: str
    deleted_at: datetime
    purge_at: datetime


class TrashListResponse(BaseModel):
    leaves: list[TrashLeafItem] = Field(default_factory=list)
    databases: list[TrashDatabaseItem] = Field(default_factory=list)
    retention_days: int = 7


class TrashPurgeStats(BaseModel):
    purged_leaves: int = 0
    purged_databases: int = 0
