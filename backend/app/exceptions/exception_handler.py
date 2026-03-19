"""
Leaf exception handler (`backend/app/exceptions/exception_handler.py`).

Purpose:
- Converts `LeafException` instances into a consistent JSON error response for FastAPI.

How to read:
- `leaf_exception_handler(request, exc)` returns `JSONResponse` with:
  - `status_code=exc.status_code`
  - `{"detail": exc.detail}`
- `LeafException` class definition lives in `backend/app/exceptions/exceptions.py`.

Update:
- If you add new exception types, ensure they inherit from `LeafException` (or update this handler accordingly).
- To change the error payload format, update `JSONResponse(content=...)`.

Debug:
- If API clients see generic 500s instead of JSON errors, check whether the exception is actually the `LeafException` type
  and whether `backend/app/main.py` registers `app.add_exception_handler(LeafException, leaf_exception_handler)`.
"""

from fastapi import Request
from fastapi.responses import JSONResponse

# Local imports
from app.exceptions.exceptions import *

async def leaf_exception_handler(request: Request, exc: LeafException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
