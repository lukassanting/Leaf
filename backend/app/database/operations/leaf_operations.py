from datetime import datetime
from uuid import UUID
from fastapi import Depends
from loguru import logger

# Local imports
from app.database.models.mysql_models import LeafModel
from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.exceptions.exceptions import FailedToCreateLeaf, LeafException, LeafNotFound
from app.dtos.leaf_dtos import Leaf, LeafCreate

class LeafOperations:
    def __init__(self, db_connector: MySQLDatabaseConnector = Depends(get_db_connector)):
        self.db : MySQLDatabaseConnector = db_connector

    async def create_leaf(self, leaf: LeafCreate) -> Leaf:
        
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = LeafModel(**leaf.model_dump())
                db_session.add(db_leaf)
                db_session.commit()
                db_session.refresh(db_leaf)
                logger.info(f"Leaf created: {db_leaf.id}")
                return db_leaf
        except Exception as e:
            raise FailedToCreateLeaf(leaf=leaf, detail=str(e))
    
    async def get_leaf(self, leaf_id: UUID) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                
                leaf : LeafModel = db_session.query(LeafModel).filter(
                    LeafModel.id == str(leaf_id)
                ).first()

                if not leaf:
                    raise LeafNotFound(leaf_id=leaf_id)
                
                return Leaf(
                    id=leaf.id,
                    title=leaf.title,
                    content=leaf.content,
                    parent_id=leaf.parent_id if leaf.parent_id else None,
                    created_at=leaf.created_at,
                    updated_at=leaf.updated_at
                )
        except Exception as e:
            raise LeafException(status_code=e.status_code, detail=str(e))
    
    async def get_all_leaves(self) -> list[Leaf]:
        try:
            with self.db.get_db_session() as db_session:
                leaves : list[LeafModel] = db_session.query(LeafModel).all()
                if not leaves:
                    raise LeafNotFound()
                return [Leaf(
                    id=leaf.id,
                    title=leaf.title,
                    content=leaf.content,
                    parent_id=leaf.parent_id if leaf.parent_id else None,
                    created_at=leaf.created_at,
                    updated_at=leaf.updated_at
                ) for leaf in leaves]
        except Exception as e:
            raise LeafException(status_code=e.status_code, detail=str(e))
        
    async def update_leaf(self, leaf_id: UUID, leaf: LeafCreate) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                
                db_leaf : LeafModel = db_session.query(LeafModel).filter(
                    LeafModel.id == str(leaf_id)
                ).first()

                if not db_leaf:
                    raise LeafNotFound(leaf_id=leaf_id)
                
                for key, value in leaf.model_dump().items():
                    if key != "_sa_instance_state":
                        setattr(db_leaf, key, value)

                db_leaf.updated_at = datetime.now()
                db_session.commit()
                db_session.refresh(db_leaf)

                logger.info(f"Leaf updated: {db_leaf.id}")
                return Leaf(
                    id=db_leaf.id,
                    title=db_leaf.title,
                    content=db_leaf.content,
                    parent_id=db_leaf.parent_id if db_leaf.parent_id else None,
                    created_at=db_leaf.created_at,
                    updated_at=db_leaf.updated_at
                )
        except Exception as e:
            raise LeafException(status_code=e.status_code, detail=str(e))
        
    async def delete_leaf(self, leaf_id: UUID):
        try:
            with self.db.get_db_session() as db_session:
                
                db_leaf : LeafModel = db_session.query(LeafModel).filter(
                    LeafModel.id == str(leaf_id)
                ).first()

                if not db_leaf:
                    raise LeafNotFound(leaf_id=leaf_id)
                
                db_session.delete(db_leaf)
                db_session.commit()

                logger.info(f"Leaf deleted: {leaf_id}")
        except Exception as e:
            raise LeafException(status_code=e.status_code, detail=str(e))