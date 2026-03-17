from datetime import datetime
from pydantic import BaseModel, computed_field
from typing import Optional
from enum import Enum

class LeafType(str, Enum):
    PAGE = "page"
    PROJECT = "project"

class LeafCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[str] = None
    children_ids: Optional[list[str]] = []
    tags: Optional[list[str]] = []

    @computed_field
    @property
    def type(self) -> LeafType:
        if not self.parent_id:
            return LeafType.PROJECT
        return LeafType.PAGE

    def to_dict(self) -> dict:
        return {
            **self.model_dump(),
            "type": self.type.value
        }
    
class LeafContentUpdate(BaseModel):
    """Minimal payload for autosave; optional updated_at for conflict detection."""
    content: str
    updated_at: Optional[datetime] = None


class Leaf(BaseModel):
    id: str
    title: str
    type: LeafType
    description: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[str] = None
    children_ids: Optional[list[str]] = []
    tags: list[str] = []
    created_at: datetime
    updated_at: datetime


class LeafTreeItem(BaseModel):
    """Lightweight DTO for tree/navigation; no content."""
    id: str
    title: str
    type: LeafType
    parent_id: Optional[str] = None
    children_ids: Optional[list[str]] = []
    tags: list[str] = []
    order: int = 0


class LeafReorderChildren(BaseModel):
    """Payload for reordering children of a leaf."""
    child_ids: list[str] = []
