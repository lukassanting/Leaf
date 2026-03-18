from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ─── Schema (column definitions) ─────────────────────────────────────────────

class PropertyDefinition(BaseModel):
    key: str
    label: str
    type: str = "text"  # "text" | "number" | "page_link"


class DatabaseSchema(BaseModel):
    properties: list[PropertyDefinition] = Field(default_factory=list)


# ─── Database ─────────────────────────────────────────────────────────────────

class DatabaseCreate(BaseModel):
    title: str = "Untitled database"
    schema: Optional[DatabaseSchema] = None
    view_type: str = "table"
    parent_leaf_id: Optional[str] = None


class DatabaseUpdate(BaseModel):
    title: Optional[str] = None
    schema: Optional[DatabaseSchema] = None
    view_type: Optional[str] = None
    parent_leaf_id: Optional[str] = None


class Database(BaseModel):
    id: str
    title: str
    schema: DatabaseSchema
    view_type: str = "table"
    parent_leaf_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ─── Rows ─────────────────────────────────────────────────────────────────────

class RowCreate(BaseModel):
    properties: dict[str, Any] = Field(default_factory=dict)


class RowUpdate(BaseModel):
    properties: Optional[dict[str, Any]] = None


class Row(BaseModel):
    id: str
    database_id: str
    leaf_id: Optional[str] = None
    leaf_title: str = "Untitled"
    properties: dict[str, Any]
    created_at: datetime
    updated_at: datetime
