from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class LeafModel(Base):
    __tablename__ = "leaves"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    parent_id = Column(String(36), ForeignKey("leaves.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    children = relationship("LeafModel", back_populates="parent")
    parent = relationship("LeafModel", back_populates="children", remote_side=[id])
