from datetime import datetime
from pydantic import BaseModel
from typing import Any, Optional


# ─── Schema (column definitions) ─────────────────────────────────────────────

class PropertyDefinition(BaseModel):
    key: str
    label: str
    type: str = "text"  # "text" | "number" | "page_link"


class DatabaseSchema(BaseModel):
    properties: list[PropertyDefinition] = []


# ─── Database ─────────────────────────────────────────────────────────────────

class DatabaseCreate(BaseModel):
    title: str = "Untitled database"
    schema: Optional[DatabaseSchema] = None
    view_type: str = "table"


class Database(BaseModel):
    id: str
    title: str
    schema: DatabaseSchema
    view_type: str = "table"
    created_at: datetime
    updated_at: datetime


# ─── Rows ─────────────────────────────────────────────────────────────────────

class RowCreate(BaseModel):
    properties: dict[str, Any] = {}


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
