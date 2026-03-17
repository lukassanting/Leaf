from uuid import UUID
from fastapi import Depends

from app.database.models.mysql_models import DatabaseModel, DatabaseRowModel, LeafModel
from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.dtos.database_dtos import Database, DatabaseCreate, DatabaseSchema, Row, RowCreate, RowUpdate
from app.dtos.leaf_dtos import LeafType
from app.storage import get_file_storage


class DatabaseOperations:
    def __init__(self, db_connector: MySQLDatabaseConnector = Depends(get_db_connector)):
        self.db = db_connector

    def _db_to_dto(self, m: DatabaseModel) -> Database:
        raw_schema = m.schema if m.schema else {}
        try:
            schema = DatabaseSchema.model_validate(raw_schema)
        except Exception:
            schema = DatabaseSchema()
        return Database(
            id=m.id,
            title=m.title,
            schema=schema,
            view_type=m.view_type or "table",
            parent_leaf_id=m.parent_leaf_id,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    def _row_to_dto(self, m: DatabaseRowModel, leaf_title: str = "Untitled") -> Row:
        return Row(
            id=m.id,
            database_id=m.database_id,
            leaf_id=m.leaf_id,
            leaf_title=leaf_title,
            properties=m.properties or {},
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    def create_database(self, body: DatabaseCreate) -> Database:
        with self.db.get_db_session() as s:
            schema_dict = body.schema.model_dump() if body.schema else None
            m = DatabaseModel(
                title=body.title,
                schema=schema_dict,
                view_type=body.view_type or "table",
                parent_leaf_id=body.parent_leaf_id,
            )
            s.add(m)
            s.commit()
            s.refresh(m)
            dto = self._db_to_dto(m)
            get_file_storage().write_database(
                db_id=m.id, title=m.title, schema=m.schema or {},
                view_type=m.view_type or "table", parent_leaf_id=m.parent_leaf_id,
                created_at=m.created_at, updated_at=m.updated_at,
            )
            return dto

    def get_database(self, database_id: UUID) -> Database | None:
        with self.db.get_db_session() as s:
            m = s.query(DatabaseModel).filter(DatabaseModel.id == str(database_id)).first()
            return self._db_to_dto(m) if m else None

    def get_all_databases(self) -> list[Database]:
        with self.db.get_db_session() as s:
            rows = s.query(DatabaseModel).all()
            return [self._db_to_dto(m) for m in rows]

    def update_database(self, database_id: UUID, body: DatabaseCreate) -> Database | None:
        with self.db.get_db_session() as s:
            m = s.query(DatabaseModel).filter(DatabaseModel.id == str(database_id)).first()
            if not m:
                return None
            m.title = body.title
            if body.schema is not None:
                m.schema = body.schema.model_dump()
            if body.view_type is not None:
                m.view_type = body.view_type
            s.commit()
            s.refresh(m)
            dto = self._db_to_dto(m)
            get_file_storage().write_database(
                db_id=m.id, title=m.title, schema=m.schema or {},
                view_type=m.view_type or "table", parent_leaf_id=m.parent_leaf_id,
                created_at=m.created_at, updated_at=m.updated_at,
            )
            return dto

    def delete_database(self, database_id: UUID) -> bool:
        with self.db.get_db_session() as s:
            m = s.query(DatabaseModel).filter(DatabaseModel.id == str(database_id)).first()
            if not m:
                return False
            s.delete(m)
            s.commit()
            get_file_storage().delete_database(str(database_id))
            return True

    def create_row(self, database_id: UUID, body: RowCreate) -> Row | None:
        with self.db.get_db_session() as s:
            db = s.query(DatabaseModel).filter(DatabaseModel.id == str(database_id)).first()
            if not db:
                return None
            # Auto-create a leaf for this row (so it can be opened as a full page)
            leaf = LeafModel(
                title="Untitled",
                type=LeafType.PAGE,
                database_id=str(database_id),
            )
            s.add(leaf)
            s.flush()  # get leaf.id without committing

            m = DatabaseRowModel(
                database_id=str(database_id),
                properties=body.properties or {},
                leaf_id=leaf.id,
            )
            s.add(m)
            s.commit()
            s.refresh(m)
            s.refresh(leaf)
            get_file_storage().write_page(
                leaf_id=leaf.id, title=leaf.title, content_html=leaf.content,
                parent_id=leaf.parent_id, children_ids=leaf.children_ids or [],
                tags=leaf.tags or [], order=leaf.order or 0,
                database_id=str(database_id),
                created_at=leaf.created_at, updated_at=leaf.updated_at,
            )
            return self._row_to_dto(m, leaf.title)

    def get_row(self, database_id: UUID, row_id: UUID) -> Row | None:
        with self.db.get_db_session() as s:
            result = (
                s.query(DatabaseRowModel, LeafModel.title)
                .outerjoin(LeafModel, DatabaseRowModel.leaf_id == LeafModel.id)
                .filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.id == str(row_id),
                )
                .first()
            )
            if not result:
                return None
            m, leaf_title = result
            return self._row_to_dto(m, leaf_title or "Untitled")

    def get_rows(self, database_id: UUID) -> list[Row]:
        with self.db.get_db_session() as s:
            results = (
                s.query(DatabaseRowModel, LeafModel.title)
                .outerjoin(LeafModel, DatabaseRowModel.leaf_id == LeafModel.id)
                .filter(DatabaseRowModel.database_id == str(database_id))
                .all()
            )
            return [self._row_to_dto(m, leaf_title or "Untitled") for m, leaf_title in results]

    def update_row(self, database_id: UUID, row_id: UUID, body: RowUpdate) -> Row | None:
        with self.db.get_db_session() as s:
            m = (
                s.query(DatabaseRowModel)
                .filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.id == str(row_id),
                )
                .first()
            )
            if not m:
                return None
            if body.properties is not None:
                m.properties = body.properties
            leaf_title = "Untitled"
            if m.leaf_id:
                leaf = s.query(LeafModel).filter(LeafModel.id == m.leaf_id).first()
                if leaf:
                    leaf_title = leaf.title
            s.commit()
            s.refresh(m)
            return self._row_to_dto(m, leaf_title)

    def delete_row(self, database_id: UUID, row_id: UUID) -> bool:
        with self.db.get_db_session() as s:
            m = (
                s.query(DatabaseRowModel)
                .filter(
                    DatabaseRowModel.database_id == str(database_id),
                    DatabaseRowModel.id == str(row_id),
                )
                .first()
            )
            if not m:
                return False
            # Delete linked leaf (database entry page)
            if m.leaf_id:
                leaf = s.query(LeafModel).filter(LeafModel.id == m.leaf_id).first()
                if leaf:
                    s.delete(leaf)
            leaf_id_to_delete = m.leaf_id
            s.delete(m)
            s.commit()
            if leaf_id_to_delete:
                get_file_storage().delete_page(leaf_id_to_delete, database_id=str(database_id))
            return True
