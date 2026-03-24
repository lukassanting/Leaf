"""
Conflict store (`backend/app/sync/conflict_store.py`).

Purpose:
- Tracks unresolved sync conflicts (content divergence, cloud duplicates, etc.).
- Persists to DATA_DIR/.sync-conflicts.json so conflicts survive restarts.
- Provides add/list/resolve/clear operations used by the sync controller API.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from app.dtos.sync_dtos import ConflictType, SyncConflict

logger = logging.getLogger(__name__)


class ConflictStore:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.store_path = self.data_dir / ".sync-conflicts.json"
        self._conflicts: dict[str, SyncConflict] = {}
        self._load()

    def _load(self) -> None:
        if not self.store_path.exists():
            return
        try:
            raw = json.loads(self.store_path.read_text(encoding="utf-8"))
            for item in raw:
                conflict = SyncConflict(**item)
                self._conflicts[conflict.id] = conflict
        except Exception:
            logger.exception("Failed to load conflict store, starting empty")
            self._conflicts = {}

    def _save(self) -> None:
        data = [c.model_dump(mode="json") for c in self._conflicts.values()]
        self.store_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    def add(
        self,
        file_path: str,
        conflict_type: ConflictType,
        *,
        local_updated_at: datetime | None = None,
        remote_updated_at: datetime | None = None,
        local_title: str | None = None,
        remote_title: str | None = None,
        local_preview: str | None = None,
        remote_preview: str | None = None,
    ) -> SyncConflict:
        conflict = SyncConflict(
            id=str(uuid4()),
            file_path=file_path,
            conflict_type=conflict_type,
            local_updated_at=local_updated_at,
            remote_updated_at=remote_updated_at,
            local_title=local_title,
            remote_title=remote_title,
            local_preview=local_preview,
            remote_preview=remote_preview,
        )
        self._conflicts[conflict.id] = conflict
        self._save()
        logger.info("Conflict added: %s (%s)", conflict.id, file_path)
        return conflict

    def list_all(self) -> list[SyncConflict]:
        return list(self._conflicts.values())

    def get(self, conflict_id: str) -> SyncConflict | None:
        return self._conflicts.get(conflict_id)

    def resolve(self, conflict_id: str) -> bool:
        """Remove a conflict (after the caller has applied the resolution)."""
        if conflict_id in self._conflicts:
            del self._conflicts[conflict_id]
            self._save()
            logger.info("Conflict resolved: %s", conflict_id)
            return True
        return False

    def clear_all(self) -> int:
        count = len(self._conflicts)
        self._conflicts.clear()
        self._save()
        return count

    @property
    def count(self) -> int:
        return len(self._conflicts)
