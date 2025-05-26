
from uuid import UUID
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Local imports
from app.database.models.leaf_model import Leaf
from app.dependencies.dependencies import get_db
from app.exceptions.exceptions import LeafException

class LeafOperations:
    def __init__(self, db: AsyncSession = Depends(get_db)):
        self.db = db

    async def create_leaf(self, leaf: Leaf):
        try:
            self.db.add(leaf)
            await self.db.commit()
            await self.db.refresh(leaf)
            return leaf
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))
    
    async def get_all_leaves(self):
        try:
            leaves = await self.db.execute(select(Leaf))
            return leaves.scalars().all()
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))
    
    async def get_leaf(self, leaf_id: UUID):
        try:
            leaf = await self.db.execute(select(Leaf).where(Leaf.id == leaf_id))
            return leaf.scalar_one()
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))
    
    async def update_leaf(self, leaf_id: UUID, leaf: Leaf):
        try:
            leaf = await self.db.execute(select(Leaf).where(Leaf.id == leaf_id))
            leaf.update(leaf.model_dump())
            await self.db.commit()
            return leaf.scalar_one()
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))
    
    async def delete_leaf(self, leaf_id: UUID):
        try:
            leaf = await self.db.execute(select(Leaf).where(Leaf.id == leaf_id))
            await self.db.delete(leaf.scalar_one())
            await self.db.commit()
            return {"message": "Leaf deleted successfully"}
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))