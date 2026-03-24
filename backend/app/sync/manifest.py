"""
Sync manifest (`backend/app/sync/manifest.py`).

Purpose:
- Maintains a JSON manifest of file hashes + mtimes in DATA_DIR/.sync-manifest.json.
- Used for efficient change detection: compare current files against last-known
  state without reading every file's content on each cycle.

How it works:
- `compute_current()`: scan all .md and .json files, compute SHA-256 hashes
- `compute_diff()`:    compare current state against saved manifest
- `save()` / `load()`: persist and restore the manifest
"""

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

logger = logging.getLogger(__name__)


class FileDiff(NamedTuple):
    added: list[str]      # paths relative to data_dir
    modified: list[str]
    deleted: list[str]


class SyncManifest:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.manifest_path = self.data_dir / ".sync-manifest.json"
        self._entries: dict[str, dict] = {}
        self.last_sync: str | None = None

    def load(self) -> None:
        """Load the manifest from disk. No-op if file doesn't exist."""
        if not self.manifest_path.exists():
            self._entries = {}
            self.last_sync = None
            return
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            self._entries = data.get("files", {})
            self.last_sync = data.get("last_sync")
        except Exception:
            logger.exception("Failed to load sync manifest, starting fresh")
            self._entries = {}
            self.last_sync = None

    def save(self) -> None:
        """Persist the current manifest to disk."""
        data = {
            "version": 1,
            "last_sync": datetime.now().isoformat(),
            "files": self._entries,
        }
        self.manifest_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def compute_current(self) -> dict[str, dict]:
        """
        Scan DATA_DIR for all .md and meta.json files.
        Returns {relative_path: {"sha256": ..., "size": ..., "mtime": ...}}.
        """
        current: dict[str, dict] = {}
        patterns = ["pages/*.md", "databases/*/meta.json", "databases/*/rows/*.md"]

        for pattern in patterns:
            for path in self.data_dir.glob(pattern):
                if not path.is_file():
                    continue
                rel = path.relative_to(self.data_dir).as_posix()
                try:
                    stat = path.stat()
                    content = path.read_bytes()
                    current[rel] = {
                        "sha256": hashlib.sha256(content).hexdigest(),
                        "size": stat.st_size,
                        "mtime": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    }
                except OSError:
                    logger.warning("Could not stat %s", path)

        return current

    def compute_diff(self) -> FileDiff:
        """
        Compare current filesystem state against stored manifest.
        Returns added, modified, and deleted file paths (relative).
        """
        current = self.compute_current()
        old = self._entries

        added = [p for p in current if p not in old]
        deleted = [p for p in old if p not in current]
        modified = [
            p for p in current
            if p in old and current[p]["sha256"] != old[p].get("sha256")
        ]

        return FileDiff(added=added, modified=modified, deleted=deleted)

    def update(self) -> FileDiff:
        """
        Compute diff, then update the stored manifest to match current state.
        Returns the diff that was computed.
        """
        diff = self.compute_diff()
        self._entries = self.compute_current()
        self.save()
        return diff

    @property
    def is_empty(self) -> bool:
        return not self._entries
