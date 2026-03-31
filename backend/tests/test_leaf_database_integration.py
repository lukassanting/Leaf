import asyncio
from pathlib import Path
from uuid import UUID

import pytest

from app.config import ConfigSettings
from app.database.connectors.mysql import MySQLDatabaseConnector, get_db_connector
from app.runtime_config import set_app_settings
from app.database.models.mysql_models import DatabaseRowModel, LeafModel
from app.database.operations.database_operations import DatabaseOperations
from app.database.operations.leaf_operations import LeafOperations
from app.database.operations.trash_operations import TrashOperations
from app.dtos.database_dtos import DatabaseCreate, DatabaseSchema, DatabaseUpdate, PropertyDefinition, RowCreate
from app.dtos.leaf_dtos import LeafContentUpdate, LeafCreate, LeafUpdate
from app.exceptions.exceptions import LeafException
from app.storage import get_file_storage


def run(coro):
    return asyncio.run(coro)


@pytest.fixture()
def operations(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    data_dir = tmp_path / "data"
    db_path = data_dir / ".leaf.db"
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    get_db_connector.cache_clear()
    get_file_storage.cache_clear()

    cfg = ConfigSettings()
    set_app_settings(cfg)
    connector = MySQLDatabaseConnector(cfg)

    yield {
        "connector": connector,
        "leaf_ops": LeafOperations(connector),
        "database_ops": DatabaseOperations(connector),
        "trash_ops": TrashOperations(connector),
    }

    connector.engine.dispose()
    get_db_connector.cache_clear()
    get_file_storage.cache_clear()


def test_deleting_database_soft_hides_but_keeps_rows_until_purge(operations):
    database_ops: DatabaseOperations = operations["database_ops"]
    trash_ops: TrashOperations = operations["trash_ops"]
    connector: MySQLDatabaseConnector = operations["connector"]

    database = database_ops.create_database(DatabaseCreate(title="Tasks"))
    row = database_ops.create_row(database.id, RowCreate(properties={"status": "todo"}))

    assert row is not None
    assert row.leaf_id is not None

    with connector.get_db_session() as session:
        assert session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first() is not None
        assert session.query(DatabaseRowModel).filter(DatabaseRowModel.id == row.id).first() is not None

    assert database_ops.delete_database(database.id) is True

    with connector.get_db_session() as session:
        assert session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first() is not None
        assert session.query(DatabaseRowModel).filter(DatabaseRowModel.id == row.id).first() is not None

    assert trash_ops.hard_delete_database(str(database.id)) is True

    with connector.get_db_session() as session:
        assert session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first() is None
        assert session.query(DatabaseRowModel).filter(DatabaseRowModel.id == row.id).first() is None


def test_stale_content_autosave_returns_409(operations):
    leaf_ops: LeafOperations = operations["leaf_ops"]

    leaf = run(leaf_ops.create_leaf(LeafCreate(title="Page under test")))
    original_updated_at = leaf.updated_at

    updated_leaf = run(leaf_ops.patch_leaf_content(
        leaf.id,
        LeafContentUpdate(content="<p>latest</p>", updated_at=original_updated_at),
    ))

    assert updated_leaf.updated_at >= original_updated_at

    with pytest.raises(LeafException) as exc_info:
        run(leaf_ops.patch_leaf_content(
            leaf.id,
            LeafContentUpdate(content="<p>stale</p>", updated_at=original_updated_at),
        ))

    assert exc_info.value.status_code == 409


def test_creating_database_row_creates_linked_page(operations):
    database_ops: DatabaseOperations = operations["database_ops"]
    connector: MySQLDatabaseConnector = operations["connector"]

    database = database_ops.create_database(DatabaseCreate(title="Projects"))
    row = database_ops.create_row(database.id, RowCreate(properties={"owner": "Lukas"}))

    assert row is not None
    assert row.leaf_id is not None

    with connector.get_db_session() as session:
        linked_leaf = session.query(LeafModel).filter(LeafModel.id == row.leaf_id).first()
        assert linked_leaf is not None
        assert linked_leaf.database_id == database.id


def test_schema_document_content_round_trips_and_indexes_links(operations):
    leaf_ops: LeafOperations = operations["leaf_ops"]

    target = run(leaf_ops.create_leaf(LeafCreate(title="Linked page")))
    source = run(leaf_ops.create_leaf(LeafCreate(title="Structured source")))

    document = {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": f"See [[{target.title}]]"}],
            }
        ],
    }

    updated = run(leaf_ops.patch_leaf_content(source.id, LeafContentUpdate(content=document)))

    assert isinstance(updated.content, dict)
    assert updated.content["type"] == "doc"

    backlinks = run(leaf_ops.get_backlinks(target.id))
    assert [item.id for item in backlinks] == [source.id]

    structured_document = {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{
                    "type": "wikilink",
                    "attrs": {
                        "id": target.id,
                        "label": target.title,
                        "path": target.path,
                    },
                }],
            }
        ],
    }

    structured_updated = run(leaf_ops.patch_leaf_content(source.id, LeafContentUpdate(content=structured_document)))

    assert isinstance(structured_updated.content, dict)
    assert structured_updated.content["content"][0]["content"][0]["type"] == "wikilink"

    backlinks = run(leaf_ops.get_backlinks(target.id))
    assert [item.id for item in backlinks] == [source.id]


def test_remove_database_property_updates_schema_and_rows(operations):
    database_ops: DatabaseOperations = operations["database_ops"]

    db = database_ops.create_database(DatabaseCreate(title="Props DB"))
    did = UUID(db.id)
    updated = database_ops.update_database(
        did,
        DatabaseUpdate(
            schema=DatabaseSchema(
                properties=[
                    PropertyDefinition(key="status", label="Status", type="text"),
                    PropertyDefinition(key="note", label="Note", type="text"),
                ]
            ),
        ),
    )
    assert updated is not None
    row = database_ops.create_row(did, RowCreate(properties={"status": "a", "note": "b"}))
    assert row is not None

    out = database_ops.remove_schema_property(did, "status")
    assert out is not None
    db_dto, rows = out
    assert len(db_dto.schema.properties) == 1
    assert db_dto.schema.properties[0].key == "note"
    assert len(rows) == 1
    assert "status" not in rows[0].properties
    assert rows[0].properties.get("note") == "b"


def test_leaf_soft_delete_hides_from_tree_restore_brings_back(operations):
    leaf_ops: LeafOperations = operations["leaf_ops"]

    root = run(leaf_ops.create_leaf(LeafCreate(title="Root page")))
    child = run(leaf_ops.create_leaf(LeafCreate(title="Trashed child", parent_id=root.id)))

    tree_before = run(leaf_ops.get_leaf_tree())
    assert child.id in {n.id for n in tree_before}

    run(leaf_ops.delete_leaf(child.id))

    tree_after = run(leaf_ops.get_leaf_tree())
    assert child.id not in {n.id for n in tree_after}

    restored = run(leaf_ops.restore_leaf(child.id))
    assert restored.id == child.id

    tree_restored = run(leaf_ops.get_leaf_tree())
    assert child.id in {n.id for n in tree_restored}


def test_leaf_tree_and_leaf_dto_include_paths(operations):
    leaf_ops: LeafOperations = operations["leaf_ops"]

    root = run(leaf_ops.create_leaf(LeafCreate(title="Root page")))
    child = run(leaf_ops.create_leaf(LeafCreate(title="Child page", parent_id=root.id)))

    fetched_child = run(leaf_ops.get_leaf(child.id))
    tree = run(leaf_ops.get_leaf_tree())
    by_id = {item.id: item for item in tree}

    assert fetched_child.path.endswith("root-page/child-page")
    assert by_id[root.id].path.endswith("root-page")
    assert by_id[child.id].path.endswith("root-page/child-page")


def test_database_metadata_round_trips_via_schema(operations):
    database_ops: DatabaseOperations = operations["database_ops"]

    database = database_ops.create_database(DatabaseCreate(
        title="Project tracker",
        description="Inline planning database",
        tags=["planning", "roadmap"],
        icon={"type": "emoji", "value": "🗂️"},
    ))

    assert database.description == "Inline planning database"
    assert database.tags == ["planning", "roadmap"]
    assert database.icon == {"type": "emoji", "value": "🗂️"}

    updated = database_ops.update_database(database.id, DatabaseUpdate(
        title=database.title,
        description="Updated description",
        tags=["planning"],
        icon={"type": "svg", "value": "diamond-fill"},
        schema=database.schema,
        view_type=database.view_type,
        parent_leaf_id=database.parent_leaf_id,
    ))

    assert updated is not None
    assert updated.description == "Updated description"
    assert updated.tags == ["planning"]
    assert updated.icon == {"type": "svg", "value": "diamond-fill"}


def test_updating_row_backed_page_preserves_structural_fields(operations):
    database_ops: DatabaseOperations = operations["database_ops"]
    leaf_ops: LeafOperations = operations["leaf_ops"]

    database = database_ops.create_database(DatabaseCreate(title="Roadmap"))
    row = database_ops.create_row(database.id, RowCreate(properties={}))

    assert row is not None
    assert row.leaf_id is not None

    updated_leaf = run(leaf_ops.update_leaf(row.leaf_id, LeafUpdate(title="Renamed row page")))

    assert updated_leaf.title == "Renamed row page"
    assert updated_leaf.database_id == database.id
    assert updated_leaf.type.value == "page"
    assert updated_leaf.parent_id is None
