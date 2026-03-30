"""
Permanent deletion for Trash (`trash_operations.py`).

Soft-deleted leaves/databases older than the retention window are purged here:
- databases: rows, linked row pages, DB files
- leaves: child DBs, row pages, leaf `.md` files

Called from startup and `GET /trash` before listing.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends
from loguru import logger

from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.database.models.mysql_models import DatabaseModel, DatabaseRowModel, LeafModel
from app.dtos.trash_dtos import TrashListResponse, TrashDatabaseItem, TrashLeafItem, TrashPurgeStats
from app.storage import get_file_storage


def _remove_child_id(parent: LeafModel, child_id: str) -> None:
    current = list(parent.children_ids or [])
    if child_id in current:
        parent.children_ids = [c for c in current if c != child_id]


class TrashOperations:
    def __init__(self, db_connector: MySQLDatabaseConnector = Depends(get_db_connector)):
        self.db = db_connector

    def hard_delete_database(self, database_id: str) -> bool:
        """Remove database, all rows, linked row pages, and DB files."""
        did = str(database_id)
        row_leaf_ids: list[str] = []
        with self.db.get_db_session() as session:
            db = session.query(DatabaseModel).filter(DatabaseModel.id == did).first()
            if not db:
                return False
            rows = session.query(DatabaseRowModel).filter(DatabaseRowModel.database_id == did).all()
            for row in rows:
                if row.leaf_id:
                    row_leaf_ids.append(row.leaf_id)
                    lf = session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first()
                    if lf:
                        session.delete(lf)
                session.delete(row)
            session.delete(db)
            session.commit()

        storage = get_file_storage()
        for lid in row_leaf_ids:
            storage.delete_page(lid, database_id=did)
        storage.delete_database(did)
        return True

    def hard_delete_leaf(self, leaf_id: str) -> bool:
        """Remove one leaf row, nested DBs, parent list link, and `.md` file."""
        child_db_ids: list[str] = []
        leaf_db_id: str | None = None
        with self.db.get_db_session() as session:
            leaf = session.query(LeafModel).filter(LeafModel.id == leaf_id).first()
            if not leaf:
                return False
            leaf_db_id = leaf.database_id
            for cdb in session.query(DatabaseModel).filter(DatabaseModel.parent_leaf_id == leaf_id).all():
                child_db_ids.append(cdb.id)
        for cid in child_db_ids:
            self.hard_delete_database(cid)

        with self.db.get_db_session() as session:
            leaf = session.query(LeafModel).filter(LeafModel.id == leaf_id).first()
            if not leaf:
                return False
            leaf_db_id = leaf.database_id
            if leaf.parent_id:
                parent = session.query(LeafModel).filter(LeafModel.id == leaf.parent_id).first()
                if parent:
                    _remove_child_id(parent, leaf.id)
            session.delete(leaf)
            session.commit()

        get_file_storage().delete_page(leaf_id, database_id=leaf_db_id)
        return True

    def permanently_delete_trashed_leaf(self, leaf_id: str) -> bool:
        """Hard-delete one leaf only if it is currently soft-deleted (in Trash)."""
        lid = str(leaf_id)
        with self.db.get_db_session() as session:
            leaf = session.query(LeafModel).filter(LeafModel.id == lid).first()
            if not leaf or leaf.deleted_at is None:
                return False
        return self.hard_delete_leaf(lid)

    def permanently_delete_trashed_database(self, database_id: str) -> bool:
        """Hard-delete one database only if it is currently soft-deleted."""
        did = str(database_id)
        with self.db.get_db_session() as session:
            db = session.query(DatabaseModel).filter(DatabaseModel.id == did).first()
            if not db or db.deleted_at is None:
                return False
        return self.hard_delete_database(did)

    def purge_all_trashed(self) -> TrashPurgeStats:
        """Permanently remove every soft-deleted database and leaf (databases first)."""
        with self.db.get_db_session() as session:
            db_ids = [d.id for d in session.query(DatabaseModel).filter(DatabaseModel.deleted_at.isnot(None)).all()]
            leaves = session.query(LeafModel).filter(LeafModel.deleted_at.isnot(None)).all()
            by_id = {l.id: l for l in leaves}
            ids = set(by_id.keys())

            def trash_depth(nid: str) -> int:
                d = 0
                cur = by_id.get(nid)
                while cur and cur.parent_id and cur.parent_id in ids:
                    d += 1
                    cur = by_id.get(cur.parent_id)
                return d

            sorted_leaf_ids = sorted(ids, key=trash_depth, reverse=True)

        purged_dbs = 0
        for did in db_ids:
            if self.hard_delete_database(did):
                purged_dbs += 1
        purged_leaves = 0
        for lid in sorted_leaf_ids:
            if self.permanently_delete_trashed_leaf(lid):
                purged_leaves += 1
        if purged_dbs or purged_leaves:
            logger.info("Trash purge-all: {} databases, {} leaves", purged_dbs, purged_leaves)
        return TrashPurgeStats(purged_leaves=purged_leaves, purged_databases=purged_dbs)

    def purge_expired(self, retention_days: int) -> tuple[int, int]:
        """
        Permanently delete soft-deleted items older than retention_days.
        Returns (purged_leaves, purged_databases).
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        purged_dbs = 0
        purged_leaves = 0

        with self.db.get_db_session() as session:
            old_dbs = (
                session.query(DatabaseModel)
                .filter(DatabaseModel.deleted_at.isnot(None))
                .filter(DatabaseModel.deleted_at < cutoff)
                .all()
            )
            db_ids = [d.id for d in old_dbs]

        for did in db_ids:
            if self.hard_delete_database(did):
                purged_dbs += 1

        with self.db.get_db_session() as session:
            old_leaves = (
                session.query(LeafModel)
                .filter(LeafModel.deleted_at.isnot(None))
                .filter(LeafModel.deleted_at < cutoff)
                .all()
            )
            by_id = {l.id: l for l in old_leaves}
            ids = set(by_id.keys())

            def trash_depth(nid: str) -> int:
                d = 0
                cur = by_id.get(nid)
                while cur and cur.parent_id and cur.parent_id in ids:
                    d += 1
                    cur = by_id.get(cur.parent_id)
                return d

            sorted_ids = sorted(ids, key=trash_depth, reverse=True)

        for lid in sorted_ids:
            if self.hard_delete_leaf(lid):
                purged_leaves += 1

        if purged_dbs or purged_leaves:
            logger.info("Trash purge: {} databases, {} leaves", purged_dbs, purged_leaves)
        return purged_leaves, purged_dbs

    def list_trash(self, retention_days: int) -> TrashListResponse:
        self.purge_expired(retention_days)
        delta = timedelta(days=retention_days)
        with self.db.get_db_session() as session:
            leaves = (
                session.query(LeafModel)
                .filter(LeafModel.deleted_at.isnot(None))
                .order_by(LeafModel.deleted_at.desc())
                .all()
            )
            dbs = (
                session.query(DatabaseModel)
                .filter(DatabaseModel.deleted_at.isnot(None))
                .order_by(DatabaseModel.deleted_at.desc())
                .all()
            )

        def purge_at(dt: datetime) -> datetime:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt + delta

        return TrashListResponse(
            retention_days=retention_days,
            leaves=[
                TrashLeafItem(
                    id=l.id,
                    title=l.title,
                    deleted_at=l.deleted_at,
                    purge_at=purge_at(l.deleted_at),
                )
                for l in leaves
                if l.deleted_at is not None
            ],
            databases=[
                TrashDatabaseItem(
                    id=d.id,
                    title=d.title,
                    deleted_at=d.deleted_at,
                    purge_at=purge_at(d.deleted_at),
                )
                for d in dbs
                if d.deleted_at is not None
            ],
        )
