from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class LeafBase(BaseModel):
    title: str
    content: Optional[str] = None
    parent_id: Optional[UUID] = None


class LeafCreate(LeafBase):
    pass


class Leaf(LeafBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    children: list['Leaf'] = []

    class Config:
        from_attributes = True  # This enables ORM mode for SQLAlchemy models 