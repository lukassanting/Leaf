import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.operations.leaf_operations import LeafOperations
from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.dtos.leaf_dtos import Leaf, LeafCreate
router = APIRouter()

@router.post("/leaves/", response_model=Leaf)
async def create_leaf(
    leaf: LeafCreate,
    db_connector: MySQLDatabaseConnector = Depends(get_db_connector)
):
    db_session = db_connector.get_db_session()
    leaf_ops = LeafOperations(db_session)
    return await leaf_ops.create_leaf(leaf)

@router.get("/leaves/", response_model=list[Leaf])
async def read_leaves(leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.get_all_leaves()

@router.get("/leaves/{leaf_id}", response_model=Leaf)
async def read_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.get_leaf(leaf_id)

@router.put("/leaves/{leaf_id}", response_model=Leaf)
async def update_leaf(leaf_id: UUID, leaf: LeafCreate, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.update_leaf(leaf_id, leaf)

@router.delete("/leaves/{leaf_id}", response_model=Leaf)
async def delete_leaf(leaf_id: UUID, leaf_ops: LeafOperations = Depends(LeafOperations)):
    return await leaf_ops.delete_leaf(leaf_id)