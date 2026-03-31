"""
Sync DTOs (`backend/app/dtos/sync_dtos.py`).

Purpose:
- Pydantic request/response schemas for the sync subsystem:
  sync status, configuration, conflicts, and conflict resolution.
"""

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SyncMode(str, Enum):
    OFF = "off"
    FOLDER = "folder"
    GIT = "git"


class SyncState(str, Enum):
    IDLE = "idle"
    WATCHING = "watching"
    SYNCING = "syncing"
    ERROR = "error"


class SyncError(BaseModel):
    id: str
    timestamp: datetime
    message: str
    file_path: Optional[str] = None


class GitStatus(BaseModel):
    initialized: bool = False
    configured: bool = False
    syncing: bool = False
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    remote_url: Optional[str] = None
    branch: str = "main"
    last_commit: Optional[str] = None
    has_uncommitted: bool = False


class SyncStatus(BaseModel):
    mode: SyncMode
    state: SyncState
    last_sync_at: Optional[datetime] = None
    pending_changes: int = 0
    conflicts_count: int = 0
    errors: list[SyncError] = Field(default_factory=list)
    git: Optional[GitStatus] = None


class ConflictType(str, Enum):
    CONTENT = "content"
    DELETED_LOCALLY = "deleted_locally"
    DELETED_REMOTELY = "deleted_remotely"
    CLOUD_DUPLICATE = "cloud_duplicate"


class SyncConflict(BaseModel):
    id: str
    file_path: str
    local_updated_at: Optional[datetime] = None
    remote_updated_at: Optional[datetime] = None
    conflict_type: ConflictType
    local_title: Optional[str] = None
    remote_title: Optional[str] = None
    local_preview: Optional[str] = None
    remote_preview: Optional[str] = None
    detected_at: datetime = Field(default_factory=datetime.now)


class ConflictResolution(BaseModel):
    keep: Literal["local", "remote", "both"]


class SyncConfig(BaseModel):
    mode: SyncMode = SyncMode.OFF
    data_dir: str = ""
    watch_enabled: bool = True
    git_remote_url: Optional[str] = None
    git_sync_interval: int = 300  # seconds


class SyncConfigUpdate(BaseModel):
    mode: Optional[SyncMode] = None
    data_dir: Optional[str] = None
    watch_enabled: Optional[bool] = None
    git_remote_url: Optional[str] = None
    git_auth_token: Optional[str] = None
    git_sync_interval: Optional[int] = None
