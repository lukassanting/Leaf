from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

# class LeafBase(BaseModel):
#     title: str
#     content: Optional[str] = None
#     parent_id: Optional[UUID] = None

#     model_config = ConfigDict(from_attributes=True)

# class LeafCreate(LeafBase):
#     pass

# class Leaf(LeafBase):
#     id: UUID
#     created_at: datetime
#     updated_at: datetime
#     children: list['Leaf'] = []

class LeafCreate(BaseModel):
    title: str
    content: Optional[str] = None
    parent_id: Optional[UUID] = None
    
class Leaf(BaseModel):
    id: UUID
    title: str
    content: Optional[str] = None
    parent_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
