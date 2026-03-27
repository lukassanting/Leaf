"""
Database operations (`backend/app/database/operations/database_operations.py`).

Purpose:
- Implements persistence and retrieval logic for:
  - databases (table containers) and their metadata
  - database rows and their JSON properties
  - row-linked pages: when a row is created, a backing `LeafModel` page can be created/linked
- Delegates the physical “.md snapshot + meta.json” writing to `FileStorage` (`app.storage`).

How to read:
- Start at the `DatabaseOperations` public methods:
  - `create_database`, `get_database`, `get_all_databases`, `update_database`, `delete_database`
  - `create_row`, `get_row`, `get_rows`, `update_row`, `delete_row`
- Then inspect the DTO mapping helpers:
  - `_database_to_dto`, `_row_to_dto`
- Then inspect the schema composition helpers:
  - `_split_database_schema`, `_compose_database_schema`

Update:
- To change how schema/meta is stored, update `_compose_database_schema` and `_split_database_schema`.
- To change file sync behavior, update `_sync_database_file`, `_sync_row_leaf_file`, and the file deletion paths.

Debug:
- Missing/incorrect metadata: check meta keys stored in `database.schema` under `__leaf_meta__`.
- Row leaf linkage: check where `leaf_id` is assigned/removed in `create_row` and `delete_row`.
"""

import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends
from sqlalchemy import func

from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.database.models.mysql_models import DatabaseModel, DatabaseRowModel, LeafModel
from app.dtos.database_dtos import (
    Database,
    DatabaseCreate,
    DatabaseSchema,
    DatabaseUpdate,
    LeafHeaderBanner,
    Row,
    RowCreate,
    RowUpdate,
)
from app.dtos.leaf_dtos import LeafType
from app.storage import get_file_storage


class DatabaseOperations:
    def __init__(self, db_connector: MySQLDatabaseConnector = Depends(get_db_connector)):
        self.db = db_connector

    def _split_database_schema(self, raw_schema: dict | None) -> tuple[dict, dict]:
        schema_dict = dict(raw_schema or {})
        meta = schema_dict.pop("__leaf_meta__", {}) if isinstance(schema_dict.get("__leaf_meta__"), dict) else {}
        return schema_dict, meta

    def _compose_database_schema(self, schema: dict | None, description, tags, icon) -> dict:
        payload = dict(schema or {})
        payload["__leaf_meta__"] = {
            "description": description,
            "tags": list(tags or []),
            "icon": icon,
        }
        return payload

    def _database_to_dto(self, database: DatabaseModel) -> Database:
        raw_schema, meta = self._split_database_schema(database.schema if database.schema else {})
        try:
            schema = DatabaseSchema.model_validate(raw_schema)
        except Exception:
            schema = DatabaseSchema()
        return Database(
            id=database.id,
            title=database.title,
            schema=schema,
            view_type=database.view_type or "table",
            parent_leaf_id=database.parent_leaf_id,
            description=meta.get("description"),
            tags=list(meta.get("tags") or []),
            icon=meta.get("icon"),
            created_at=database.created_at,
            updated_at=database.updated_at,
        )

    def _database_storage_payload(self, database: DatabaseModel) -> dict:
        return {
            "db_id": database.id,
            "title": database.title,
            "schema": database.schema or {},
            "view_type": database.view_type or "table",
            "parent_leaf_id": database.parent_leaf_id,
            "created_at": database.created_at,
            "updated_at": database.updated_at,
        }

    @staticmethod
    def _leaf_header_banner(leaf_properties) -> LeafHeaderBanner | None:
        if not leaf_properties or not isinstance(leaf_properties, dict):
            return None
        raw = leaf_properties.get("headerBanner")
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = None
        if not isinstance(raw, dict):
            return None
        src = raw.get("src")
        if not isinstance(src, str) or not src.strip():
            return None
        pos = raw.get("objectPosition") or "50% 50%"
        return LeafHeaderBanner(src=src.strip(), objectPosition=str(pos))

    def _row_to_dto(
        self,
        row: DatabaseRowModel,
        leaf_title: str = "Untitled",
        leaf_properties: dict | None = None,
    ) -> Row:
        banner = self._leaf_header_banner(leaf_properties) if leaf_properties is not None else None
        return Row(
            id=row.id,
            database_id=row.database_id,
            leaf_id=row.leaf_id,
            leaf_title=leaf_title,
            properties=row.properties or {},
            leaf_header_banner=banner,
            order=getattr(row, "order", None) or 0,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _row_leaf_storage_payload(self, leaf: LeafModel) -> dict:
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

    def _sync_database_file(self, payload: dict) -> None:
        get_file_storage().write_database(**payload)

    def _sync_row_leaf_file(self, payload: dict) -> None:
        get_file_storage().write_page(**payload)

    def _get_database(
        self,
        session,
        database_id: UUID | str,
        *,
        include_deleted: bool = False,
    ) -> DatabaseModel | None:
        q = session.query(DatabaseModel).filter(DatabaseModel.id == str(database_id))
        if not include_deleted:
            q = q.filter(DatabaseModel.deleted_at.is_(None))
        return q.first()

    def create_database(self, body: DatabaseCreate) -> Database:
        with self.db.get_db_session() as session:
            database = DatabaseModel(
                title=body.title,
                schema=self._compose_database_schema(
                    body.schema.model_dump() if body.schema else None,
                    body.description,
                    body.tags,
                    body.icon,
                ),
                view_type=body.view_type or "table",
                parent_leaf_id=body.parent_leaf_id,
            )
            session.add(database)
            session.commit()
            session.refresh(database)
            payload = self._database_storage_payload(database)
            result = self._database_to_dto(database)
        self._sync_database_file(payload)
        return result

    def get_database(self, database_id: UUID) -> Database | None:
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id)
            return self._database_to_dto(database) if database else None

    def get_all_databases(self) -> list[Database]:
        with self.db.get_db_session() as session:
            rows = (
                session.query(DatabaseModel)
                .filter(DatabaseModel.deleted_at.is_(None))
                .all()
            )
            return [self._database_to_dto(database) for database in rows]

    def update_database(self, database_id: UUID, body: DatabaseUpdate) -> Database | None:
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id)
            if not database:
                return None

            schema_payload, meta = self._split_database_schema(database.schema)
            for field in body.model_fields_set:
                value = getattr(body, field)
                if field == "title" and value is None:
                    continue
                if field == "schema" and value is not None:
                    schema_payload = value.model_dump()
                    continue
                if field == "description":
                    meta["description"] = value
                    continue
                if field == "tags":
                    meta["tags"] = list(value or [])
                    continue
                if field == "icon":
                    meta["icon"] = value
                    continue
                setattr(database, field, value)

            database.schema = self._compose_database_schema(
                schema_payload,
                meta.get("description"),
                meta.get("tags"),
                meta.get("icon"),
            )
            session.commit()
            session.refresh(database)
            payload = self._database_storage_payload(database)
            result = self._database_to_dto(database)
        self._sync_database_file(payload)
        return result

    def remove_schema_property(self, database_id: UUID, property_key: str) -> tuple[Database, list[Row]] | None:
        """Remove one column from schema and drop that key from every row's properties JSON."""
        pk = (property_key or "").strip()
        if not pk:
            return None
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id)
            if not database:
                return None

            schema_payload, meta = self._split_database_schema(database.schema)
            raw_props = schema_payload.get("properties")
            if not isinstance(raw_props, list):
                raw_props = []
            new_props_raw = [
                p for p in raw_props
                if not (isinstance(p, dict) and str(p.get("key", "")) == pk)
            ]
            if len(new_props_raw) == len(raw_props):
                return None

            schema_payload["properties"] = new_props_raw
            database.schema = self._compose_database_schema(
                schema_payload,
                meta.get("description"),
                meta.get("tags"),
                meta.get("icon"),
            )

            db_rows = (
                session.query(DatabaseRowModel)
                .filter(DatabaseRowModel.database_id == str(database_id))
                .all()
            )
            for row in db_rows:
                props = dict(row.properties or {})
                if pk in props:
                    del props[pk]
                    row.properties = props

            session.commit()
            session.refresh(database)

            results = (
                session.query(DatabaseRowModel, LeafModel.title, LeafModel.properties)
                .outerjoin(LeafModel, DatabaseRowModel.leaf_id == LeafModel.id)
                .filter(DatabaseRowModel.database_id == str(database_id))
                .all()
            )
            row_dtos = [
                self._row_to_dto(r, t or "Untitled", lp if isinstance(lp, dict) else None)
                for r, t, lp in results
            ]
            payload = self._database_storage_payload(database)
            db_dto = self._database_to_dto(database)

        self._sync_database_file(payload)
        return db_dto, row_dtos

    def delete_database(self, database_id: UUID) -> bool:
        """Soft-delete: hides from list/get; rows and pages stay for restore."""
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id)
            if not database:
                return False

            database.deleted_at = datetime.now(timezone.utc)
            session.commit()
            session.refresh(database)
            payload = self._database_storage_payload(database)
        self._sync_database_file(payload)
        return True

    def restore_database(self, database_id: UUID) -> Database | None:
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id, include_deleted=True)
            if not database or database.deleted_at is None:
                return None

            database.deleted_at = None
            session.commit()
            session.refresh(database)
            payload = self._database_storage_payload(database)
            result = self._database_to_dto(database)
        self._sync_database_file(payload)
        return result

    def create_row(self, database_id: UUID, body: RowCreate) -> Row | None:
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id)
            if not database:
                return None

            leaf = LeafModel(
                title="Untitled",
                type=LeafType.PAGE,
                database_id=str(database_id),
            )
            session.add(leaf)
            session.flush()

            max_o = (
                session.query(func.max(DatabaseRowModel.order))
                .filter(DatabaseRowModel.database_id == str(database_id))
                .scalar()
            )
            next_order = (max_o + 1) if max_o is not None else 0

            row = DatabaseRowModel(
                database_id=str(database_id),
                properties=body.properties or {},
                leaf_id=leaf.id,
                order=next_order,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            session.refresh(leaf)
            row_payload = self._row_leaf_storage_payload(leaf)
            lp = leaf.properties if isinstance(leaf.properties, dict) else None
            result = self._row_to_dto(row, leaf.title, lp)

        self._sync_row_leaf_file(row_payload)
        return result

    def get_row(self, database_id: UUID, row_id: UUID) -> Row | None:
        with self.db.get_db_session() as session:
            if not self._get_database(session, database_id):
                return None
            result = (
                session.query(DatabaseRowModel, LeafModel.title, LeafModel.properties)
                .outerjoin(LeafModel, DatabaseRowModel.leaf_id == LeafModel.id)
                .filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.id == str(row_id),
                )
                .first()
            )
            if not result:
                return None
            row, leaf_title, leaf_props = result
            return self._row_to_dto(row, leaf_title or "Untitled", leaf_props if isinstance(leaf_props, dict) else None)

    def get_rows(self, database_id: UUID) -> list[Row] | None:
        with self.db.get_db_session() as session:
            if not self._get_database(session, database_id):
                return None
            results = (
                session.query(DatabaseRowModel, LeafModel.title, LeafModel.properties)
                .outerjoin(LeafModel, DatabaseRowModel.leaf_id == LeafModel.id)
                .filter(DatabaseRowModel.database_id == str(database_id))
                .order_by(DatabaseRowModel.order.asc(), DatabaseRowModel.created_at.asc())
                .all()
            )
            return [
                self._row_to_dto(row, leaf_title or "Untitled", leaf_props if isinstance(leaf_props, dict) else None)
                for row, leaf_title, leaf_props in results
            ]

    def update_row(self, database_id: UUID, row_id: UUID, body: RowUpdate) -> Row | None:
        with self.db.get_db_session() as session:
            if not self._get_database(session, database_id):
                return None
            row = (
                session.query(DatabaseRowModel)
                .filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.id == str(row_id),
                )
                .first()
            )
            if not row:
                return None
            if body.properties is not None:
                row.properties = body.properties
            leaf_title = "Untitled"
            leaf_props: dict | None = None
            if row.leaf_id:
                leaf = session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first()
                if leaf:
                    leaf_title = leaf.title
                    leaf_props = leaf.properties if isinstance(leaf.properties, dict) else None
            session.commit()
            session.refresh(row)
            return self._row_to_dto(row, leaf_title, leaf_props)

    def delete_row(self, database_id: UUID, row_id: UUID) -> bool:
        with self.db.get_db_session() as session:
            if not self._get_database(session, database_id):
                return False
            row = (
                session.query(DatabaseRowModel)
                .filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.id == str(row_id),
                )
                .first()
            )
            if not row:
                return False
            if row.leaf_id:
                leaf = session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first()
                if leaf:
                    session.delete(leaf)
            leaf_id_to_delete = row.leaf_id
            session.delete(row)
            session.commit()

        if leaf_id_to_delete:
            get_file_storage().delete_page(leaf_id_to_delete, database_id=str(database_id))
        return True

    def reorder_rows(self, database_id: UUID, row_ids: list[str]) -> list[Row] | None:
        with self.db.get_db_session() as session:
            if not self._get_database(session, database_id):
                return None
            rows = (
                session.query(DatabaseRowModel)
                .filter(DatabaseRowModel.database_id == str(database_id))
                .all()
            )
            by_id = {r.id: r for r in rows}
            if not row_ids or set(row_ids) != set(by_id.keys()):
                return None
            for i, rid in enumerate(row_ids):
                by_id[rid].order = i
            session.commit()
        return self.get_rows(database_id)
