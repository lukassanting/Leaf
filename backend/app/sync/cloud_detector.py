"""
Cloud conflict detector (`backend/app/sync/cloud_detector.py`).

Purpose:
- Detects "conflict copy" files created by cloud sync services
  (Google Drive, Dropbox, OneDrive) when two devices edit the same file.
- Returns structured info so the conflict store can surface them to the user.

Naming patterns:
- Google Drive:  "filename (1).md", "filename (2).md"
- Dropbox:       "filename (conflicted copy YYYY-MM-DD).md",
                 "filename (SomeHost's conflicted copy YYYY-MM-DD).md"
- OneDrive:      "filename (1).md", "filename-HOSTNAME.md"
"""

import logging
import re
from datetime import datetime
from pathlib import Path

from app.dtos.sync_dtos import ConflictType

logger = logging.getLogger(__name__)

# Patterns that indicate a cloud-conflict copy (applied to the file stem)
_CONFLICT_PATTERNS = [
    # Google Drive / OneDrive numbered copies: "name (1)", "name (2)"
    re.compile(r"^(.+?)\s*\((\d+)\)$"),
    # Dropbox conflict copies
    re.compile(r"^(.+?)\s*\(.*conflicted copy.*\)$", re.IGNORECASE),
    # Dropbox with date
    re.compile(r"^(.+?)\s*\(.*conflict.*\d{4}-\d{2}-\d{2}.*\)$", re.IGNORECASE),
]


class CloudConflictDetector:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)

    def scan_directory(self, directory: Path) -> list[dict]:
        """
        Scan a directory for cloud conflict copies.
        Returns a list of kwargs dicts ready for ConflictStore.add().
        """
        if not directory.exists():
            return []

        results: list[dict] = []
        md_files = list(directory.glob("*.md"))

        for path in md_files:
            match = self._is_conflict_copy(path)
            if match is None:
                continue

            original_stem, _ = match
            # Find the original file
            original = directory / f"{original_stem}.md"

            local_preview = None
            remote_preview = None
            local_mtime = None
            remote_mtime = None

            if original.exists():
                try:
                    local_preview = original.read_text(encoding="utf-8")[:200]
                    local_mtime = datetime.fromtimestamp(original.stat().st_mtime)
                except OSError:
                    pass

            try:
                remote_preview = path.read_text(encoding="utf-8")[:200]
                remote_mtime = datetime.fromtimestamp(path.stat().st_mtime)
            except OSError:
                pass

            rel_path = str(path.relative_to(self.data_dir)) if self._is_under_data_dir(path) else str(path)

            results.append({
                "file_path": rel_path,
                "conflict_type": ConflictType.CLOUD_DUPLICATE,
                "local_updated_at": local_mtime,
                "remote_updated_at": remote_mtime,
                "local_title": original_stem,
                "remote_title": path.stem,
                "local_preview": local_preview,
                "remote_preview": remote_preview,
            })

        return results

    def scan_all(self) -> list[dict]:
        """Scan the entire DATA_DIR tree for conflict copies."""
        results: list[dict] = []
        pages_dir = self.data_dir / "pages"
        if pages_dir.exists():
            results.extend(self.scan_directory(pages_dir))

        databases_dir = self.data_dir / "databases"
        if databases_dir.exists():
            for db_dir in databases_dir.iterdir():
                rows_dir = db_dir / "rows"
                if rows_dir.exists():
                    results.extend(self.scan_directory(rows_dir))

        return results

    def _is_conflict_copy(self, path: Path) -> tuple[str, str] | None:
        """
        Check if a file looks like a cloud-created conflict copy.
        Returns (original_stem, conflict_label) or None.
        """
        stem = path.stem
        for pattern in _CONFLICT_PATTERNS:
            m = pattern.match(stem)
            if m:
                original_stem = m.group(1).strip()
                label = m.group(0)
                # Sanity check: the original stem should look like a UUID
                # (our files are {uuid}.md). Skip if it doesn't.
                if len(original_stem) >= 30:  # UUIDs with hyphens are 36 chars
                    return original_stem, label
        return None

    def _is_under_data_dir(self, path: Path) -> bool:
        try:
            path.relative_to(self.data_dir)
            return True
        except ValueError:
            return False
