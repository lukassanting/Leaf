"""
Git sync engine (`backend/app/sync/git_sync.py`).

Purpose:
- Manages a git repository inside DATA_DIR for cross-device sync.
- Provides auto-commit, pull (rebase), and push operations.
- Handles authentication via PAT tokens embedded in remote URLs.
- Detects and surfaces merge conflicts via the conflict store.

Sync cycle (one call to `sync_now()`):
  1. Stage all changes:  git add -A
  2. Commit if dirty:    git commit -m "Auto-sync from {hostname} at {timestamp}"
  3. Pull with rebase:   git pull --rebase origin main
     - On conflict: abort rebase, record conflicts, return error
  4. Push:               git push origin main
"""

import logging
import os
import re
import socket
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.dtos.sync_dtos import ConflictType

logger = logging.getLogger(__name__)


class GitSyncError(Exception):
    """Raised when a git sync operation fails."""
    pass


class GitSyncService:
    """Manages git operations for DATA_DIR sync."""

    def __init__(
        self,
        data_dir: str,
        remote_url: str = "",
        auth_token: str = "",
        branch: str = "main",
    ):
        self.data_dir = Path(data_dir)
        self._remote_url = remote_url
        self._auth_token = auth_token
        self._branch = branch
        self._hostname = socket.gethostname()

        # Track state
        self.last_sync_at: Optional[datetime] = None
        self.last_error: Optional[str] = None
        self._is_syncing = False

    @property
    def is_syncing(self) -> bool:
        return self._is_syncing

    @property
    def is_configured(self) -> bool:
        return bool(self._remote_url)

    @property
    def is_initialized(self) -> bool:
        return (self.data_dir / ".git").is_dir()

    # ─── Public API ─────────────────────────────────────────────────────────

    def initialize(self) -> bool:
        """
        Initialize git repo in DATA_DIR if needed.
        Sets up remote, .gitignore, and initial commit.
        Returns True if initialization happened, False if already initialized.
        """
        if self.is_initialized:
            self._ensure_remote()
            self._ensure_gitignore()
            return False

        logger.info("Initializing git repo in %s", self.data_dir)
        self._run_git("init")
        self._run_git("checkout", "-b", self._branch)
        self._ensure_gitignore()
        self._ensure_remote()

        # Initial commit
        self._run_git("add", "-A")
        if self._has_staged_changes():
            self._run_git("commit", "-m", "Initial Leaf data snapshot")

        return True

    def sync_now(self) -> dict:
        """
        Run one full sync cycle: stage → commit → pull → push.
        Returns a stats dict: {committed, pulled, pushed, conflicts, error}.
        """
        if self._is_syncing:
            return {"error": "Sync already in progress"}

        if not self.is_configured:
            return {"error": "Git remote URL not configured"}

        self._is_syncing = True
        self.last_error = None
        stats = {"committed": False, "pulled": False, "pushed": False, "conflicts": 0, "error": None}

        try:
            # Ensure repo is initialized
            self.initialize()

            # 1. Stage all changes
            self._run_git("add", "-A")

            # 2. Commit if there are staged changes
            if self._has_staged_changes():
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                msg = f"Auto-sync from {self._hostname} at {timestamp}"
                self._run_git("commit", "-m", msg)
                stats["committed"] = True
                logger.info("Committed local changes")

            # 3. Pull with rebase (fetch + rebase)
            try:
                self._run_git("fetch", "origin", self._branch)
                # Check if remote has new commits
                local_ref = self._run_git("rev-parse", "HEAD").strip()
                try:
                    remote_ref = self._run_git("rev-parse", f"origin/{self._branch}").strip()
                except GitSyncError:
                    # Remote branch doesn't exist yet (first push)
                    remote_ref = None

                if remote_ref and local_ref != remote_ref:
                    try:
                        self._run_git("rebase", f"origin/{self._branch}")
                        stats["pulled"] = True
                        logger.info("Rebased onto remote changes")
                    except GitSyncError as e:
                        # Rebase conflict
                        conflict_files = self._get_conflict_files()
                        stats["conflicts"] = len(conflict_files)
                        self._run_git("rebase", "--abort")
                        # Fall back to merge
                        try:
                            self._run_git("merge", f"origin/{self._branch}", "--no-edit")
                            stats["pulled"] = True
                        except GitSyncError:
                            self._run_git("merge", "--abort")
                            stats["error"] = f"Merge conflict in {len(conflict_files)} file(s)"
                            self.last_error = stats["error"]
                            logger.warning("Git merge conflict: %s", conflict_files)
                            return stats

            except GitSyncError as e:
                if "couldn't find remote ref" not in str(e).lower():
                    logger.warning("Git fetch failed: %s", e)

            # 4. Push
            try:
                self._run_git("push", "-u", "origin", self._branch)
                stats["pushed"] = True
                logger.info("Pushed to remote")
            except GitSyncError as e:
                error_msg = str(e)
                if "non-fast-forward" in error_msg.lower() or "rejected" in error_msg.lower():
                    stats["error"] = "Push rejected — remote has diverged. Try pulling first."
                else:
                    stats["error"] = f"Push failed: {error_msg}"
                self.last_error = stats["error"]

            self.last_sync_at = datetime.now()

        except GitSyncError as e:
            stats["error"] = str(e)
            self.last_error = str(e)
            logger.exception("Git sync failed")
        finally:
            self._is_syncing = False

        return stats

    def get_status(self) -> dict:
        """Return current git sync status."""
        status = {
            "initialized": self.is_initialized,
            "configured": self.is_configured,
            "syncing": self._is_syncing,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "last_error": self.last_error,
            "remote_url": self._sanitize_url(self._remote_url),
            "branch": self._branch,
        }

        if self.is_initialized:
            try:
                status["last_commit"] = self._run_git(
                    "log", "-1", "--format=%H %s", "--no-color"
                ).strip()
                status["has_uncommitted"] = self._has_uncommitted_changes()
            except GitSyncError:
                status["last_commit"] = None
                status["has_uncommitted"] = False

        return status

    def test_connection(self) -> dict:
        """Test the remote connection. Returns {ok, message}."""
        if not self.is_configured:
            return {"ok": False, "message": "Git remote URL not configured"}

        try:
            authed_url = self._authenticated_url()
            result = subprocess.run(
                ["git", "ls-remote", "--heads", authed_url],
                cwd=str(self.data_dir),
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode == 0:
                return {"ok": True, "message": "Connection successful"}
            return {"ok": False, "message": result.stderr.strip() or "Connection failed"}
        except subprocess.TimeoutExpired:
            return {"ok": False, "message": "Connection timed out (15s)"}
        except FileNotFoundError:
            return {"ok": False, "message": "git is not installed or not in PATH"}

    def update_config(self, remote_url: str = "", auth_token: str = "") -> None:
        """Update remote URL and token at runtime."""
        if remote_url:
            self._remote_url = remote_url
        if auth_token:
            self._auth_token = auth_token
        if self.is_initialized:
            self._ensure_remote()

    # ─── Internal helpers ───────────────────────────────────────────────────

    def _run_git(self, *args: str) -> str:
        """Run a git command in DATA_DIR. Raises GitSyncError on failure."""
        cmd = ["git"] + list(args)
        try:
            result = subprocess.run(
                cmd,
                cwd=str(self.data_dir),
                capture_output=True,
                text=True,
                timeout=60,
                env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
            )
            if result.returncode != 0:
                stderr = result.stderr.strip()
                raise GitSyncError(f"git {' '.join(args)} failed: {stderr}")
            return result.stdout
        except subprocess.TimeoutExpired:
            raise GitSyncError(f"git {' '.join(args)} timed out")
        except FileNotFoundError:
            raise GitSyncError("git is not installed or not in PATH")

    def _authenticated_url(self) -> str:
        """Embed PAT token into HTTPS remote URL for authentication."""
        url = self._remote_url
        if not self._auth_token or not url:
            return url

        # Only embed token in HTTPS URLs
        if url.startswith("https://"):
            # https://github.com/user/repo.git → https://TOKEN@github.com/user/repo.git
            return re.sub(r"^https://", f"https://{self._auth_token}@", url)

        return url

    def _sanitize_url(self, url: str) -> str:
        """Remove embedded credentials from URL for display."""
        if not url:
            return url
        return re.sub(r"https://[^@]+@", "https://", url)

    def _ensure_remote(self) -> None:
        """Set or update the 'origin' remote."""
        if not self._remote_url:
            return

        authed_url = self._authenticated_url()
        try:
            current = self._run_git("remote", "get-url", "origin").strip()
            if current != authed_url:
                self._run_git("remote", "set-url", "origin", authed_url)
        except GitSyncError:
            self._run_git("remote", "add", "origin", authed_url)

    def _ensure_gitignore(self) -> None:
        """Create .gitignore to exclude SQLite files and sync metadata."""
        gitignore_path = self.data_dir / ".gitignore"
        entries = [
            ".leaf.db",
            ".leaf.db-wal",
            ".leaf.db-shm",
            ".leaf.db-journal",
            ".sync-manifest.json",
            ".sync-conflicts.json",
            ".sync-config.json",
        ]
        desired = "\n".join(entries) + "\n"

        if gitignore_path.exists():
            current = gitignore_path.read_text(encoding="utf-8")
            # Add any missing entries
            missing = [e for e in entries if e not in current]
            if missing:
                updated = current.rstrip("\n") + "\n" + "\n".join(missing) + "\n"
                gitignore_path.write_text(updated, encoding="utf-8")
        else:
            gitignore_path.write_text(desired, encoding="utf-8")

    def _has_staged_changes(self) -> bool:
        """Check if there are staged changes to commit."""
        try:
            output = self._run_git("diff", "--cached", "--quiet")
            return False  # exit code 0 means no changes
        except GitSyncError:
            return True  # exit code 1 means changes exist

    def _has_uncommitted_changes(self) -> bool:
        """Check if there are uncommitted changes (staged or unstaged)."""
        try:
            output = self._run_git("status", "--porcelain")
            return bool(output.strip())
        except GitSyncError:
            return False

    def _get_conflict_files(self) -> list[str]:
        """Get list of files with merge/rebase conflicts."""
        try:
            output = self._run_git("diff", "--name-only", "--diff-filter=U")
            return [f.strip() for f in output.strip().split("\n") if f.strip()]
        except GitSyncError:
            return []
