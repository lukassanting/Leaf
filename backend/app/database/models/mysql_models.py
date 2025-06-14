from datetime import datetime
from uuid import uuid4
from sqlalchemy import func, Column, String, ForeignKey, DateTime, Text, Enum, Integer, JSON
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.dialects.mysql import JSON as MySQLJSON

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

    children = relationship("LeafModel", back_populates="parent")
    parent = relationship("LeafModel", back_populates="children", remote_side=[id])

    def is_project(self):
        return self.type == LeafType.PROJECT

    def is_page(self):
        return self.type == LeafType.PAGE