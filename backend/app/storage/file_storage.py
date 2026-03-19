"""
File storage layer (`backend/app/storage/file_storage.py`).

Purpose:
- Implements the Leaf “hybrid storage” approach:
  - Source of truth: human-readable Markdown files with YAML frontmatter
  - Fast index: SQLite index (`.leaf.db`) for query/search/navigation

How to read:
- The public surface is the `FileStorage` class.
- The `.md` structure is:
  - `pages/{uuid}.md` for leaf pages
  - `databases/{uuid}/meta.json` for database metadata
  - `databases/{uuid}/rows/{uuid}.md` for database rows
- `_html_to_md()` + `_LeafMdConverter` show how HTML-ish editor output is converted into wiki-style links.

Update:
- When changing the snapshot format, update:
  - `write_page()` (frontmatter keys + body writing)
  - `write_database()` and row writing behavior
  - `_parse_md()` / rebuild helpers (`read_all_pages`, `read_all_databases`)
- Keep reserved CRDT fields stable if you plan a future CRDT upgrade (see the existing diagram in this docstring).

Debug:
- If rebuild-index misses documents, inspect:
  - `_parse_md()` (expects YAML frontmatter wrapped in `--- ... ---`)
  - whether files exist in `pages_dir` or `databases_dir`
- If storage sync is “one-way”, confirm operations call `FileStorage.write_*` methods after DB commits.

Legacy note:
The large architecture diagram below is kept because it documents rebuild/sync expectations.

─────────────────────────────────────────────────────────────────────────────

File storage layer — Leaf hybrid architecture.

┌─────────────────────────────────────────────────────────────────────────────┐
│  SOURCE OF TRUTH: .md files with YAML frontmatter                          │
│  FAST INDEX:      SQLite (.leaf.db) — derived, rebuild-able at any time    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Write path: API → SQLite (immediate, <1 ms) → .md file (immediate, local) │
│  Read path:  Always SQLite. Files used for rebuild / sync / AI.             │
│  Rebuild:    POST /admin/rebuild-index scans files → repopulates SQLite.   │
└─────────────────────────────────────────────────────────────────────────────┘

Directory layout (DATA_DIR):
  pages/
    {uuid}.md          ← page: YAML frontmatter + Markdown body
  databases/
    {uuid}/
      meta.json        ← database: title, schema, view_type, parent_leaf_id
      rows/
        {uuid}.md      ← row page: YAML frontmatter + Markdown body
  .leaf.db             ← SQLite index (auto-created, safe to delete → rebuild)

──────────────────────────────────────────────────────────────────────────────
CRDT UPGRADE PATH (future — no data loss, no migration required)
──────────────────────────────────────────────────────────────────────────────
When adding CRDT support (Yjs / Automerge) for multi-device sync:

  1. Add  data/ops/{uuid}.jsonl  — append-only operation log per document.
     Each line is one op: { clock, site_id, op_type, payload }.

  2. .md files become *snapshots* generated from the CRDT state.
     They remain human- and AI-readable; AIs can still `find . -name "*.md"`.

  3. SQLite index is rebuilt from CRDT state (not from .md snapshots).

  4. Sync = exchange op logs. No full-file transfers. Last-write-wins per op.

  5. Existing .md files at migration time become "initial snapshots" with a
     single synthetic op (op_type: "init", payload: full content).
     No data is lost or converted; the format just grows a new ops/ sibling.

Reserved frontmatter fields (currently null, used by CRDT future):
  crdt_checkpoint_id:  null   ← ID of the ops log entry this snapshot was
                               generated from. null = file IS the source.
  crdt_site_id:        null   ← device/site that wrote this snapshot.
──────────────────────────────────────────────────────────────────────────────
"""

"""
File storage layer — Leaf hybrid architecture.

┌─────────────────────────────────────────────────────────────────────────────┐
│  SOURCE OF TRUTH: .md files with YAML frontmatter                          │
│  FAST INDEX:      SQLite (.leaf.db) — derived, rebuild-able at any time    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Write path: API → SQLite (immediate, <1 ms) → .md file (immediate, local) │
│  Read path:  Always SQLite. Files used for rebuild / sync / AI.             │
│  Rebuild:    POST /admin/rebuild-index scans files → repopulates SQLite.   │
└─────────────────────────────────────────────────────────────────────────────┘

Directory layout (DATA_DIR):
  pages/
    {uuid}.md          ← page: YAML frontmatter + Markdown body
  databases/
    {uuid}/
      meta.json        ← database: title, schema, view_type, parent_leaf_id
      rows/
        {uuid}.md      ← row page: YAML frontmatter + Markdown body
  .leaf.db             ← SQLite index (auto-created, safe to delete → rebuild)

──────────────────────────────────────────────────────────────────────────────
CRDT UPGRADE PATH (future — no data loss, no migration required)
──────────────────────────────────────────────────────────────────────────────
When adding CRDT support (Yjs / Automerge) for multi-device sync:

  1. Add  data/ops/{uuid}.jsonl  — append-only operation log per document.
     Each line is one op: { clock, site_id, op_type, payload }.

  2. .md files become *snapshots* generated from the CRDT state.
     They remain human- and AI-readable; AIs can still `find . -name "*.md"`.

  3. SQLite index is rebuilt from CRDT state (not from .md snapshots).

  4. Sync = exchange op logs. No full-file transfers. Last-write-wins per op.

  5. Existing .md files at migration time become "initial snapshots" with a
     single synthetic op (op_type: "init", payload: full content).
     No data is lost or converted; the format just grows a new ops/ sibling.

Reserved frontmatter fields (currently null, used by CRDT future):
  crdt_checkpoint_id:  null   ← ID of the ops log entry this snapshot was
                               generated from. null = file IS the source.
  crdt_site_id:        null   ← device/site that wrote this snapshot.
──────────────────────────────────────────────────────────────────────────────
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml
import markdownify as _md


# ─── HTML → Markdown conversion ──────────────────────────────────────────────

class _LeafMdConverter(_md.MarkdownConverter):
    """Custom converter: turns page-card blocks into wiki-style links."""

    def convert_div(self, el, text, convert_as_inline):
        if el.attrs.get("data-type") == "page-card":
            kind = el.attrs.get("data-kind", "page")
            title = el.attrs.get("data-title", "Untitled")
            pid = el.attrs.get("data-id", "")
            path = f"/databases/{pid}" if kind == "database" else f"/editor/{pid}"
            icon = "⊞" if kind == "database" else "📄"
            return f"\n{icon} [[{title}]]({path})\n"
        return super().convert_div(el, text, convert_as_inline)


def _html_to_md(html: str) -> str:
    if not html or html.strip() in ("", "<p></p>"):
        return ""
    return _LeafMdConverter(
        heading_style="ATX",
        strip=["script", "style"],
    ).convert(html).strip()


# ─── File storage ─────────────────────────────────────────────────────────────

class FileStorage:
    def __init__(self, data_dir: str):
        self.root = Path(data_dir)
        self.pages_dir = self.root / "pages"
        self.databases_dir = self.root / "databases"
        self.pages_dir.mkdir(parents=True, exist_ok=True)
        self.databases_dir.mkdir(parents=True, exist_ok=True)

    # ─── Pages ────────────────────────────────────────────────────────────────

    def write_page(
        self,
        *,
        leaf_id: str,
        title: str,
        content_html: Optional[str],
        parent_id: Optional[str],
        children_ids: list,
        tags: list,
        order: int,
        database_id: Optional[str],
        created_at: datetime,
        updated_at: datetime,
    ) -> None:
        fm = {
            "id": leaf_id,
            "title": title,
            "parent_id": parent_id,
            "children_ids": list(children_ids or []),
            "tags": list(tags or []),
            "order": order,
            "database_id": database_id,
            "created_at": _iso(created_at),
            "updated_at": _iso(updated_at),
            # Reserved for CRDT upgrade — do not remove these keys:
            "crdt_checkpoint_id": None,
            "crdt_site_id": None,
        }
        body = _html_to_md(content_html or "")
        text = f"---\n{yaml.dump(fm, default_flow_style=False, allow_unicode=True, sort_keys=False)}---\n\n{body}\n"
        self._page_path(leaf_id, database_id).write_text(text, encoding="utf-8")

    def delete_page(self, leaf_id: str, database_id: Optional[str] = None) -> None:
        p = self._page_path(leaf_id, database_id)
        if p.exists():
            p.unlink()

    # ─── Databases ────────────────────────────────────────────────────────────

    def write_database(
        self,
        *,
        db_id: str,
        title: str,
        schema: dict,
        view_type: str,
        parent_leaf_id: Optional[str],
        created_at: datetime,
        updated_at: datetime,
    ) -> None:
        db_dir = self.databases_dir / db_id
        db_dir.mkdir(parents=True, exist_ok=True)
        meta = {
            "id": db_id,
            "title": title,
            "schema": schema,
            "view_type": view_type,
            "parent_leaf_id": parent_leaf_id,
            "created_at": _iso(created_at),
            "updated_at": _iso(updated_at),
            # Reserved for CRDT upgrade:
            "crdt_checkpoint_id": None,
            "crdt_site_id": None,
        }
        (db_dir / "meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def delete_database(self, db_id: str) -> None:
        db_dir = self.databases_dir / db_id
        if db_dir.exists():
            shutil.rmtree(db_dir)

    # ─── Rebuild helpers ──────────────────────────────────────────────────────

    def read_all_pages(self) -> list[dict]:
        """Scan all .md files. Used by rebuild-index."""
        results = []
        for f in self.pages_dir.glob("*.md"):
            p = _parse_md(f)
            if p:
                results.append(p)
        for db_dir in self.databases_dir.iterdir():
            if db_dir.is_dir():
                rows_dir = db_dir / "rows"
                if rows_dir.exists():
                    for f in rows_dir.glob("*.md"):
                        p = _parse_md(f)
                        if p:
                            results.append(p)
        return results

    def read_all_databases(self) -> list[dict]:
        """Scan all meta.json files. Used by rebuild-index."""
        results = []
        for db_dir in self.databases_dir.iterdir():
            meta_file = db_dir / "meta.json"
            if meta_file.exists():
                try:
                    results.append(json.loads(meta_file.read_text(encoding="utf-8")))
                except Exception:
                    pass
        return results

    # ─── Internal ─────────────────────────────────────────────────────────────

    def _page_path(self, leaf_id: str, database_id: Optional[str]) -> Path:
        if database_id:
            rows_dir = self.databases_dir / database_id / "rows"
            rows_dir.mkdir(parents=True, exist_ok=True)
            return rows_dir / f"{leaf_id}.md"
        return self.pages_dir / f"{leaf_id}.md"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _iso(dt) -> str:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt) if dt else ""


def _parse_md(path: Path) -> Optional[dict]:
    try:
        text = path.read_text(encoding="utf-8")
        if not text.startswith("---"):
            return None
        parts = text.split("---", 2)
        if len(parts) < 3:
            return None
        meta = yaml.safe_load(parts[1]) or {}
        meta["content_md"] = parts[2].strip()
        return meta
    except Exception:
        return None
