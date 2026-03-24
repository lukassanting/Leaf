"""
Sync scheduler (`backend/app/sync/scheduler.py`).

Purpose:
- Runs a periodic background task that triggers git sync on a configurable interval.
- Uses asyncio.create_task for non-blocking scheduling within the FastAPI event loop.
- Respects config changes: the interval can be updated at runtime.
"""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class SyncScheduler:
    """Periodic background sync scheduler."""

    def __init__(self, sync_fn, interval_fn, file_syncer=None, manifest=None):
        """
        Args:
            sync_fn:      Callable that runs one sync cycle (e.g. git_sync.sync_now).
            interval_fn:  Callable that returns the current interval in seconds.
            file_syncer:  Optional FileToDbSyncer for post-pull DB reconciliation.
            manifest:     Optional SyncManifest to update after sync.
        """
        self._sync_fn = sync_fn
        self._interval_fn = interval_fn
        self._file_syncer = file_syncer
        self._manifest = manifest
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Start the periodic sync loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Sync scheduler started (interval: %ds)", self._interval_fn())

    async def stop(self) -> None:
        """Stop the scheduler gracefully."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Sync scheduler stopped")

    @property
    def is_running(self) -> bool:
        return self._running

    async def _loop(self) -> None:
        """The main scheduling loop."""
        while self._running:
            interval = self._interval_fn()
            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break

            if not self._running:
                break

            try:
                logger.info("Scheduled sync cycle starting…")
                # Run the sync function in a thread to avoid blocking the event loop
                loop = asyncio.get_running_loop()
                stats = await loop.run_in_executor(None, self._sync_fn)
                logger.info("Scheduled sync cycle complete: %s", stats)

                # After a git pull, reconcile files → DB
                if stats.get("pulled") and self._file_syncer:
                    await loop.run_in_executor(None, self._file_syncer.sync_all)
                    if self._manifest:
                        self._manifest.update()
                    logger.info("Post-pull DB reconciliation complete")

            except Exception:
                logger.exception("Scheduled sync cycle failed")
