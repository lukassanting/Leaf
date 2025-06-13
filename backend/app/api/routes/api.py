from fastapi import APIRouter

# Local imports
from app.api.routes.leaf.leaf_crud_controller import router as leaf_router

router = APIRouter()

router.include_router(leaf_router, prefix="", tags=["leaf"])
