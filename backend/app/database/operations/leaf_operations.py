import asyncio
from datetime import datetime
from uuid import UUID

from fastapi import Depends
from loguru import logger

from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.database.models.mysql_models import DatabaseModel, DatabaseRowModel, LeafModel
from app.dtos.leaf_dtos import (
    Leaf,
    LeafContentUpdate,
    LeafCreate,
    LeafTreeItem,
    LeafType,
    LeafUpdate,
    infer_leaf_type,
)
from app.exceptions.exceptions import FailedToCreateLeaf, LeafException, LeafNotFound
from app.storage import get_file_storage


class LeafOperations:
    def __init__(self, db_connector: MySQLDatabaseConnector = Depends(get_db_connector)):
        self.db: MySQLDatabaseConnector = db_connector

    def _leaf_to_dto(self, leaf: LeafModel) -> Leaf:
        return Leaf(
            id=leaf.id,
            title=leaf.title,
            type=leaf.type,
            description=leaf.description,
            content=leaf.content,
            parent_id=leaf.parent_id if leaf.parent_id else None,
            database_id=leaf.database_id if leaf.database_id else None,
            children_ids=list(leaf.children_ids or []),
            tags=list(leaf.tags or []),
            created_at=leaf.created_at,
            updated_at=leaf.updated_at,
        )

    def _leaf_tree_item(self, row) -> LeafTreeItem:
        return LeafTreeItem(
            id=row[0],
            title=row[1],
            type=row[2],
            parent_id=row[3],
            children_ids=list(row[4] or []),
            order=row[5] if row[5] is not None else 0,
            tags=list(row[6] or []),
        )

    def _leaf_storage_payload(self, leaf: LeafModel) -> dict:
        return {
            "leaf_id": leaf.id,
            "title": leaf.title,
            "content_html": leaf.content,
            "parent_id": leaf.parent_id,
            "children_ids": list(leaf.children_ids or []),
            "tags": list(leaf.tags or []),
            "order": leaf.order or 0,
            "database_id": leaf.database_id,
            "created_at": leaf.created_at,
            "updated_at": leaf.updated_at,
        }

    def _schedule_leaf_sync(self, payload: dict) -> None:
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, lambda: get_file_storage().write_page(**payload))

    def _delete_leaf_file(self, leaf_id: str, database_id: str | None) -> None:
        get_file_storage().delete_page(leaf_id, database_id=database_id)

    def _get_leaf_or_404(self, db_session, leaf_id: UUID | str) -> LeafModel:
        lookup_id = str(leaf_id)
        leaf = db_session.query(LeafModel).filter(LeafModel.id == lookup_id).first()
        if not leaf:
            raise LeafNotFound(leaf_id=lookup_id)
        return leaf

    def _append_child_id(self, parent: LeafModel, child_id: str) -> None:
        current_children = list(parent.children_ids or [])
        if child_id not in current_children:
            current_children.append(child_id)
            parent.children_ids = current_children

    def _remove_child_id(self, parent: LeafModel, child_id: str) -> None:
        current_children = list(parent.children_ids or [])
        if child_id in current_children:
            parent.children_ids = [cid for cid in current_children if cid != child_id]

    def _apply_leaf_update(self, db_session, db_leaf: LeafModel, body: LeafUpdate) -> None:
        fields_set = body.model_fields_set
        if not fields_set:
            return

        previous_parent_id = db_leaf.parent_id
        for field in fields_set:
            value = getattr(body, field)
            if field == "title" and value is None:
                continue
            if field in {"children_ids", "tags"} and value is not None:
                setattr(db_leaf, field, list(value))
                continue
            setattr(db_leaf, field, value)

        if "parent_id" in fields_set and previous_parent_id != db_leaf.parent_id:
            if previous_parent_id:
                previous_parent = self._get_leaf_or_404(db_session, previous_parent_id)
                self._remove_child_id(previous_parent, db_leaf.id)
            if db_leaf.parent_id:
                next_parent = self._get_leaf_or_404(db_session, db_leaf.parent_id)
                self._append_child_id(next_parent, db_leaf.id)

        if "parent_id" in fields_set or "database_id" in fields_set:
            db_leaf.type = infer_leaf_type(db_leaf.parent_id, db_leaf.database_id)

    async def create_leaf(self, leaf: LeafCreate) -> Leaf:
        logger.debug(f"Creating leaf: {leaf}")
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = LeafModel(
                    title=leaf.title,
                    description=leaf.description,
                    content=leaf.content,
                    parent_id=leaf.parent_id,
                    database_id=leaf.database_id,
                    children_ids=list(leaf.children_ids),
                    tags=list(leaf.tags),
                    type=infer_leaf_type(leaf.parent_id, leaf.database_id),
                )
                db_session.add(db_leaf)
                db_session.flush()

                if db_leaf.parent_id:
                    parent_leaf = self._get_leaf_or_404(db_session, db_leaf.parent_id)
                    self._append_child_id(parent_leaf, db_leaf.id)

                db_session.commit()
                db_session.refresh(db_leaf)
                payload = self._leaf_storage_payload(db_leaf)
                result = self._leaf_to_dto(db_leaf)

            self._schedule_leaf_sync(payload)
            logger.info(f"Leaf created: {result.id}")
            return result
        except LeafException:
            raise
        except Exception as e:
            logger.exception("create_leaf failed")
            raise FailedToCreateLeaf(leaf=leaf, detail=str(e))

    async def get_leaf(self, leaf_id: UUID) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                leaf = self._get_leaf_or_404(db_session, leaf_id)
                return self._leaf_to_dto(leaf)
        except LeafException:
            raise
        except Exception as e:
            logger.exception(f"get_leaf failed for {leaf_id}")
            raise LeafException(status_code=getattr(e, "status_code", 500), detail=str(e))

    async def get_all_leaves(self) -> list[Leaf]:
        try:
            with self.db.get_db_session() as db_session:
                leaves = db_session.query(LeafModel).all()
                return [self._leaf_to_dto(leaf) for leaf in leaves]
        except Exception as e:
            logger.exception("get_all_leaves failed")
            raise LeafException(status_code=getattr(e, "status_code", 500), detail=str(e))

    async def get_leaf_tree(
        self,
        type_filter: LeafType | None = None,
        parent_id: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[LeafTreeItem]:
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
                return [self._leaf_tree_item(row) for row in q.all()]
        except Exception as e:
            logger.exception("get_leaf_tree failed")
            raise LeafException(status_code=500, detail=str(e))

    async def patch_leaf_content(self, leaf_id: UUID, body: LeafContentUpdate) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = self._get_leaf_or_404(db_session, leaf_id)
                if body.updated_at is not None and db_leaf.updated_at and db_leaf.updated_at > body.updated_at:
                    raise LeafException(status_code=409, detail="Conflict: leaf was updated elsewhere")
                db_leaf.content = body.content
                db_leaf.updated_at = datetime.now()
                db_session.commit()
                db_session.refresh(db_leaf)
                payload = self._leaf_storage_payload(db_leaf)
                result = self._leaf_to_dto(db_leaf)
            self._schedule_leaf_sync(payload)
            logger.info("Leaf content patched: %s", result.id)
            return result
        except (LeafNotFound, LeafException):
            raise
        except Exception as e:
            logger.exception(f"patch_leaf_content failed for {leaf_id}")
            raise LeafException(status_code=500, detail=str(e))

    async def reorder_children(self, parent_id: UUID, child_ids: list[str]) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                parent = self._get_leaf_or_404(db_session, parent_id)
                parent.children_ids = list(child_ids)
                for i, cid in enumerate(child_ids):
                    child = db_session.query(LeafModel).filter(LeafModel.id == cid).first()
                    if child:
                        child.order = i
                db_session.commit()
                db_session.refresh(parent)
                return self._leaf_to_dto(parent)
        except LeafNotFound:
            raise
        except Exception as e:
            logger.exception(f"reorder_children failed for {parent_id}")
            raise LeafException(status_code=500, detail=str(e))

    async def update_leaf(self, leaf_id: UUID, leaf: LeafUpdate) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = self._get_leaf_or_404(db_session, leaf_id)
                self._apply_leaf_update(db_session, db_leaf, leaf)
                db_leaf.updated_at = datetime.now()
                db_session.commit()
                db_session.refresh(db_leaf)
                payload = self._leaf_storage_payload(db_leaf)
                result = self._leaf_to_dto(db_leaf)
            self._schedule_leaf_sync(payload)
            logger.info(f"Leaf updated: {result.id}")
            return result
        except (LeafNotFound, LeafException):
            raise
        except Exception as e:
            logger.exception(f"update_leaf failed for {leaf_id}")
            raise LeafException(status_code=getattr(e, "status_code", 500), detail=str(e))

    async def delete_leaf(self, leaf_id: UUID):
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = self._get_leaf_or_404(db_session, leaf_id)
                child_leaf_ids = list(db_leaf.children_ids or [])
                leaf_file_database_id = db_leaf.database_id

                child_databases = db_session.query(DatabaseModel).filter(
                    DatabaseModel.parent_leaf_id == str(leaf_id)
                ).all()
                deleted_database_ids: list[str] = []
                for child_db in child_databases:
                    row_leaves = db_session.query(LeafModel).filter(
                        LeafModel.database_id == child_db.id
                    ).all()
                    for row_leaf in row_leaves:
                        db_session.delete(row_leaf)
                    deleted_database_ids.append(child_db.id)
                    db_session.delete(child_db)

                if db_leaf.parent_id:
                    parent = self._get_leaf_or_404(db_session, db_leaf.parent_id)
                    self._remove_child_id(parent, db_leaf.id)

                db_session.delete(db_leaf)
                db_session.commit()

            self._delete_leaf_file(str(leaf_id), leaf_file_database_id)
            for database_id in deleted_database_ids:
                get_file_storage().delete_database(database_id)

            logger.info(f"Leaf deleted: {leaf_id}")

            for child_id in child_leaf_ids:
                try:
                    await self.delete_leaf(child_id)
                except Exception:
                    logger.exception("delete_leaf failed for child %s", child_id)
        except LeafNotFound:
            raise
        except Exception as e:
            logger.exception(f"delete_leaf failed for {leaf_id}")
            raise LeafException(status_code=500, detail=str(e))