from fastapi import APIRouter
from app.routes.leaf.leaf_crud_controller import router as leaf_router

router = APIRouter()

router.include_router(leaf_router, prefix="/leaf")
