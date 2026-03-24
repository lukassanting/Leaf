"""
Sync package (`backend/app/sync`).

Purpose:
- Implements bidirectional file sync for Leaf's hybrid storage model.
- Watches DATA_DIR for external file changes (e.g. cloud sync folders)
  and updates the SQLite index accordingly.
- Provides conflict detection and resolution for cloud-synced files.

Modules:
- file_to_db.py:      Reverse sync — parse .md files → upsert into SQLite
- manifest.py:        File hash manifest for efficient change detection
- conflict_store.py:  Persisted conflict tracking and resolution
- file_watcher.py:    watchdog-based live file change detection
"""
