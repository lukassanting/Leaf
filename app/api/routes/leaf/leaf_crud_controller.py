from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.database.models.leaf_model import Leaf, LeafCreate
from app.database.operations.leaf_operations import LeafOperations

router = APIRouter()

@router.post("/", response_model=Leaf)
async def create_leaf(leaf: LeafCreate, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.create_leaf(leaf)

@router.get("/", response_model=List[Leaf])
async def read_leaves(skip: int = 0, limit: int = 100, leaf_ops: LeafOperations = Depends(LeafOperations)):
    leaves = await leaf_ops.get_all_leaves()
    return leaves[skip:skip + limit]

@router.get("/{leaf_id}", response_model=Leaf)
async def read_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.get_leaf(leaf_id)

@router.put("/{leaf_id}", response_model=Leaf)
async def update_leaf(leaf_id: UUID, leaf: LeafCreate, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.update_leaf(leaf_id, leaf)

@router.delete("/{leaf_id}", response_model=Leaf)
async def delete_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.delete_leaf(leaf_id)