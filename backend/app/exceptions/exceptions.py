"""
Leaf exceptions (`backend/app/exceptions/exceptions.py`).

Purpose:
- Defines HTTP-friendly exception classes used by controllers/operations.
- Centralizes both HTTP status codes and human-readable `detail` messages.

How to read:
- `LeafException` is the base type used for handler registration in `backend/app/main.py`.
- Specialized subclasses:
  - `LeafNotFound`: 404 when a leaf id doesn't exist
  - `LeafAlreadyExists`: 400 for uniqueness constraint errors
  - `FailedToCreateLeaf`: 400 when creation fails unexpectedly

Update:
- Add new exception subclasses by inheriting from `HTTPException` (or `LeafException` if you want standardized status/detail behavior).
- Ensure your code raises these exceptions from operations and controllers.

Debug:
- If errors aren’t formatted as expected, confirm:
  - `LeafException` is the exact type registered in `backend/app/main.py`
  - the raised exception inherits from it
"""

from uuid import UUID
from fastapi import HTTPException
from loguru import logger

# Local imports
from app.dtos.leaf_dtos import LeafCreate

class LeafException(HTTPException):
    """
    LeafException is a custom base exception that is used to handle errors in the Leaf API.
    """
    def __init__(self, status_code: int = 500, detail: str = "Internal Server Error"):
        self.status_code = status_code
        self.detail = detail
        logger.error(f"LeafException: {detail}")
        super().__init__(status_code=status_code, detail=detail)

class LeafNotFound(HTTPException):
    """
    LeafNotFound is an exception for when the MySQL database does not contain a leaf with the given id.
    """
    def __init__(self, status_code: int = 404, detail: str = "Leaf not found", leaf_id: UUID = None):
        self.status_code = status_code
        self.detail = f"Leaf not found: {leaf_id}: {detail}"
        super().__init__(status_code=status_code, detail=self.detail)

class LeafAlreadyExists(HTTPException):
    """
    LeafAlreadyExists is an exception for when the MySQL database already contains a leaf with the given id.
    """
    def __init__(self, status_code: int = 400, detail: str = "Leaf already exists", leaf: LeafCreate = None):
        self.status_code = status_code
        self.detail = f"Leaf already exists: {leaf}: {detail}"
        super().__init__(status_code=status_code, detail=self.detail)

class FailedToCreateLeaf(HTTPException):
    """
    FailedToCreateLeaf is an exception for when the MySQL database fails to create a leaf.
    """
    def __init__(self, status_code: int = 400, detail: str = "Failed to create leaf", leaf: LeafCreate = None):
        self.status_code = status_code
        self.detail = f"Failed to create leaf: {leaf}: {detail}"
        super().__init__(status_code=status_code, detail=self.detail)