from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, List
from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from pydantic import BaseModel, ConfigDict

from app.database.connectors.postgres import Base

class LeafBase(BaseModel):
    title: str
    content: Optional[str] = None
    parent_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)

class LeafCreate(LeafBase):
    pass

class Leaf(LeafBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    children: List['Leaf'] = []

class LeafModel(Base):
    __tablename__ = "leaves"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    parent_id = Column(PGUUID(as_uuid=True), ForeignKey("leaves.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    children = relationship("LeafModel", back_populates="parent")
    parent = relationship("LeafModel", back_populates="children", remote_side=[id])

    def to_pydantic(self) -> Leaf:
        return Leaf(
            id=self.id,
            title=self.title,
            content=self.content,
            parent_id=self.parent_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
            children=[child.to_pydantic() for child in self.children]
        )