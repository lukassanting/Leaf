from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.database.connectors.postgres import async_session
from app.database.models.leaf_model import Leaf, LeafCreate
from app.database.operations.leaf_operations import LeafOperations

router = APIRouter()

async def get_db():
    async with async_session() as session:
        yield session

@router.post("/", response_model=Leaf)
async def create_leaf(leaf: LeafCreate, db: AsyncSession = Depends(get_db)):
    leaf_ops = LeafOperations(db)
    return await leaf_ops.create_leaf(leaf)

@router.get("/", response_model=List[Leaf])
async def read_leaves(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    leaf_ops = LeafOperations(db)
    leaves = await leaf_ops.get_all_leaves()
    return leaves[skip:skip + limit]

@router.get("/{leaf_id}", response_model=Leaf)
async def read_leaf(leaf_id: UUID, db: AsyncSession = Depends(get_db)):
    leaf_ops = LeafOperations(db)
    return await leaf_ops.get_leaf(leaf_id)

@router.put("/{leaf_id}", response_model=Leaf)
async def update_leaf(leaf_id: UUID, leaf: LeafCreate, db: AsyncSession = Depends(get_db)):
    leaf_ops = LeafOperations(db)
    return await leaf_ops.update_leaf(leaf_id, leaf)

@router.delete("/{leaf_id}", response_model=Leaf)
async def delete_leaf(leaf_id: UUID, db: AsyncSession = Depends(get_db)):
    leaf_ops = LeafOperations(db)
    return await leaf_ops.delete_leaf(leaf_id)