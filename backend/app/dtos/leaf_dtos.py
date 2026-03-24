"""
Leaf DTOs (`backend/app/dtos/leaf_dtos.py`).

Purpose:
- Defines the Pydantic request/response schemas for leaf/page/project entities and graph data.

How to read:
- `LeafType` and `infer_leaf_type(...)` are used to decide page vs project classification.
- `LeafCreate`, `LeafUpdate`, and `LeafContentUpdate` define what API endpoints accept.
- `Leaf` is the full leaf response model.
- `LeafTreeItem` is the lightweight model used for `/leaves/tree`.
- `LeafGraphNode`, `LeafGraphEdge`, and `LeafGraph` are used by `/leaves/graph`.

Update:
- If the editor starts sending a new content shape, update `Leaf.content` typing and ensure backend serialization stays compatible.
- If you add a new metadata field, add it to `Leaf`, then wire it through operations and model mappings.

Debug:
- When FastAPI validation fails, check the request payload against the DTO types here.
"""

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
    order: Optional[int] = None


class LeafContentUpdate(BaseModel):
    """Minimal payload for autosave; optional updated_at for conflict detection."""
    content: dict[str, Any] | str
    updated_at: Optional[datetime] = None


class Leaf(BaseModel):
    id: str
    title: str
    path: str = ""
    type: LeafType
    description: Optional[str] = None
    content: Optional[dict[str, Any] | str] = None
    parent_id: Optional[str] = None
    database_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    icon: Optional[dict] = None
    properties: Optional[dict] = None
    content_text_length: int = 0
    created_at: datetime
    updated_at: datetime


class LeafTreeItem(BaseModel):
    """Lightweight DTO for tree/navigation; no content."""
    id: str
    title: str
    path: str = ""
    type: LeafType
    parent_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    order: int = 0


class LeafGraphNode(BaseModel):
    id: str
    title: str
    path: str
    type: LeafType
    tags: list[str] = Field(default_factory=list)


class LeafGraphEdge(BaseModel):
    source: str
    target: str


class LeafGraph(BaseModel):
    nodes: list[LeafGraphNode] = Field(default_factory=list)
    edges: list[LeafGraphEdge] = Field(default_factory=list)


class LeafReorderChildren(BaseModel):
    """Payload for reordering children of a leaf."""
    child_ids: list[str] = Field(default_factory=list)
