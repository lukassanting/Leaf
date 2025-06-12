from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.operations.leaf_operations import LeafOperations
from app.dtos.leaf_dtos import Leaf, LeafCreate
router = APIRouter()

@router.post("/leaves", response_model=Leaf)
async def create_leaf(
    leaf: LeafCreate,
    leaf_ops: LeafOperations = Depends(LeafOperations)
):
    return await leaf_ops.create_leaf(leaf)

@router.get("/leaves/{leaf_id}", response_model=Leaf)
async def read_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.get_leaf(leaf_id)

@router.get("/leaves", response_model=list[Leaf])
async def read_leaves(leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.get_all_leaves()

@router.put("/leaves/{leaf_id}", response_model=Leaf)
async def update_leaf(leaf_id: UUID, leaf: LeafCreate, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.update_leaf(leaf_id, leaf)

@router.delete("/leaves/{leaf_id}")
async def delete_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    await leaf_ops.delete_leaf(leaf_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)