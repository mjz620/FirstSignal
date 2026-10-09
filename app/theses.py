"""Thesis store: one `theses` table per firm store (see memory/db.firm_scope).

Theses used to be YAML files in config/; the built-ins still live there and are
imported into a firm's table on first use (demo firm: every config/thesis_*.yaml,
new firms: the default lens only). Results keep keying on the thesis *name*
(axis_scores.thesis, memos.thesis, kill_log.thesis) — renaming a thesis orphans its
scores, exactly as it did when the file was renamed.
"""
import json
import re
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

from . import config
from .screening.thesis import Thesis

CONFIG_DIR = config.ROOT / "config"
DEFAULT_SLUG = "preseed_ai_infra"
_SLUG_RE = re.compile(r"^[a-z][a-z0-9_]{0,60}$")


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "custom"
    return s if s[0].isalpha() else f"t_{s}"


def check_slug(slug: str) -> str:
    if not _SLUG_RE.match(slug or ""):
        raise ValueError(f"invalid thesis slug: {slug!r}")
    return slug


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_theses(conn) -> list[dict]:
    rows = conn.execute("SELECT slug, config FROM theses ORDER BY slug").fetchall()
    return [{"slug": r["slug"], **json.loads(r["config"])} for r in rows]


def get(conn, slug: str) -> Thesis | None:
    row = conn.execute("SELECT config FROM theses WHERE slug=?",
                       (check_slug(slug),)).fetchone()
    return Thesis(**json.loads(row["config"])) if row else None


def save(conn, cfg: dict, replaces: str | None = None) -> str:
    """Upsert by slug-of-name. `replaces` (old slug) is removed when a rename moves it."""
    t = Thesis(**cfg)
    slug = slugify(t.name)
    conn.execute("INSERT OR REPLACE INTO theses (slug, name, config, updated_at) "
                 "VALUES (?,?,?,?)", (slug, t.name, json.dumps(asdict(t)), _now()))
    if replaces and check_slug(replaces) != slug:
        conn.execute("DELETE FROM theses WHERE slug=?", (replaces,))
    conn.commit()
    return slug


def delete(conn, slug: str) -> str:
    """Delete one thesis; returns the next slug to select. The engine always needs
    a lens, so the last one can't go (ValueError)."""
    check_slug(slug)
    if not conn.execute("SELECT 1 FROM theses WHERE slug=?", (slug,)).fetchone():
        raise LookupError("thesis not found")
    remaining = [r["slug"] for r in conn.execute(
        "SELECT slug FROM theses WHERE slug<>? ORDER BY slug", (slug,)).fetchall()]
    if not remaining:
        raise ValueError("cannot delete the last thesis — the engine needs a lens")
    conn.execute("DELETE FROM theses WHERE slug=?", (slug,))
    conn.commit()
    return remaining[0]


def _import_file(conn, path: Path) -> None:
    slug = check_slug(path.stem.removeprefix("thesis_"))
    if conn.execute("SELECT 1 FROM theses WHERE slug=?", (slug,)).fetchone():
        return
    t = Thesis(**yaml.safe_load(path.read_text()))
    conn.execute("INSERT INTO theses (slug, name, config, updated_at) VALUES (?,?,?,?)",
                 (slug, t.name, json.dumps(asdict(t)), _now()))


def import_default(conn) -> None:
    """New firm: the default lens only."""
    _import_file(conn, CONFIG_DIR / f"thesis_{DEFAULT_SLUG}.yaml")
    conn.commit()


def import_all_yaml(conn) -> bool:
    """Demo firm, once: every built-in config, if the table is still empty."""
    if conn.execute("SELECT COUNT(*) c FROM theses").fetchone()["c"]:
        return False
    for p in sorted(CONFIG_DIR.glob("thesis_*.yaml")):
        _import_file(conn, p)
    conn.commit()
    return True
