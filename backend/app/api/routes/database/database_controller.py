"""
Database CRUD & row endpoints controller (`backend/app/api/routes/database/database_controller.py`).

Purpose:
- Defines the HTTP API for “database tables” and their rows:
  - `POST/GET/PUT/DELETE /databases`
  - `POST/GET/PATCH/DELETE /databases/{database_id}/rows`
  - `GET /databases/{database_id}/rows/{row_id}`

How to read:
- Endpoints delegate to `DatabaseOperations` via `Depends(DatabaseOperations)`.
- DTOs in `app.dtos.database_dtos` define schema for databases and row cell properties.

Update:
- To change persistence logic, edit `app/database/operations/database_operations.py` (not this controller).
- To add a new row operation, add it here and implement the corresponding method on `DatabaseOperations`.

Debug:
- If a resource isn’t found, this controller raises `HTTPException(..., detail="... not found")`.
- If requests validate but data is wrong, inspect the `DatabaseOperations` implementation and DTO mapping.
"""

from urllib.parse import unquote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.database.operations.database_operations import DatabaseOperations
from app.dtos.database_dtos import (
    Database,
    DatabaseCreate,
    DatabaseUpdate,
    RemovePropertyResponse,
    Row,
    RowCreate,
    RowUpdate,
)

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
    body: DatabaseUpdate,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    db = ops.update_database(database_id, body)
    if not db:
        raise HTTPException(status_code=404, detail="Database not found")
    return db


@router.delete("/databases/{database_id}/properties/{property_key}", response_model=RemovePropertyResponse)
def remove_database_property(
    database_id: UUID,
    property_key: str,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    """Remove a schema column and delete that key from all rows."""
    result = ops.remove_schema_property(database_id, unquote(property_key))
    if result is None:
        raise HTTPException(status_code=404, detail="Database or property not found")
    database, rows = result
    return RemovePropertyResponse(database=database, rows=rows)


@router.delete("/databases/{database_id}", status_code=204)
def delete_database(
    database_id: UUID,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    if not ops.delete_database(database_id):
        raise HTTPException(status_code=404, detail="Database not found")


@router.post("/databases/{database_id}/restore", response_model=Database)
def restore_database(
    database_id: UUID,
    ops: DatabaseOperations = Depends(DatabaseOperations),
):
    """Undo soft-delete (e.g. after Cmd/Ctrl+Z in the client)."""
    db = ops.restore_database(database_id)
    if not db:
        raise HTTPException(status_code=404, detail="Database not found or not deleted")
    return db


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
    rows = ops.get_rows(database_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="Database not found")
    return rows


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
