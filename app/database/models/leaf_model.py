# External imports
from sqlalchemy import Column, String, ForeignKey, DateTime, UUID, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4

# Local imports
from app.database.connectors.postgres import Base

class Leaf(Base):
    __tablename__ = "leaves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("leaves.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    children = relationship("Leaf", back_populates="parent")
    
