"""
Reverse sync: file → DB (`backend/app/sync/file_to_db.py`).

Purpose:
- Parses .md files (pages + database rows) from DATA_DIR and upserts
  them into the SQLite index.
- Used by:
  - The file watcher (single-file incremental sync on external change)
  - Full reconciliation on startup or manual "rebuild index from files"

How it works:
- `sync_file(path)`: read one .md → compare `updated_at` with DB → upsert if file is newer
- `sync_all()`: scan all .md files under DATA_DIR, upsert each, remove DB rows with no file
- Uses `_parse_md()` from file_storage.py to read frontmatter + body
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import func, text

from app.database.connectors.mysql import get_db_connector
from app.database.models.mysql_models import (
    DatabaseModel,
    DatabaseRowModel,
    LeafModel,
)
from app.dtos.leaf_dtos import LeafType, infer_leaf_type
from app.storage.file_storage import _parse_md

logger = logging.getLogger(__name__)


def _parse_datetime(val) -> Optional[datetime]:
    """Parse a datetime from frontmatter (string or datetime)."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val))
    except (ValueError, TypeError):
        return None


class FileToDbSyncer:
    """Syncs .md file content back into the SQLite index."""

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.pages_dir = self.data_dir / "pages"
        self.databases_dir = self.data_dir / "databases"

    def sync_file(self, path: Path) -> bool:
        """
        Sync a single .md file into the DB.
        Returns True if the DB was updated, False if skipped.
        """
        path = Path(path)
        if not path.exists() or not path.suffix == ".md":
            return False

        parsed = _parse_md(path)
        if not parsed:
            logger.warning("Could not parse %s — skipping", path)
            return False

        leaf_id = parsed.get("id")
        if not leaf_id:
            logger.warning("No 'id' in frontmatter of %s — skipping", path)
            return False

        # Determine if this is a database row based on path
        database_id = self._database_id_from_path(path)
        if database_id is None:
            database_id = parsed.get("database_id")

        file_updated_at = _parse_datetime(parsed.get("updated_at"))

        connector = get_db_connector()
        with connector.get_db_session() as session:
            # Disable FK checks for this session — parent/database may not
            # be synced yet when the watcher fires for a child or row file.
            session.execute(text("PRAGMA foreign_keys = OFF"))

            db_leaf = session.query(LeafModel).filter(LeafModel.id == leaf_id).first()

            if db_leaf:
                # Compare timestamps — only update if file is newer
                if file_updated_at and db_leaf.updated_at:
                    if db_leaf.updated_at >= file_updated_at:
                        return False

                # Update existing leaf from file
                self._update_leaf_from_parsed(db_leaf, parsed, database_id)
                session.commit()
                logger.info("Reverse-synced %s (updated existing leaf)", leaf_id)
                return True
            else:
                # Create new leaf from file
                if database_id:
                    self._ensure_database_model(session, database_id)
                new_leaf = self._create_leaf_from_parsed(parsed, database_id)
                session.add(new_leaf)
                session.flush()

                # Row FK requires the leaf row to exist; DB row must exist (see _ensure_database_model).
                if database_id:
                    self._ensure_database_row(session, database_id, leaf_id)

                session.commit()
                logger.info("Reverse-synced %s (created new leaf)", leaf_id)
                return True

    def handle_file_deleted(self, path: Path) -> bool:
        """
        Handle a .md file being deleted externally.
        Removes the corresponding leaf from the DB.
        Returns True if a leaf was deleted.
        """
        # Extract leaf_id from filename (uuid.md)
        leaf_id = path.stem
        if not leaf_id:
            return False

        connector = get_db_connector()
        with connector.get_db_session() as session:
            db_leaf = session.query(LeafModel).filter(LeafModel.id == leaf_id).first()
            if not db_leaf:
                return False

            # Remove from parent's children_ids
            if db_leaf.parent_id:
                parent = session.query(LeafModel).filter(
                    LeafModel.id == db_leaf.parent_id
                ).first()
                if parent and parent.children_ids:
                    parent.children_ids = [
                        cid for cid in parent.children_ids if cid != leaf_id
                    ]

            session.delete(db_leaf)
            session.commit()
            logger.info("Removed leaf %s from DB (file was deleted)", leaf_id)
            return True

    def sync_all(self) -> dict:
        """
        Full reconciliation: scan all .md files, upsert each into DB,
        and optionally remove DB entries that have no corresponding file.

        Returns a summary dict: {created, updated, skipped, deleted, errors}.
        """
        stats = {"created": 0, "updated": 0, "skipped": 0, "deleted": 0, "errors": 0}

        # Collect all file leaf IDs
        file_leaf_ids: set[str] = set()
        md_files: list[tuple[Path, Optional[str]]] = []  # (path, database_id)

        # Pages
        if self.pages_dir.exists():
            for f in self.pages_dir.glob("*.md"):
                md_files.append((f, None))

        # Database rows
        if self.databases_dir.exists():
            for db_dir in self.databases_dir.iterdir():
                if db_dir.is_dir():
                    rows_dir = db_dir / "rows"
                    if rows_dir.exists():
                        for f in rows_dir.glob("*.md"):
                            md_files.append((f, db_dir.name))

        connector = get_db_connector()

        try:
            # Sync database meta.json files (needs leaves for parent_leaf_id FK)
            self._sync_database_metas()

            for path, database_id in md_files:
                try:
                    parsed = _parse_md(path)
                    if not parsed:
                        stats["errors"] += 1
                        continue

                    leaf_id = parsed.get("id")
                    if not leaf_id:
                        stats["errors"] += 1
                        continue

                    file_leaf_ids.add(leaf_id)
                    if database_id is None:
                        database_id = parsed.get("database_id")

                    with connector.get_db_session() as session:
                        # PRAGMA is connection-scoped — must be set per session.
                        session.execute(text("PRAGMA foreign_keys = OFF"))

                        db_leaf = session.query(LeafModel).filter(
                            LeafModel.id == leaf_id
                        ).first()

                        if db_leaf:
                            file_updated_at = _parse_datetime(parsed.get("updated_at"))
                            if file_updated_at and db_leaf.updated_at and db_leaf.updated_at >= file_updated_at:
                                stats["skipped"] += 1
                                continue

                            self._update_leaf_from_parsed(db_leaf, parsed, database_id)
                            session.commit()
                            stats["updated"] += 1
                        else:
                            if database_id:
                                self._ensure_database_model(session, database_id)
                            new_leaf = self._create_leaf_from_parsed(parsed, database_id)
                            session.add(new_leaf)
                            session.flush()
                            if database_id:
                                self._ensure_database_row(session, database_id, leaf_id)
                            session.commit()
                            stats["created"] += 1

                except Exception:
                    logger.exception("Error syncing file %s", path)
                    stats["errors"] += 1

            # Remove DB leaves that have no corresponding file
            # (only pages/rows that would have .md files — skip if file_leaf_ids is empty
            #  to avoid accidentally wiping the DB on an empty scan)
            if file_leaf_ids:
                with connector.get_db_session() as session:
                    all_leaves = session.query(LeafModel).all()
                    for leaf in all_leaves:
                        if leaf.id not in file_leaf_ids:
                            session.delete(leaf)
                            stats["deleted"] += 1
                    if stats["deleted"]:
                        session.commit()
        finally:
            logger.info(
                "Full sync complete: created=%d updated=%d skipped=%d deleted=%d errors=%d",
                stats["created"], stats["updated"], stats["skipped"],
                stats["deleted"], stats["errors"],
            )
        return stats

    def _sync_database_metas(self) -> None:
        """Sync database meta.json files into the databases table."""
        if not self.databases_dir.exists():
            return

        connector = get_db_connector()
        for db_dir in self.databases_dir.iterdir():
            meta_file = db_dir / "meta.json"
            if not meta_file.exists():
                continue
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                db_id = meta.get("id", db_dir.name)

                with connector.get_db_session() as session:
                    # PRAGMA is connection-scoped — disable FK checks so
                    # parent_leaf_id can reference a leaf not yet synced.
                    session.execute(text("PRAGMA foreign_keys = OFF"))

                    db_model = session.query(DatabaseModel).filter(
                        DatabaseModel.id == db_id
                    ).first()

                    if db_model:
                        db_model.title = meta.get("title", db_model.title)
                        db_model.schema = meta.get("schema", db_model.schema)
                        db_model.view_type = meta.get("view_type", db_model.view_type)
                        db_model.parent_leaf_id = meta.get("parent_leaf_id", db_model.parent_leaf_id)
                    else:
                        db_model = DatabaseModel(
                            id=db_id,
                            title=meta.get("title", "Untitled database"),
                            schema=meta.get("schema"),
                            view_type=meta.get("view_type", "table"),
                            parent_leaf_id=meta.get("parent_leaf_id"),
                        )
                        created_at = _parse_datetime(meta.get("created_at"))
                        if created_at:
                            db_model.created_at = created_at
                        session.add(db_model)

                    session.commit()
            except Exception:
                logger.exception("Error syncing database meta %s", meta_file)

    def _database_id_from_path(self, path: Path) -> Optional[str]:
        """Extract database_id from a path like databases/{uuid}/rows/{leaf}.md."""
        parts = path.parts
        try:
            # Look for "databases" / {uuid} / "rows" / {file}.md
            for i, part in enumerate(parts):
                if part == "rows" and i >= 2 and parts[i - 2] == "databases":
                    return parts[i - 1]
        except (IndexError, ValueError):
            pass
        return None

    def _update_leaf_from_parsed(
        self, db_leaf: LeafModel, parsed: dict, database_id: Optional[str]
    ) -> None:
        """Update an existing LeafModel from parsed .md frontmatter."""
        db_leaf.title = parsed.get("title", db_leaf.title)
        db_leaf.parent_id = parsed.get("parent_id", db_leaf.parent_id)
        db_leaf.children_ids = list(parsed.get("children_ids") or [])
        db_leaf.tags = list(parsed.get("tags") or [])
        db_leaf.order = parsed.get("order", db_leaf.order or 0)
        db_leaf.database_id = database_id

        # Content: store the markdown body as-is (the DB stores serialized content)
        content_md = parsed.get("content_md", "")
        if content_md:
            db_leaf.content = content_md

        updated_at = _parse_datetime(parsed.get("updated_at"))
        if updated_at:
            db_leaf.updated_at = updated_at

        db_leaf.type = infer_leaf_type(db_leaf.parent_id, db_leaf.database_id)

    def _create_leaf_from_parsed(
        self, parsed: dict, database_id: Optional[str]
    ) -> LeafModel:
        """Create a new LeafModel from parsed .md frontmatter."""
        leaf_id = parsed["id"]
        parent_id = parsed.get("parent_id")

        leaf = LeafModel(
            id=leaf_id,
            title=parsed.get("title", "Untitled"),
            parent_id=parent_id,
            children_ids=list(parsed.get("children_ids") or []),
            tags=list(parsed.get("tags") or []),
            order=parsed.get("order", 0),
            database_id=database_id,
            type=infer_leaf_type(parent_id, database_id),
        )

        content_md = parsed.get("content_md", "")
        if content_md:
            leaf.content = content_md

        created_at = _parse_datetime(parsed.get("created_at"))
        if created_at:
            leaf.created_at = created_at

        updated_at = _parse_datetime(parsed.get("updated_at"))
        if updated_at:
            leaf.updated_at = updated_at

        return leaf

    def _ensure_database_model(self, session, database_id: str) -> None:
        """
        Ensure ``databases`` has a row for this id so leaf / database_rows FKs succeed.

        ``_sync_database_metas`` skips folders without ``meta.json``; row ``.md`` files can
        still exist under ``databases/<id>/rows/``, so we create a minimal DB record here.
        """
        if session.get(DatabaseModel, database_id):
            return

        session.execute(text("PRAGMA foreign_keys = OFF"))

        db_dir = self.databases_dir / database_id
        meta_file = db_dir / "meta.json"
        title = "Untitled database"
        schema = None
        view_type = "table"
        parent_leaf_id = None
        created_at = None
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                title = meta.get("title", title)
                schema = meta.get("schema")
                view_type = meta.get("view_type", view_type)
                parent_leaf_id = meta.get("parent_leaf_id")
                created_at = _parse_datetime(meta.get("created_at"))
            except Exception:
                logger.exception("Invalid meta.json for database %s", database_id)

        db_model = DatabaseModel(
            id=database_id,
            title=title,
            schema=schema,
            view_type=view_type,
            parent_leaf_id=parent_leaf_id,
        )
        if created_at:
            db_model.created_at = created_at
        session.add(db_model)
        session.flush()

    def _ensure_database_row(
        self, session, database_id: str, leaf_id: str
    ) -> None:
        """Ensure a DatabaseRowModel exists linking this leaf to its database."""
        self._ensure_database_model(session, database_id)

        if not session.get(LeafModel, leaf_id):
            logger.warning(
                "Skipping database_rows link: leaf %s not persisted before row link",
                leaf_id,
            )
            return

        existing = session.query(DatabaseRowModel).filter(
            DatabaseRowModel.leaf_id == leaf_id
        ).first()
        if existing:
            return

        max_o = (
            session.query(func.max(DatabaseRowModel.order))
            .filter(DatabaseRowModel.database_id == database_id)
            .scalar()
        )
        next_order = (max_o + 1) if max_o is not None else 0
        row = DatabaseRowModel(
            database_id=database_id,
            leaf_id=leaf_id,
            properties={"title": "", "leaf_id": leaf_id},
            order=next_order,
        )
        session.add(row)
