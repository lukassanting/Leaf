"""
Database DTOs (`backend/app/dtos/database_dtos.py`).

Purpose:
- Defines Pydantic schemas for database/table metadata and row properties.

How to read:
- `PropertyDefinition` and `DatabaseSchema` define column/property definitions (stored in `DatabaseModel.schema`).
- `DatabaseCreate` / `DatabaseUpdate` define what the API accepts for database metadata.
- `RowCreate` / `RowUpdate` define how row cell properties are submitted/updated.
- `Database` and `Row` are the response models returned by the controllers.

Update:
- To support new property types, extend `PropertyDefinition.type` and ensure frontend + persistence uses the same meaning.
- To change how row properties are stored, update the mapping in `DatabaseOperations`.

Debug:
- If you see rows not persisting, verify:
  - DTO typing here
  - `DatabaseOperations.update_row()` and `.properties` assignments
  - the JSON storage in `DatabaseRowModel.properties`
"""

import json
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
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    icon: Optional[dict[str, Any]] = None


class DatabaseUpdate(BaseModel):
    title: Optional[str] = None
    schema: Optional[DatabaseSchema] = None
    view_type: Optional[str] = None
    parent_leaf_id: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    icon: Optional[dict[str, Any]] = None


class Database(BaseModel):
    id: str
    title: str
    schema: DatabaseSchema
    view_type: str = "table"
    parent_leaf_id: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    icon: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


# ─── Rows ─────────────────────────────────────────────────────────────────────

class RowCreate(BaseModel):
    properties: dict[str, Any] = Field(default_factory=dict)


class RowUpdate(BaseModel):
    properties: Optional[dict[str, Any]] = None


class LeafHeaderBanner(BaseModel):
    src: str
    objectPosition: str = "50% 50%"


class Row(BaseModel):
    id: str
    database_id: str
    leaf_id: Optional[str] = None
    leaf_title: str = "Untitled"
    properties: dict[str, Any]
    leaf_header_banner: Optional[LeafHeaderBanner] = None
    created_at: datetime
    updated_at: datetime


class RemovePropertyResponse(BaseModel):
    """Returned by DELETE /databases/{id}/properties/{key} — updated schema + all rows."""

    database: Database
    rows: list[Row]
