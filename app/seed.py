"""Idempotent seed loader: cold start is never empty (deployment requirement).

The snapshot is a plain SQLite file checked into the repo; loading goes through the
db.connect() seam so the same code seeds both backends (local SQLite or DATABASE_URL
Postgres). No-op when founders exist — safe to call on every boot.
"""
import shutil
import sqlite3

from . import config
from .memory import db

SNAPSHOT = config.FIXTURES / "seed_db.sqlite"
# FK-safe insert order.
TABLES = ["founders", "signals", "claims", "resolutions", "droplog", "axis_scores",
          "adjudications", "memos", "latency", "kill_log", "outreach"]
_SMOKE = "founder-smoke"
# Never part of a snapshot: accounts, and the per-firm thesis table (seeded separately).
_PRIVATE = ["sessions", "users", "firms", "theses"]


def snapshot() -> None:
    """Dump the local vc_brain.db to the repo snapshot, minus smoke-test rows."""
    if not config.DB_PATH.exists():
        raise SystemExit("no local vc_brain.db to snapshot")
    SNAPSHOT.parent.mkdir(exist_ok=True)
    shutil.copy(config.DB_PATH, SNAPSHOT)
    conn = sqlite3.connect(SNAPSHOT)
    conn.execute("DROP TRIGGER IF EXISTS signals_no_update")
    conn.execute("DROP TRIGGER IF EXISTS signals_no_delete")
    for t in _PRIVATE:
        conn.execute(f"DROP TABLE IF EXISTS {t}")
    for t in TABLES:
        col = "id" if t == "founders" else "founder_id"
        try:
            conn.execute(f"DELETE FROM {t} WHERE {col} LIKE '{_SMOKE}%'")
        except sqlite3.OperationalError:
            pass  # tables without that column keep their rows (harmless)
    conn.commit()
    conn.execute("VACUUM")
    n = conn.execute("SELECT COUNT(*) FROM founders").fetchone()[0]
    print(f"snapshot -> {SNAPSHOT} ({n} founders)")


def ensure_seeded() -> bool:
    """Load the snapshot into the active backend if it has no founders yet."""
    if not SNAPSHOT.exists():
        return False
    target = db.connect()
    db.init_db(target)
    if target.execute("SELECT COUNT(*) c FROM founders").fetchone()["c"] > 0:
        return False
    src = sqlite3.connect(SNAPSHOT)
    src.row_factory = sqlite3.Row
    for t in TABLES:
        rows = src.execute(f"SELECT * FROM {t}").fetchall()
        if not rows:
            continue
        cols = rows[0].keys()
        sql = (f"INSERT INTO {t} ({', '.join(cols)}) "
               f"VALUES ({','.join('?' * len(cols))})")
        for r in rows:
            target.execute(sql, tuple(r[c] for c in cols))
        print(f"seeded {t}: {len(rows)} rows")
    target.commit()
    return True


def seed_firm(conn) -> bool:
    """Seed a NEW firm store in bulk (one INSERT..SELECT per table, not ~700 row
    inserts over the Supabase pooler). SQLite copies from the snapshot file; Postgres
    copies from the already-seeded demo schema (public). Column lists come from the
    snapshot so an older snapshot still loads into a newer schema."""
    if not SNAPSHOT.exists():
        return False
    if conn.execute("SELECT COUNT(*) c FROM founders").fetchone()["c"] > 0:
        return False
    src = sqlite3.connect(SNAPSHOT)
    cols = {t: [r[1] for r in src.execute(f"PRAGMA table_info({t})").fetchall()]
            for t in TABLES}
    src.close()
    pg = isinstance(conn, db.PgConnection)
    if not pg:
        conn.execute("ATTACH DATABASE ? AS seed", (str(SNAPSHOT),))
    for t in TABLES:
        if not cols[t]:
            continue
        c = ", ".join(cols[t])
        origin = f"public.{t}" if pg else f"seed.{t}"
        conn.execute(f"INSERT INTO {t} ({c}) SELECT {c} FROM {origin}")
    conn.commit()
    if not pg:
        conn.execute("DETACH DATABASE seed")
    return True
