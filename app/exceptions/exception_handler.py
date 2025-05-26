from fastapi import Request
from fastapi.responses import JSONResponse

from app.exceptions.exceptions import *


async def exception_handler(request: Request, exc: LeafException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
