"""
File watcher (`backend/app/sync/file_watcher.py`).

Purpose:
- Uses `watchdog` to monitor DATA_DIR for external file changes.
- When a .md or meta.json file is created/modified/deleted, triggers
  reverse sync (file → DB) via FileToDbSyncer.
- Debounces rapid changes (500ms per file) to avoid double-processing.
- Skips changes that originated from the API (self-write suppression).
"""

import logging
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from app.storage import get_file_storage
from app.sync.cloud_detector import CloudConflictDetector
from app.sync.conflict_store import ConflictStore
from app.sync.file_to_db import FileToDbSyncer

logger = logging.getLogger(__name__)

# Debounce window in seconds
_DEBOUNCE_SECS = 0.5


class _LeafFileHandler(FileSystemEventHandler):
    """Handles filesystem events for .md and .json files in DATA_DIR."""

    def __init__(
        self,
        syncer: FileToDbSyncer,
        conflict_store: ConflictStore,
        cloud_detector: CloudConflictDetector,
    ):
        super().__init__()
        self._syncer = syncer
        self._conflict_store = conflict_store
        self._cloud_detector = cloud_detector
        self._pending: dict[str, float] = {}
        self._lock = threading.Lock()
        self._timer: threading.Timer | None = None

    def _is_relevant(self, path: str) -> bool:
        """Only process .md files and meta.json."""
        p = Path(path)
        if p.suffix == ".md":
            return True
        if p.name == "meta.json":
            return True
        return False

    def _should_skip(self, path: str) -> bool:
        """Skip files recently written by our own API."""
        storage = get_file_storage()
        return storage.was_recently_written(path)

    def on_created(self, event: FileSystemEvent) -> None:
        if not event.is_directory and self._is_relevant(event.src_path):
            self._schedule(event.src_path, "created")

    def on_modified(self, event: FileSystemEvent) -> None:
        if not event.is_directory and self._is_relevant(event.src_path):
            self._schedule(event.src_path, "modified")

    def on_deleted(self, event: FileSystemEvent) -> None:
        if not event.is_directory and self._is_relevant(event.src_path):
            self._schedule(event.src_path, "deleted")

    def _schedule(self, path: str, event_type: str) -> None:
        """Debounce: record the event and schedule processing after the window."""
        with self._lock:
            self._pending[path] = time.monotonic()
            # Tag deleted events so we handle them differently
            if event_type == "deleted":
                self._pending[f"__deleted__{path}"] = time.monotonic()

        # Reset debounce timer
        if self._timer is not None:
            self._timer.cancel()
        self._timer = threading.Timer(_DEBOUNCE_SECS, self._flush)
        self._timer.daemon = True
        self._timer.start()

    def _flush(self) -> None:
        """Process all pending file events after debounce window."""
        with self._lock:
            pending = dict(self._pending)
            self._pending.clear()

        deleted_keys = {k for k in pending if k.startswith("__deleted__")}
        deleted_paths = {k.replace("__deleted__", "") for k in deleted_keys}

        for path_str in pending:
            if path_str.startswith("__deleted__"):
                continue

            path = Path(path_str)

            if self._should_skip(path_str):
                logger.debug("Skipping self-written file: %s", path)
                continue

            try:
                if path_str in deleted_paths:
                    if path.suffix == ".md":
                        self._syncer.handle_file_deleted(path)
                        logger.info("Processed external delete: %s", path)
                elif path.suffix == ".md":
                    updated = self._syncer.sync_file(path)
                    if updated:
                        logger.info("Processed external change: %s", path)

                    # Check for cloud conflict copies in the same directory
                    conflicts = self._cloud_detector.scan_directory(path.parent)
                    for c in conflicts:
                        self._conflict_store.add(**c)

            except Exception:
                logger.exception("Error processing file event: %s", path)


class FileWatcherService:
    """Manages the watchdog Observer lifecycle."""

    def __init__(
        self,
        data_dir: str,
        syncer: FileToDbSyncer,
        conflict_store: ConflictStore,
        cloud_detector: CloudConflictDetector,
    ):
        self._data_dir = data_dir
        self._handler = _LeafFileHandler(syncer, conflict_store, cloud_detector)
        self._observer: Observer | None = None

    def start(self) -> None:
        """Start watching DATA_DIR recursively."""
        if self._observer is not None:
            return

        self._observer = Observer()
        self._observer.schedule(self._handler, self._data_dir, recursive=True)
        self._observer.daemon = True
        self._observer.start()
        logger.info("File watcher started on %s", self._data_dir)

    def stop(self) -> None:
        """Stop the watcher gracefully."""
        if self._observer is None:
            return

        self._observer.stop()
        self._observer.join(timeout=5)
        self._observer = None
        logger.info("File watcher stopped")

    @property
    def is_running(self) -> bool:
        return self._observer is not None and self._observer.is_alive()
