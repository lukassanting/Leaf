from fastapi import APIRouter

# Local imports
from app.api.routes.leaf.leaf_crud_controller import router as leaf_router
from app.api.routes.database.database_controller import router as database_router

router = APIRouter()

router.include_router(leaf_router, prefix="", tags=["leaf"])
router.include_router(database_router, prefix="", tags=["database"])
