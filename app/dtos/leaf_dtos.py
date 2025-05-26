from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from uuid import UUID


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
