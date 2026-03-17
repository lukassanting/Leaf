from datetime import datetime
from uuid import UUID
from fastapi import Depends
from loguru import logger

# Local imports
from app.database.models.mysql_models import LeafModel, DatabaseModel, DatabaseRowModel
from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.exceptions.exceptions import FailedToCreateLeaf, LeafException, LeafNotFound
from app.dtos.leaf_dtos import Leaf, LeafCreate, LeafContentUpdate, LeafTreeItem, LeafType
from app.storage import get_file_storage

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

                get_file_storage().write_page(
                    leaf_id=db_leaf.id, title=db_leaf.title,
                    content_html=db_leaf.content, parent_id=db_leaf.parent_id,
                    children_ids=db_leaf.children_ids or [], tags=db_leaf.tags or [],
                    order=db_leaf.order or 0, database_id=db_leaf.database_id,
                    created_at=db_leaf.created_at, updated_at=db_leaf.updated_at,
                )

                return Leaf(
                    id=db_leaf.id,
                    title=db_leaf.title,
                    type=db_leaf.type,
                    description=db_leaf.description,
                    content=db_leaf.content,
                    parent_id=db_leaf.parent_id if db_leaf.parent_id else None,
                    children_ids=db_leaf.children_ids if db_leaf.children_ids else [],
                    tags=db_leaf.tags or [],
                    created_at=db_leaf.created_at,
                    updated_at=db_leaf.updated_at,
                )
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
                    tags=leaf.tags or [],
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
                    tags=leaf.tags or [],
                    created_at=leaf.created_at,
                    updated_at=leaf.updated_at
                ) for leaf in leaves]
        except Exception as e:
            raise LeafException(status_code=e.status_code, detail=str(e))

    async def get_leaf_tree(
        self,
        type_filter: LeafType | None = None,
        parent_id: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[LeafTreeItem]:
        """
        Returns leaves as lightweight tree items (no content).
        Optional filters: type (project/page), parent_id. Pagination via limit/offset.
        """
        try:
            with self.db.get_db_session() as db_session:
                q = db_session.query(LeafModel).with_entities(
                    LeafModel.id,
                    LeafModel.title,
                    LeafModel.type,
                    LeafModel.parent_id,
                    LeafModel.children_ids,
                    LeafModel.order,
                    LeafModel.tags,
                )
                if type_filter is not None:
                    q = q.filter(LeafModel.type == type_filter)
                if parent_id is not None:
                    q = q.filter(LeafModel.parent_id == parent_id)
                q = q.filter(LeafModel.database_id.is_(None))
                q = q.order_by(LeafModel.order.asc(), LeafModel.updated_at.desc())
                if offset is not None:
                    q = q.offset(offset)
                if limit is not None:
                    q = q.limit(limit)
                rows = q.all()
                return [
                    LeafTreeItem(
                        id=r[0],
                        title=r[1],
                        type=r[2],
                        parent_id=r[3],
                        children_ids=r[4] or [],
                        order=r[5] if r[5] is not None else 0,
                        tags=r[6] or [],
                    )
                    for r in rows
                ]
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))

    async def patch_leaf_content(self, leaf_id: UUID, body: LeafContentUpdate) -> Leaf:
        """Update only content (and updated_at). Optional conflict check via body.updated_at."""
        try:
            with self.db.get_db_session() as db_session:
                db_leaf: LeafModel = db_session.query(LeafModel).filter(
                    LeafModel.id == str(leaf_id)
                ).first()
                if not db_leaf:
                    raise LeafNotFound(leaf_id=leaf_id)
                if body.updated_at is not None and db_leaf.updated_at and db_leaf.updated_at > body.updated_at:
                    raise LeafException(status_code=409, detail="Conflict: leaf was updated elsewhere")
                db_leaf.content = body.content
                db_leaf.updated_at = datetime.now()
                db_session.commit()
                db_session.refresh(db_leaf)
                logger.info("Leaf content patched: %s", db_leaf.id)
                get_file_storage().write_page(
                    leaf_id=db_leaf.id, title=db_leaf.title,
                    content_html=db_leaf.content, parent_id=db_leaf.parent_id,
                    children_ids=db_leaf.children_ids or [], tags=db_leaf.tags or [],
                    order=db_leaf.order or 0, database_id=db_leaf.database_id,
                    created_at=db_leaf.created_at, updated_at=db_leaf.updated_at,
                )
                return Leaf(
                    id=db_leaf.id,
                    title=db_leaf.title,
                    type=db_leaf.type,
                    description=db_leaf.description,
                    content=db_leaf.content,
                    parent_id=db_leaf.parent_id if db_leaf.parent_id else None,
                    children_ids=db_leaf.children_ids or [],
                    tags=db_leaf.tags or [],
                    created_at=db_leaf.created_at,
                    updated_at=db_leaf.updated_at,
                )
        except LeafNotFound:
            raise
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))

    async def reorder_children(self, parent_id: UUID, child_ids: list[str]) -> Leaf:
        """Set the order of children for a parent. Updates parent's children_ids and each child's order."""
        try:
            with self.db.get_db_session() as db_session:
                parent: LeafModel = db_session.query(LeafModel).filter(
                    LeafModel.id == str(parent_id)
                ).first()
                if not parent:
                    raise LeafNotFound(leaf_id=parent_id)
                parent.children_ids = list(child_ids)
                for i, cid in enumerate(child_ids):
                    child = db_session.query(LeafModel).filter(LeafModel.id == cid).first()
                    if child:
                        child.order = i
                db_session.commit()
                db_session.refresh(parent)
                return Leaf(
                    id=parent.id,
                    title=parent.title,
                    type=parent.type,
                    description=parent.description,
                    content=parent.content,
                    parent_id=parent.parent_id if parent.parent_id else None,
                    children_ids=parent.children_ids or [],
                    tags=parent.tags or [],
                    created_at=parent.created_at,
                    updated_at=parent.updated_at,
                )
        except LeafNotFound:
            raise
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))

    async def update_leaf(self, leaf_id: UUID, leaf: LeafCreate) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                
                db_leaf : LeafModel = db_session.query(LeafModel).filter(
                    LeafModel.id == str(leaf_id)
                ).first()

                if not db_leaf:
                    raise LeafNotFound(leaf_id=leaf_id)
                
                # Never overwrite content/description with None — those have dedicated endpoints.
                skip_if_none = {'content', 'description'}
                for key, value in leaf.to_dict().items():
                    if key == "_sa_instance_state":
                        continue
                    if key in skip_if_none and value is None:
                        continue
                    setattr(db_leaf, key, value)

                db_leaf.updated_at = datetime.now()
                db_session.commit()
                db_session.refresh(db_leaf)

                logger.info(f"Leaf updated: {db_leaf.id}")
                get_file_storage().write_page(
                    leaf_id=db_leaf.id, title=db_leaf.title,
                    content_html=db_leaf.content, parent_id=db_leaf.parent_id,
                    children_ids=db_leaf.children_ids or [], tags=db_leaf.tags or [],
                    order=db_leaf.order or 0, database_id=db_leaf.database_id,
                    created_at=db_leaf.created_at, updated_at=db_leaf.updated_at,
                )
                return Leaf(
                    id=db_leaf.id,
                    title=db_leaf.title,
                    type=db_leaf.type,
                    description=db_leaf.description,
                    content=db_leaf.content,
                    parent_id=db_leaf.parent_id if db_leaf.parent_id else None,
                    children_ids=db_leaf.children_ids if db_leaf.children_ids else [],
                    tags=db_leaf.tags or [],
                    created_at=db_leaf.created_at,
                    updated_at=db_leaf.updated_at
                )
        except Exception as e:
            raise LeafException(status_code=e.status_code, detail=str(e))

    async def delete_leaf(self, leaf_id: UUID):
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = db_session.query(LeafModel).filter(
                    LeafModel.id == str(leaf_id)
                ).first()

                if not db_leaf:
                    raise LeafNotFound(leaf_id=leaf_id)

                # Capture before deletion
                children_ids = list(db_leaf.children_ids or [])
                parent_id = db_leaf.parent_id

                # Delete child databases and their rows
                child_dbs = db_session.query(DatabaseModel).filter(
                    DatabaseModel.parent_leaf_id == str(leaf_id)
                ).all()
                for child_db in child_dbs:
                    rows = db_session.query(DatabaseRowModel).filter(
                        DatabaseRowModel.database_id == child_db.id
                    ).all()
                    for row in rows:
                        if row.leaf_id:
                            row_leaf = db_session.query(LeafModel).filter(
                                LeafModel.id == row.leaf_id
                            ).first()
                            if row_leaf:
                                db_session.delete(row_leaf)
                    db_session.delete(child_db)

                # Remove from parent's children_ids
                if parent_id:
                    parent = db_session.query(LeafModel).filter(
                        LeafModel.id == parent_id
                    ).first()
                    if parent and parent.children_ids:
                        parent.children_ids = [
                            cid for cid in parent.children_ids if cid != str(leaf_id)
                        ]

                db_session.delete(db_leaf)
                db_session.commit()
                get_file_storage().delete_page(str(leaf_id), database_id=None)
                logger.info(f"Leaf deleted: {leaf_id}")

            # Recursively delete children (outside session to avoid conflicts)
            for child_id in children_ids:
                try:
                    await self.delete_leaf(child_id)
                except Exception:
                    pass

        except LeafNotFound:
            raise
        except Exception as e:
            raise LeafException(status_code=500, detail=str(e))
        

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