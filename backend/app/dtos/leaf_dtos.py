from datetime import datetime
from pydantic import BaseModel, computed_field
from typing import Optional
from enum import Enum

class LeafType(str, Enum):
    PAGE = "page"
    PROJECT = "project"

class LeafCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[str] = None
    children_ids: Optional[list[str]] = []

    @computed_field
    @property
    def type(self) -> LeafType:
        if not self.parent_id:
            return LeafType.PROJECT
        return LeafType.PAGE

    def to_dict(self) -> dict:
        return {
            **self.model_dump(),
            "type": self.type.value
        }
    
class Leaf(BaseModel):
    id: str
    title: str
    type: LeafType
    description: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[str] = None
    children_ids: Optional[list[str]] = []
    created_at: datetime
    updated_at: datetime
