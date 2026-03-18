from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

class LeafType(str, Enum):
    PAGE = "page"
    PROJECT = "project"


def infer_leaf_type(parent_id: Optional[str], database_id: Optional[str]) -> LeafType:
    if parent_id or database_id:
        return LeafType.PAGE
    return LeafType.PROJECT


class LeafCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: Optional[dict[str, Any] | str] = None
    parent_id: Optional[str] = None
    database_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    icon: Optional[dict] = None
    properties: Optional[dict] = None


class LeafUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[dict[str, Any] | str] = None
    parent_id: Optional[str] = None
    database_id: Optional[str] = None
    children_ids: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    icon: Optional[dict] = None
    properties: Optional[dict] = None


class LeafContentUpdate(BaseModel):
    """Minimal payload for autosave; optional updated_at for conflict detection."""
    content: dict[str, Any] | str
    updated_at: Optional[datetime] = None


class Leaf(BaseModel):
    id: str
    title: str
    type: LeafType
    description: Optional[str] = None
    content: Optional[dict[str, Any] | str] = None
    parent_id: Optional[str] = None
    database_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    icon: Optional[dict] = None
    properties: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class LeafTreeItem(BaseModel):
    """Lightweight DTO for tree/navigation; no content."""
    id: str
    title: str
    type: LeafType
    parent_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    order: int = 0


class LeafReorderChildren(BaseModel):
    """Payload for reordering children of a leaf."""
    child_ids: list[str] = Field(default_factory=list)
