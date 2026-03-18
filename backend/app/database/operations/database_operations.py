from uuid import UUID

from fastapi import Depends

from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.database.models.mysql_models import DatabaseModel, DatabaseRowModel, LeafModel
from app.dtos.database_dtos import (
    Database,
    DatabaseCreate,
    DatabaseSchema,
    DatabaseUpdate,
    Row,
    RowCreate,
    RowUpdate,
)
from app.dtos.leaf_dtos import LeafType
from app.storage import get_file_storage


class DatabaseOperations:
    def __init__(self, db_connector: MySQLDatabaseConnector = Depends(get_db_connector)):
        self.db = db_connector

    def _database_to_dto(self, database: DatabaseModel) -> Database:
        raw_schema = database.schema if database.schema else {}
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

    def _row_to_dto(self, row: DatabaseRowModel, leaf_title: str = "Untitled") -> Row:
        return Row(
            id=row.id,
            database_id=row.database_id,
            leaf_id=row.leaf_id,
            leaf_title=leaf_title,
            properties=row.properties or {},
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

    def _get_database(self, session, database_id: UUID | str) -> DatabaseModel | None:
        return session.query(DatabaseModel).filter(DatabaseModel.id == str(database_id)).first()

    def create_database(self, body: DatabaseCreate) -> Database:
        with self.db.get_db_session() as session:
            database = DatabaseModel(
                title=body.title,
                schema=body.schema.model_dump() if body.schema else None,
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
            rows = session.query(DatabaseModel).all()
            return [self._database_to_dto(database) for database in rows]

    def update_database(self, database_id: UUID, body: DatabaseUpdate) -> Database | None:
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id)
            if not database:
                return None

            for field in body.model_fields_set:
                value = getattr(body, field)
                if field == "title" and value is None:
                    continue
                if field == "schema" and value is not None:
                    database.schema = value.model_dump()
                    continue
                setattr(database, field, value)

            session.commit()
            session.refresh(database)
            payload = self._database_storage_payload(database)
            result = self._database_to_dto(database)
        self._sync_database_file(payload)
        return result

    def delete_database(self, database_id: UUID) -> bool:
        with self.db.get_db_session() as session:
            database = self._get_database(session, database_id)
            if not database:
                return False

            row_leaf_ids = [
                row_leaf_id for (row_leaf_id,) in session.query(DatabaseRowModel.leaf_id).filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.leaf_id.isnot(None),
                ).all()
            ]
            if row_leaf_ids:
                session.query(LeafModel).filter(LeafModel.id.in_(row_leaf_ids)).delete(synchronize_session=False)

            session.delete(database)
            session.commit()

        get_file_storage().delete_database(str(database_id))
        return True

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

            row = DatabaseRowModel(
                database_id=str(database_id),
                properties=body.properties or {},
                leaf_id=leaf.id,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            session.refresh(leaf)
            row_payload = self._row_leaf_storage_payload(leaf)
            result = self._row_to_dto(row, leaf.title)

        self._sync_row_leaf_file(row_payload)
        return result

    def get_row(self, database_id: UUID, row_id: UUID) -> Row | None:
        with self.db.get_db_session() as session:
            result = (
                session.query(DatabaseRowModel, LeafModel.title)
                .outerjoin(LeafModel, DatabaseRowModel.leaf_id == LeafModel.id)
                .filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.id == str(row_id),
                )
                .first()
            )
            if not result:
                return None
            row, leaf_title = result
            return self._row_to_dto(row, leaf_title or "Untitled")

    def get_rows(self, database_id: UUID) -> list[Row]:
        with self.db.get_db_session() as session:
            results = (
                session.query(DatabaseRowModel, LeafModel.title)
                .outerjoin(LeafModel, DatabaseRowModel.leaf_id == LeafModel.id)
                .filter(DatabaseRowModel.database_id == str(database_id))
                .all()
            )
            return [self._row_to_dto(row, leaf_title or "Untitled") for row, leaf_title in results]

    def update_row(self, database_id: UUID, row_id: UUID, body: RowUpdate) -> Row | None:
        with self.db.get_db_session() as session:
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
            if row.leaf_id:
                leaf = session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first()
                if leaf:
                    leaf_title = leaf.title
            session.commit()
            session.refresh(row)
            return self._row_to_dto(row, leaf_title)

    def delete_row(self, database_id: UUID, row_id: UUID) -> bool:
        with self.db.get_db_session() as session:
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
