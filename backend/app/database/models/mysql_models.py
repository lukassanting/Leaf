"""
MySQL/SQLite persistence models (`backend/app/database/models/mysql_models.py`).

Purpose:
- Defines the SQLAlchemy ORM entities for the Leaf backend:
  - `LeafModel`: the self-referential tree node (page or project), including content + metadata
  - `DatabaseModel`: a “database container” (table view metadata)
  - `DatabaseRowModel`: a row inside a database (properties JSON + optional linked `leaf_id`)
  - `PageLinkModel`: tracks `[[wikilinks]]` between leaves for backlinks/graph

How to read:
- The model class docstrings (e.g. `DatabaseModel`, `DatabaseRowModel`, `PageLinkModel`) describe intent.
- Pay attention to the column types:
  - `children_ids`, `tags`, `icon`, `properties`, `schema` are JSON-like columns (`MySQLJSON = JSON`)
  - `children_ids` is wrapped with `MutableList` so updates persist

Update:
- If you add/change fields:
  1) update these models
  2) ensure migrations/column backfills exist in `database/connectors/mysql.py`
  3) update DTOs and operations mapping functions

Debug:
- Schema mismatch: verify the connector’s `_migrate_missing_columns()` and the DB already has new columns.
- JSON behavior: check how SQLAlchemy + `MutableList` handles in-place edits for your JSON columns.
"""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import func, Column, String, ForeignKey, DateTime, Text, Enum, Integer, JSON
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.ext.mutable import MutableList

# Standard JSON works with SQLite (JSON1 extension, included since SQLite 3.9)
MySQLJSON = JSON

from app.dtos.leaf_dtos import LeafType

Base = declarative_base()

class LeafModel(Base):
    __tablename__ = "leaves"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    type = Column(Enum(LeafType), nullable=False, default=LeafType.PAGE)
    content = Column(Text, nullable=True)
    parent_id = Column(String(36), ForeignKey("leaves.id"), nullable=True)
    children_ids = Column(MutableList.as_mutable(MySQLJSON), default=list)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    order = Column(Integer, nullable=False, default=0)  # For maintaining order of items
    tags = Column(MySQLJSON, nullable=True, default=list)
    icon = Column(MySQLJSON, nullable=True, default=None)  # {"type": "emoji"|"svg"|"image", "value": "..."}
    properties = Column(MySQLJSON, nullable=True, default=None)  # {"key": "value", ...}
    database_id = Column(String(36), ForeignKey("databases.id", ondelete="SET NULL"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # soft-delete → Trash; null = active

    children = relationship("LeafModel", back_populates="parent")
    parent = relationship("LeafModel", back_populates="children", remote_side=[id])

    def is_project(self):
        return self.type == LeafType.PROJECT

    def is_page(self):
        return self.type == LeafType.PAGE


class DatabaseModel(Base):
    """Structured database container (default table view)."""
    __tablename__ = "databases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title = Column(String(255), nullable=False, default="Untitled database")
    schema = Column(MySQLJSON, nullable=True, default=None)  # {"properties": [...]}
    view_type = Column(String(20), nullable=False, default="table")
    parent_leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    deleted_at = Column(DateTime, nullable=True)  # soft-delete; null = active


class DatabaseRowModel(Base):
    """A row in a database; properties stored as JSON (e.g. title, leaf_id)."""
    __tablename__ = "database_rows"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    database_id = Column(String(36), ForeignKey("databases.id", ondelete="CASCADE"), nullable=False)
    properties = Column(MySQLJSON, nullable=False, default=dict)  # {"title": "...", "leaf_id": "..."}
    leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="SET NULL"), nullable=True)
    order = Column(Integer, nullable=False, default=0)  # display order within database (table/list/board)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class PageLinkModel(Base):
    """Tracks [[wikilink]] references between pages for backlinks."""
    __tablename__ = "page_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False, index=True)
    target_leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now)