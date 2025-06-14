from datetime import datetime
from uuid import UUID
from fastapi import Depends
from loguru import logger

# Local imports
from app.database.models.mysql_models import LeafModel
from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.exceptions.exceptions import FailedToCreateLeaf, LeafException, LeafNotFound
from app.dtos.leaf_dtos import Leaf, LeafCreate, LeafType

class LeafOperations:
    def __init__(self, db_connector: MySQLDatabaseConnector = Depends(get_db_connector)):
        self.db : MySQLDatabaseConnector = db_connector

    async def create_leaf(self, leaf: LeafCreate) -> Leaf:
        logger.debug(f"Creating leaf: {leaf}")
        
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = LeafModel(**leaf.to_dict())
                db_session.add(db_leaf)
                db_session.commit()
                db_session.refresh(db_leaf)
                logger.info(f"Leaf created: {db_leaf.id}")

                if leaf.type == LeafType.PAGE:
                    await self._add_leaf_to_parent(db_leaf, db_session)        

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
                    type=leaf.type,
                    description=leaf.description,
                    content=leaf.content,
                    parent_id=leaf.parent_id if leaf.parent_id else None,
                    children_ids=leaf.children_ids if leaf.children_ids else [],
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
                    return []
                return [Leaf(
                    id=leaf.id,
                    title=leaf.title,
                    type=leaf.type,
                    description=leaf.description,
                    content=leaf.content,
                    parent_id=leaf.parent_id if leaf.parent_id else None,
                    children_ids=leaf.children_ids if leaf.children_ids else [],
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
                
                for key, value in leaf.to_dict().items():
                    if key != "_sa_instance_state":
                        setattr(db_leaf, key, value)

                db_leaf.updated_at = datetime.now()
                db_session.commit()
                db_session.refresh(db_leaf)

                logger.info(f"Leaf updated: {db_leaf.id}")
                return Leaf(
                    id=db_leaf.id,
                    title=db_leaf.title,
                    type=db_leaf.type,
                    description=db_leaf.description,
                    content=db_leaf.content,
                    parent_id=db_leaf.parent_id if db_leaf.parent_id else None,
                    children_ids=db_leaf.children_ids if db_leaf.children_ids else [],
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
                
                db_session.delete(db_leaf)
                db_session.commit()

                if not db_leaf:
                    raise LeafNotFound(leaf_id=leaf_id)
                
                if db_leaf.children_ids:
                    for child_id in db_leaf.children_ids:
                        child_leaf : LeafModel = db_session.query(LeafModel).filter(
                            LeafModel.id == str(child_id)
                        ).first()
                        if child_leaf:
                            await self.delete_leaf(child_leaf.id)
                
                if db_leaf.parent_id:
                    await self._remove_leaf_from_parent(db_leaf, db_session)

                logger.info(f"Leaf deleted: {leaf_id}")
        except Exception as e:
            raise LeafException(status_code=e.status_code, detail=str(e))
        

    async def _add_leaf_to_parent(self, leaf: LeafModel, db_session=None):
        parent_leaf: LeafModel = db_session.query(LeafModel).filter(
            LeafModel.id == str(leaf.parent_id)
        ).first()

        if not parent_leaf:
            raise LeafNotFound(leaf_id=leaf.parent_id)

        if parent_leaf.children_ids is None:
            parent_leaf.children_ids = []

        current_children = list(parent_leaf.children_ids)

        if str(leaf.id) not in current_children:
            current_children.append(str(leaf.id))
            parent_leaf.children_ids = current_children
            db_session.commit()
            db_session.refresh(parent_leaf)
            logger.info(f"Leaf {leaf.id} added to parent: {parent_leaf.id}")


    async def _remove_leaf_from_parent(self, leaf: LeafModel, db_session=None):
        parent_leaf : LeafModel = db_session.query(LeafModel).filter(
            LeafModel.id == str(leaf.parent_id)
        ).first()
        
        if not parent_leaf:
            raise LeafNotFound(leaf_id=leaf.parent_id)
        
        # Convert to list if it's not already
        current_children = list(parent_leaf.children_ids) if parent_leaf.children_ids else []
        
        # Remove the child ID if present
        if str(leaf.id) in current_children:
            current_children.remove(str(leaf.id))
            parent_leaf.children_ids = current_children
            
            db_session.commit()
            db_session.refresh(parent_leaf)

            logger.info(f"Leaf {leaf.id} removed from parent: {parent_leaf.id}")