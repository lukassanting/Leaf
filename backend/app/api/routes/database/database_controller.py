from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.database.operations.database_operations import DatabaseOperations
from app.dtos.database_dtos import Database, DatabaseCreate, Row, RowCreate, RowUpdate

router = APIRouter()


@router.post("/databases", response_model=Database)
def create_database(
    body: DatabaseCreate,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    return ops.create_database(body)


@router.get("/databases", response_model=list[Database])
def list_databases(ops: DatabaseOperations = Depends(DatabaseOperations)):
    return ops.get_all_databases()


@router.get("/databases/{database_id}", response_model=Database)
def get_database(
    database_id: UUID,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    db = ops.get_database(database_id)
    if not db:
        raise HTTPException(status_code=404, detail="Database not found")
    return db


@router.put("/databases/{database_id}", response_model=Database)
def update_database(
    database_id: UUID,
    body: DatabaseCreate,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    db = ops.update_database(database_id, body)
    if not db:
        raise HTTPException(status_code=404, detail="Database not found")
    return db


@router.delete("/databases/{database_id}", status_code=204)
def delete_database(
    database_id: UUID,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    if not ops.delete_database(database_id):
        raise HTTPException(status_code=404, detail="Database not found")


@router.post("/databases/{database_id}/rows", response_model=Row)
def create_row(
    database_id: UUID,
    body: RowCreate,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    row = ops.create_row(database_id, body)
    if not row:
        raise HTTPException(status_code=404, detail="Database not found")
    return row


@router.get("/databases/{database_id}/rows", response_model=list[Row])
def list_rows(
    database_id: UUID,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    return ops.get_rows(database_id)


@router.get("/databases/{database_id}/rows/{row_id}", response_model=Row)
def get_row(
    database_id: UUID,
    row_id: UUID,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    row = ops.get_row(database_id, row_id)
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    return row


@router.patch("/databases/{database_id}/rows/{row_id}", response_model=Row)
def update_row(
    database_id: UUID,
    row_id: UUID,
    body: RowUpdate,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    row = ops.update_row(database_id, row_id, body)
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    return row


@router.delete("/databases/{database_id}/rows/{row_id}", status_code=204)
def delete_row(
    database_id: UUID,
    row_id: UUID,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    if not ops.delete_row(database_id, row_id):
        raise HTTPException(status_code=404, detail="Row not found")
