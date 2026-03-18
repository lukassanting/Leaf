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

    children = relationship("LeafModel", back_populates="parent")
    parent = relationship("LeafModel", back_populates="children", remote_side=[id])

    def is_project(self):
        return self.type == LeafType.PROJECT

    def is_page(self):
        return self.type == LeafType.PAGE


class DatabaseModel(Base):
    """Notion-like database container (table view)."""
    __tablename__ = "databases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title = Column(String(255), nullable=False, default="Untitled database")
    schema = Column(MySQLJSON, nullable=True, default=None)  # {"properties": [...]}
    view_type = Column(String(20), nullable=False, default="table")
    parent_leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class DatabaseRowModel(Base):
    """A row in a database; properties stored as JSON (e.g. title, leaf_id)."""
    __tablename__ = "database_rows"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    database_id = Column(String(36), ForeignKey("databases.id", ondelete="CASCADE"), nullable=False)
    properties = Column(MySQLJSON, nullable=False, default=dict)  # {"title": "...", "leaf_id": "..."}
    leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class PageLinkModel(Base):
    """Tracks [[wikilink]] references between pages for backlinks."""
    __tablename__ = "page_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False, index=True)
    target_leaf_id = Column(String(36), ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now)