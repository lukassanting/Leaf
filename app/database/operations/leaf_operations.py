from uuid import UUID
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.leaf_model import LeafModel, Leaf, LeafCreate
from app.dependencies.dependencies import get_db
from app.exceptions.exceptions import LeafException

class LeafOperations:
    def __init__(self, db: AsyncSession = Depends(get_db)):
        self.db = db

    async def create_leaf(self, leaf: LeafCreate) -> Leaf:
        try:
            db_leaf = LeafModel(**leaf.model_dump())
            self.db.add(db_leaf)
            await self.db.commit()
            await self.db.refresh(db_leaf)
            return db_leaf.to_pydantic()
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))
    
    async def get_all_leaves(self) -> list[Leaf]:
        try:
            result = await self.db.execute(select(LeafModel))
            leaves = result.scalars().all()
            return [leaf.to_pydantic() for leaf in leaves]
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))
    
    async def get_leaf(self, leaf_id: UUID) -> Leaf:
        try:
            result = await self.db.execute(select(LeafModel).where(LeafModel.id == leaf_id))
            leaf = result.scalar_one_or_none()
            if leaf is None:
                raise LeafException(status_code=404, detail="Leaf not found")
            return leaf.to_pydantic()
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))