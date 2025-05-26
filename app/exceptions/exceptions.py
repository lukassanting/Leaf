from fastapi import HTTPException
from loguru import logger

class LeafException(HTTPException):
    """
    LeafException is a custom base exception that is used to handle errors in the Leaf API.
    """
    def __init__(self, status_code: int = 500, detail: str = "Internal Server Error"):
        self.status_code = status_code
        self.detail = detail
        logger.error(f"LeafException: {detail}")
        super().__init__(status_code=status_code, detail=detail)

