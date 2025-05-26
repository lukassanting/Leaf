from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connectors.postgres import async_session
from app.database.models.leaf_model import Leaf as LeafModel
from app.schemas.leaf import Leaf, LeafCreate
from typing import List


router = APIRouter(prefix="/leaf", tags=["leaf"])


async def get_db():
    async with async_session() as session:
        yield session


@router.post("/", response_model=Leaf)
async def create_leaf(leaf: LeafCreate, db: AsyncSession = Depends(get_db)):
    db_leaf = LeafModel(**leaf.model_dump())
    db.add(db_leaf)
    await db.commit()
    await db.refresh(db_leaf)
    return db_leaf


@router.get("/", response_model=List[Leaf])
async def read_leaves(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LeafModel).offset(skip).limit(limit))
    leaves = result.scalars().all()
    return leaves


@router.get("/{leaf_id}", response_model=Leaf)
async def read_leaf(leaf_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LeafModel).filter(LeafModel.id == leaf_id))
    leaf = result.scalar_one_or_none()
    if leaf is None:
        raise HTTPException(status_code=404, detail="Leaf not found")
    return leaf
