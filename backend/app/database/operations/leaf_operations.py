"""
Leaf business logic operations (`backend/app/database/operations/leaf_operations.py`).

Purpose:
- Implements the core server-side behavior for leaf/page/project nodes:
  - create/read/update/delete leaves
  - autosave content updates (with optional `updated_at` conflict detection)
  - reorder children ordering
  - build the lightweight leaf tree (`/leaves/tree`)
  - backlinks and explicit link graph (`/leaves/{id}/backlinks`, `/leaves/graph`)

How to read:
- Start with the public methods on `LeafOperations` (e.g. `create_leaf`, `get_leaf`, `patch_leaf_content`, `delete_leaf`).
- Follow the private helpers:
  - `_serialize_content` / `_deserialize_content`: how rich editor content is stored/restored
  - `_extract_link_targets` and `_resolve_link_target`: how `[[wikilinks]]` are parsed/resolved
  - `_schedule_leaf_sync`: when/how page content is written out to `.md` files via `FileStorage`
  - `_leaf_to_dto` and `_leaf_tree_item`: how DB rows are mapped into API DTOs

Update:
- When changing persistence semantics, update the serialization + DB update helpers first.
- If you modify wikilink parsing rules, update `_extract_link_targets` and `_resolve_link_target`.
- If you add new leaf fields, update:
  - DTOs (`backend/app/dtos/leaf_dtos.py`)
  - SQLAlchemy model (`backend/app/database/models/mysql_models.py`)
  - mapping (`_leaf_to_dto`) and update logic (`_apply_leaf_update`)

Debug:
- Autosave/patch issues: check `patch_leaf_content()` conflict logic and serialization (`_serialize_content`).
- Link/backlink issues: check `sync_page_links()` (deletes outgoing links then upserts from parsed targets).
- File sync issues: look for exceptions around `_schedule_leaf_sync()` / `FileStorage.write_page()`.
"""

import asyncio
import json
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends
from loguru import logger

from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.database.models.mysql_models import DatabaseModel, DatabaseRowModel, LeafModel, PageLinkModel
from app.dtos.leaf_dtos import (
    Leaf,
    LeafContentUpdate,
    LeafCreate,
    LeafGraph,
    LeafGraphEdge,
    LeafGraphNode,
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

    def _serialize_content(self, content: dict | str | None) -> str | None:
        if content is None:
            return None
        if isinstance(content, str):
            return content
        return json.dumps(content)

    def _deserialize_content(self, content: str | None):
        if not content:
            return content
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict) and parsed.get("type") == "doc":
                return parsed
        except json.JSONDecodeError:
            return content
        return content

    def _content_to_search_text(self, content: dict | str | None) -> str:
        if content is None:
            return ""
        if isinstance(content, str):
            return content

        chunks: list[str] = []

        def walk(node):
            if isinstance(node, dict):
                if isinstance(node.get("text"), str):
                    chunks.append(node["text"])
                attrs = node.get("attrs")
                if isinstance(attrs, dict) and isinstance(attrs.get("title"), str):
                    chunks.append(attrs["title"])
                for value in node.values():
                    if isinstance(value, (dict, list)):
                        walk(value)
            elif isinstance(node, list):
                for child in node:
                    walk(child)

        walk(content)
        return "\n".join(chunks)

    def _leaf_to_dto(self, leaf: LeafModel, path: str = "") -> Leaf:
        deserialized_content = self._deserialize_content(leaf.content)
        content_text = self._content_to_search_text(deserialized_content)
        return Leaf(
            id=leaf.id,
            title=leaf.title,
            path=path,
            type=leaf.type,
            description=leaf.description,
            content=deserialized_content,
            parent_id=leaf.parent_id if leaf.parent_id else None,
            database_id=leaf.database_id if leaf.database_id else None,
            children_ids=list(leaf.children_ids or []),
            tags=list(leaf.tags or []),
            icon=leaf.icon,
            properties=leaf.properties,
            content_text_length=len(content_text),
            created_at=leaf.created_at,
            updated_at=leaf.updated_at,
        )

    def _leaf_tree_item(self, row, path: str = "") -> LeafTreeItem:
        return LeafTreeItem(
            id=row[0],
            title=row[1],
            path=path,
            type=row[2],
            parent_id=row[3],
            children_ids=list(row[4] or []),
            order=row[5] if row[5] is not None else 0,
            tags=list(row[6] or []),
        )

    def _build_leaf_path_map(self, leaves: list[LeafModel]) -> dict[str, str]:
        by_id = {leaf.id: leaf for leaf in leaves}
        path_map: dict[str, str] = {}

        def slugify(part: str) -> str:
            slug = re.sub(r"\s+", "-", (part or "untitled").strip().lower())
            slug = re.sub(r"[^a-z0-9\-_/]", "", slug)
            return slug or "untitled"

        def build_path(leaf: LeafModel) -> str:
            if leaf.id in path_map:
                return path_map[leaf.id]

            segments = [slugify(leaf.title)]
            seen: set[str] = {leaf.id}
            current_parent = leaf.parent_id
            while current_parent and current_parent not in seen:
                seen.add(current_parent)
                parent = by_id.get(current_parent)
                if not parent:
                    break
                segments.append(slugify(parent.title))
                current_parent = parent.parent_id

            path = "/".join(reversed(segments))
            path_map[leaf.id] = path
            return path

        for leaf in leaves:
            build_path(leaf)

        return path_map

    def _extract_link_targets(self, content: dict | str | None) -> set[str]:
        targets: set[str] = set()

        def walk(node):
            if isinstance(node, dict):
                if node.get("type") == "wikilink":
                    attrs = node.get("attrs") or {}
                    if isinstance(attrs, dict):
                        target = attrs.get("id") or attrs.get("path") or attrs.get("label")
                        if isinstance(target, str) and target.strip():
                            targets.add(target.strip())
                elif node.get("type") == "hashtag":
                    attrs = node.get("attrs") or {}
                    if isinstance(attrs, dict):
                        tag = attrs.get("tag")
                        if isinstance(tag, str) and tag.strip():
                            targets.add(tag.strip())
                for value in node.values():
                    if isinstance(value, (dict, list)):
                        walk(value)
            elif isinstance(node, list):
                for child in node:
                    walk(child)

        if isinstance(content, dict):
            walk(content)

        searchable_content = self._content_to_search_text(content)
        if searchable_content:
            pattern = r'\[\[([^\]]+)\]\]'
            raw_targets = set(re.findall(pattern, searchable_content))
            for raw in raw_targets:
                target = raw.split("|", 1)[0].strip()
                if target:
                    targets.add(target)
        return targets

    def _resolve_link_target(self, db_session, target_name: str) -> LeafModel | None:
        target_name = target_name.strip()
        if not target_name:
            return None

        direct_id_match = (
            db_session.query(LeafModel)
            .filter(LeafModel.id == target_name)
            .filter(LeafModel.deleted_at.is_(None))
            .first()
        )
        if direct_id_match:
            return direct_id_match

        if "/" in target_name:
            leaves = db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
            path_map = self._build_leaf_path_map(leaves)
            normalized_target = re.sub(r"\s+", "-", target_name.lower())
            normalized_target = re.sub(r"[^a-z0-9\-_/]", "", normalized_target)
            for leaf in leaves:
                if path_map.get(leaf.id) == normalized_target:
                    return leaf
            return None

        matches = (
            db_session.query(LeafModel)
            .filter(LeafModel.title == target_name)
            .filter(LeafModel.deleted_at.is_(None))
            .all()
        )
        if len(matches) == 1:
            return matches[0]
        return None

    def _leaf_storage_payload(self, leaf: LeafModel) -> dict:
        return {
            "leaf_id": leaf.id,
            "title": leaf.title,
            "content_html": self._serialize_content(self._deserialize_content(leaf.content)),
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

    def _get_leaf_or_404(
        self,
        db_session,
        leaf_id: UUID | str,
        *,
        include_deleted: bool = False,
    ) -> LeafModel:
        lookup_id = str(leaf_id)
        leaf = db_session.query(LeafModel).filter(LeafModel.id == lookup_id).first()
        if not leaf:
            raise LeafNotFound(leaf_id=lookup_id)
        if not include_deleted and leaf.deleted_at is not None:
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
            if field == "content":
                setattr(db_leaf, field, self._serialize_content(value))
                continue
            if field in {"children_ids", "tags"} and value is not None:
                setattr(db_leaf, field, list(value))
                continue
            if field in {"icon", "properties"}:
                setattr(db_leaf, field, dict(value) if value is not None else None)
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
                    content=self._serialize_content(leaf.content),
                    parent_id=leaf.parent_id,
                    database_id=leaf.database_id,
                    children_ids=list(leaf.children_ids),
                    tags=list(leaf.tags),
                    icon=leaf.icon,
                    properties=leaf.properties,
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
                path_map = self._build_leaf_path_map(
                    db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                )
                result = self._leaf_to_dto(db_leaf, path_map.get(db_leaf.id, ""))

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
                path_map = self._build_leaf_path_map(
                    db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                )
                return self._leaf_to_dto(leaf, path_map.get(leaf.id, ""))
        except LeafException:
            raise
        except Exception as e:
            logger.exception(f"get_leaf failed for {leaf_id}")
            raise LeafException(status_code=getattr(e, "status_code", 500), detail=str(e))

    async def get_all_leaves(self) -> list[Leaf]:
        try:
            with self.db.get_db_session() as db_session:
                leaves = db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                path_map = self._build_leaf_path_map(leaves)
                return [self._leaf_to_dto(leaf, path_map.get(leaf.id, "")) for leaf in leaves]
        except Exception as e:
            logger.exception("get_all_leaves failed")
            raise LeafException(status_code=getattr(e, "status_code", 500), detail=str(e))

    async def get_leaf_tree(
        self,
        type_filter: LeafType | None = None,
        parent_id: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        include_db_rows: bool = False,
    ) -> list[LeafTreeItem]:
        try:
            with self.db.get_db_session() as db_session:
                all_leaves = db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                path_map = self._build_leaf_path_map(all_leaves)
                q = db_session.query(LeafModel).with_entities(
                    LeafModel.id,
                    LeafModel.title,
                    LeafModel.type,
                    LeafModel.parent_id,
                    LeafModel.children_ids,
                    LeafModel.order,
                    LeafModel.tags,
                ).filter(LeafModel.deleted_at.is_(None))
                if type_filter is not None:
                    q = q.filter(LeafModel.type == type_filter)
                if parent_id is not None:
                    q = q.filter(LeafModel.parent_id == parent_id)
                if not include_db_rows:
                    q = q.filter(LeafModel.database_id.is_(None))
                q = q.order_by(LeafModel.order.asc(), LeafModel.updated_at.desc())
                if offset is not None:
                    q = q.offset(offset)
                if limit is not None:
                    q = q.limit(limit)
                return [self._leaf_tree_item(row, path_map.get(row[0], "")) for row in q.all()]
        except Exception as e:
            logger.exception("get_leaf_tree failed")
            raise LeafException(status_code=500, detail=str(e))

    async def patch_leaf_content(self, leaf_id: UUID, body: LeafContentUpdate) -> Leaf:
        try:
            with self.db.get_db_session() as db_session:
                db_leaf = self._get_leaf_or_404(db_session, leaf_id)
                if body.updated_at is not None and db_leaf.updated_at and db_leaf.updated_at > body.updated_at:
                    raise LeafException(status_code=409, detail="Conflict: leaf was updated elsewhere")
                db_leaf.content = self._serialize_content(body.content)
                db_leaf.updated_at = datetime.now()
                self.sync_page_links(db_session, str(leaf_id), body.content)
                db_session.commit()
                db_session.refresh(db_leaf)
                payload = self._leaf_storage_payload(db_leaf)
                path_map = self._build_leaf_path_map(
                    db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                )
                result = self._leaf_to_dto(db_leaf, path_map.get(db_leaf.id, ""))
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
                    child = (
                        db_session.query(LeafModel)
                        .filter(LeafModel.id == cid)
                        .filter(LeafModel.deleted_at.is_(None))
                        .first()
                    )
                    if child:
                        child.order = i
                db_session.commit()
                db_session.refresh(parent)
                path_map = self._build_leaf_path_map(
                    db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                )
                return self._leaf_to_dto(parent, path_map.get(parent.id, ""))
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
                path_map = self._build_leaf_path_map(
                    db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                )
                result = self._leaf_to_dto(db_leaf, path_map.get(db_leaf.id, ""))
            self._schedule_leaf_sync(payload)
            logger.info(f"Leaf updated: {result.id}")
            return result
        except (LeafNotFound, LeafException):
            raise
        except Exception as e:
            logger.exception(f"update_leaf failed for {leaf_id}")
            raise LeafException(status_code=getattr(e, "status_code", 500), detail=str(e))

    async def get_backlinks(self, leaf_id: UUID) -> list[LeafTreeItem]:
        """Return pages that link to this leaf via [[wikilinks]]."""
        try:
            lookup_id = str(leaf_id)
            with self.db.get_db_session() as db_session:
                source_ids = (
                    db_session.query(PageLinkModel.source_leaf_id)
                    .filter(PageLinkModel.target_leaf_id == lookup_id)
                    .all()
                )
                ids = [row[0] for row in source_ids]
                if not ids:
                    return []
                rows = (
                    db_session.query(LeafModel)
                    .with_entities(
                        LeafModel.id, LeafModel.title, LeafModel.type,
                        LeafModel.parent_id, LeafModel.children_ids,
                        LeafModel.order, LeafModel.tags,
                    )
                    .filter(LeafModel.id.in_(ids))
                    .filter(LeafModel.deleted_at.is_(None))
                    .all()
                )
                path_map = self._build_leaf_path_map(
                    db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                )
                return [self._leaf_tree_item(row, path_map.get(row[0], "")) for row in rows]
        except Exception as e:
            logger.exception(f"get_backlinks failed for {leaf_id}")
            raise LeafException(status_code=500, detail=str(e))

    async def get_leaf_graph(self) -> LeafGraph:
        try:
            with self.db.get_db_session() as db_session:
                leaves = db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                path_map = self._build_leaf_path_map(leaves)
                nodes = [
                    LeafGraphNode(
                        id=leaf.id,
                        title=leaf.title,
                        path=path_map.get(leaf.id, leaf.title),
                        type=leaf.type,
                        tags=list(leaf.tags or []),
                    )
                    for leaf in leaves
                ]

                valid_ids = {leaf.id for leaf in leaves}
                links = (
                    db_session.query(PageLinkModel)
                    .filter(PageLinkModel.source_leaf_id.in_(valid_ids))
                    .filter(PageLinkModel.target_leaf_id.in_(valid_ids))
                    .all()
                )
                edges = [
                    LeafGraphEdge(source=link.source_leaf_id, target=link.target_leaf_id)
                    for link in links
                    if link.source_leaf_id != link.target_leaf_id
                ]
                return LeafGraph(nodes=nodes, edges=edges)
        except Exception as e:
            logger.exception("get_leaf_graph failed")
            raise LeafException(status_code=500, detail=str(e))

    def sync_page_links(self, db_session, source_leaf_id: str, content: dict | str | None) -> None:
        """Parse [[Page name]] from content and upsert page_links rows."""
        # Delete existing outgoing links for this source
        db_session.query(PageLinkModel).filter(
            PageLinkModel.source_leaf_id == source_leaf_id
        ).delete(synchronize_session=False)

        if not content:
            return

        link_names = self._extract_link_targets(content)
        if not link_names:
            return

        for name in link_names:
            target = self._resolve_link_target(db_session, name)
            if target and target.id != source_leaf_id:
                link = PageLinkModel(
                    source_leaf_id=source_leaf_id,
                    target_leaf_id=target.id,
                )
                db_session.add(link)

    async def restore_leaf(self, leaf_id: UUID) -> Leaf:
        """Clear soft-delete for this leaf, its trashed descendants, ancestor chain, and nested DBs."""
        try:
            db_payloads: list[dict] = []
            with self.db.get_db_session() as db_session:
                db_leaf = (
                    db_session.query(LeafModel)
                    .filter(LeafModel.id == str(leaf_id))
                    .first()
                )
                if db_leaf is None or db_leaf.deleted_at is None:
                    raise LeafNotFound(leaf_id=str(leaf_id))

                ancestors: list[str] = []
                cur: LeafModel | None = db_leaf
                while cur is not None and cur.deleted_at is not None:
                    ancestors.append(cur.id)
                    if not cur.parent_id:
                        break
                    cur = (
                        db_session.query(LeafModel)
                        .filter(LeafModel.id == cur.parent_id)
                        .first()
                    )

                subtree: set[str] = set()
                stack = [str(leaf_id)]
                while stack:
                    cid = stack.pop()
                    if cid in subtree:
                        continue
                    node = db_session.query(LeafModel).filter(LeafModel.id == cid).first()
                    if node is None or node.deleted_at is None:
                        continue
                    subtree.add(cid)
                    for ch in node.children_ids or []:
                        stack.append(ch)

                to_revive = set(ancestors) | subtree
                revived_models = (
                    db_session.query(LeafModel)
                    .filter(LeafModel.id.in_(to_revive))
                    .all()
                )
                by_id = {n.id: n for n in revived_models}

                def trash_depth(nid: str) -> int:
                    d = 0
                    cur_n = by_id.get(nid)
                    while cur_n and cur_n.parent_id:
                        if cur_n.parent_id not in to_revive:
                            break
                        p = by_id.get(cur_n.parent_id)
                        if p is None or p.deleted_at is None:
                            break
                        d += 1
                        cur_n = p
                    return d

                for nid in sorted(to_revive, key=trash_depth):
                    node = by_id.get(nid)
                    if node is None:
                        continue
                    node.deleted_at = None
                    if node.parent_id:
                        p = db_session.query(LeafModel).filter(LeafModel.id == node.parent_id).first()
                        if p is not None and p.deleted_at is None:
                            self._append_child_id(p, node.id)

                dbs = (
                    db_session.query(DatabaseModel)
                    .filter(DatabaseModel.parent_leaf_id.in_(to_revive))
                    .filter(DatabaseModel.deleted_at.isnot(None))
                    .all()
                )
                for d in dbs:
                    d.deleted_at = None
                    db_payloads.append(
                        {
                            "db_id": d.id,
                            "title": d.title,
                            "schema": d.schema or {},
                            "view_type": d.view_type or "table",
                            "parent_leaf_id": d.parent_leaf_id,
                            "created_at": d.created_at,
                            "updated_at": d.updated_at,
                        }
                    )

                db_session.commit()

                restored = self._get_leaf_or_404(db_session, leaf_id)
                path_map = self._build_leaf_path_map(
                    db_session.query(LeafModel).filter(LeafModel.deleted_at.is_(None)).all()
                )
                result = self._leaf_to_dto(restored, path_map.get(restored.id, ""))
                sync_payload = self._leaf_storage_payload(restored)

            for p in db_payloads:
                get_file_storage().write_database(**p)
            self._schedule_leaf_sync(sync_payload)
            logger.info("Leaf restored: %s", leaf_id)
            return result
        except LeafNotFound:
            raise
        except Exception as e:
            logger.exception("restore_leaf failed for %s", leaf_id)
            raise LeafException(status_code=500, detail=str(e))

    async def delete_leaf(self, leaf_id: UUID):
        """Soft-delete: subtree + nested databases go to Trash (see Trash retention)."""
        try:
            now = datetime.now(timezone.utc)
            db_payloads: list[dict] = []
            with self.db.get_db_session() as db_session:
                db_leaf = self._get_leaf_or_404(db_session, leaf_id)

                def collect_subtree_leaf_ids(root_id: str) -> list[str]:
                    ordered: list[str] = []
                    stack = [root_id]
                    seen: set[str] = set()
                    while stack:
                        cid = stack.pop(0)
                        if cid in seen:
                            continue
                        seen.add(cid)
                        ordered.append(cid)
                        node = db_session.query(LeafModel).filter(LeafModel.id == cid).first()
                        if not node:
                            continue
                        for ch in node.children_ids or []:
                            if ch not in seen:
                                stack.append(ch)
                    return ordered

                subtree = collect_subtree_leaf_ids(str(leaf_id))
                for lid in subtree:
                    leaf = db_session.query(LeafModel).filter(LeafModel.id == lid).first()
                    if leaf is not None and leaf.deleted_at is None:
                        leaf.deleted_at = now

                child_dbs = (
                    db_session.query(DatabaseModel)
                    .filter(DatabaseModel.parent_leaf_id.in_(subtree))
                    .filter(DatabaseModel.deleted_at.is_(None))
                    .all()
                )
                for d in child_dbs:
                    d.deleted_at = now
                    db_payloads.append(
                        {
                            "db_id": d.id,
                            "title": d.title,
                            "schema": d.schema or {},
                            "view_type": d.view_type or "table",
                            "parent_leaf_id": d.parent_leaf_id,
                            "created_at": d.created_at,
                            "updated_at": d.updated_at,
                        }
                    )

                if db_leaf.parent_id:
                    parent = self._get_leaf_or_404(db_session, db_leaf.parent_id)
                    self._remove_child_id(parent, db_leaf.id)

                db_session.commit()

            for p in db_payloads:
                get_file_storage().write_database(**p)

            logger.info("Leaf moved to trash: %s", leaf_id)
        except LeafNotFound:
            raise
        except Exception as e:
            logger.exception("delete_leaf failed for %s", leaf_id)
            raise LeafException(status_code=500, detail=str(e))