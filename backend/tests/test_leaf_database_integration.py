import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.database.connectors.mysql import MySQLDatabaseConnector
from app.database.models.mysql_models import DatabaseRowModel, LeafModel
from app.database.operations.database_operations import DatabaseOperations
from app.database.operations.leaf_operations import LeafOperations
from app.dtos.database_dtos import DatabaseCreate, RowCreate
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
    get_file_storage.cache_clear()

    config = SimpleNamespace(DATA_DIR=str(data_dir), DATABASE_URL=f"sqlite:///{db_path.as_posix()}")
    connector = MySQLDatabaseConnector(config)

    yield {
        "connector": connector,
        "leaf_ops": LeafOperations(connector),
        "database_ops": DatabaseOperations(connector),
    }

    connector.engine.dispose()
    get_file_storage.cache_clear()


def test_deleting_database_removes_row_pages(operations):
    database_ops: DatabaseOperations = operations["database_ops"]
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
