"""Memory layer: connection + schema (founders, signals, claims).

Two backends behind one seam:
- SQLite (default): stdlib sqlite3, zero ops — local dev, tests (`:memory:`), replay.
- Postgres (Supabase): set DATABASE_URL and `connect()` returns a pooled psycopg
  connection wrapped in a proxy that translates the app's SQLite dialect (`?`
  placeholders, INSERT OR REPLACE, GROUP_CONCAT) so the 80+ call sites stay
  untouched. Judge-submitted founders persist across host restarts.

The signals table is enforced append-only by triggers on BOTH engines — "nothing
discarded" is a brief requirement and the append-only table *is* the compliance
story (spec §2.1).
"""
import contextvars
import os
import re
import sqlite3
import threading
import weakref
from contextlib import contextmanager
from pathlib import Path

from .. import config

# ---------------------------------------------------------------------------
# Firm scope. Each firm owns a separate store: a Postgres schema (firm_<slug>) or a
# SQLite file (firms/<slug>.db). The pre-existing data is the "demo" firm and keeps
# living in the default store (public schema / vc_brain.db), so the CLI, scripts and
# tests — which never set a firm — behave exactly as before.
# ---------------------------------------------------------------------------
DEMO_FIRM = "demo"
_RESERVED = {DEMO_FIRM, "public", "seed", "main", "temp"}
_SLUG_RE = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
current_firm: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_firm", default=None)


def validate_slug(slug: str) -> str:
    """Slugs become schema names and file names — reject anything else outright."""
    if not isinstance(slug, str) or not _SLUG_RE.match(slug) or slug in _RESERVED \
            or slug.startswith("pg_"):
        raise ValueError(f"invalid firm slug: {slug!r}")
    return slug


def active_firm() -> str:
    return current_firm.get() or DEMO_FIRM


@contextmanager
def firm_scope(slug: str | None):
    """Run a block against one firm's store (None/"demo" = the default store)."""
    token = current_firm.set(slug if slug and slug != DEMO_FIRM else None)
    try:
        yield
    finally:
        current_firm.reset(token)

# Engine-neutral DDL (valid on SQLite and Postgres).
_COMMON = """
CREATE TABLE IF NOT EXISTS founders (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    aliases       TEXT NOT NULL DEFAULT '[]',   -- JSON
    entity_keys   TEXT NOT NULL DEFAULT '{}',   -- JSON
    founder_score TEXT,                          -- JSON (dimensions + coverage + history)
    first_seen    TEXT,
    last_updated  TEXT
);

CREATE TABLE IF NOT EXISTS signals (
    id          TEXT PRIMARY KEY,               -- "sig-" + dedup_hash[:12] (content-stable)
    founder_id  TEXT REFERENCES founders(id),   -- nullable until resolved
    source      TEXT NOT NULL,
    source_url  TEXT NOT NULL,
    content     TEXT NOT NULL,
    observed_at TEXT,
    ingested_at TEXT NOT NULL,
    dedup_hash  TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_signals_founder ON signals(founder_id);

-- Every claim must trace to resolvable evidence: evidence_url is non-empty by
-- CHECK constraint. Negative results carry the search URL that returned nothing.
CREATE TABLE IF NOT EXISTS claims (
    claim_id      TEXT NOT NULL,                -- e.g. "team-03"
    founder_id    TEXT NOT NULL REFERENCES founders(id),
    subject       TEXT,                         -- WHICH person the claim is about;
                                                -- NULL = about the company, not a person.
                                                -- founder_id is one row per COMPANY, so
                                                -- without this a 2-founder team collapses
                                                -- into one person and evidence gets hung
                                                -- on the wrong co-founder.
    axis          TEXT NOT NULL,
    text          TEXT NOT NULL,
    stance        TEXT NOT NULL,
    evidence      TEXT NOT NULL,
    evidence_url  TEXT NOT NULL CHECK (evidence_url <> ''),
    evidence_title   TEXT,                      -- human-readable source title
    evidence_excerpt TEXT,                      -- verbatim snippet backing the claim
    retrieved_at  TEXT,                         -- when the evidence was fetched
    source_type   TEXT NOT NULL,
    corroboration TEXT NOT NULL,
    trust         REAL NOT NULL,
    observed_at   TEXT,
    signal_ids    TEXT NOT NULL DEFAULT '[]',   -- JSON: >=1 signal per claim
    PRIMARY KEY (founder_id, claim_id)
);

-- Entity resolution: a signal links to a founder only on >=2 co-occurring entity
-- keys. Resolution is its own ledger so raw signals stay immutable.
CREATE TABLE IF NOT EXISTS resolutions (
    signal_id   TEXT PRIMARY KEY REFERENCES signals(id),
    founder_id  TEXT NOT NULL REFERENCES founders(id),
    method      TEXT NOT NULL,
    resolved_at TEXT NOT NULL
);

-- Drop-log: signals that failed entity resolution are logged, not discarded
-- (spec §2.1 "nothing discarded"; the drop-log is the compliance story).
CREATE TABLE IF NOT EXISTS droplog (
    signal_id   TEXT NOT NULL,
    reason      TEXT NOT NULL,
    entity_keys TEXT NOT NULL DEFAULT '{}',
    logged_at   TEXT NOT NULL
);

-- Per-opportunity axis scores (spec §2.3). Three independent axes, NEVER averaged.
-- Append-only, so the trend over time falls out by comparing successive scores.
CREATE TABLE IF NOT EXISTS axis_scores (
    founder_id TEXT NOT NULL REFERENCES founders(id),
    axis       TEXT NOT NULL,           -- founder | market | idea
    score      REAL NOT NULL,           -- 0–10
    stance     TEXT NOT NULL,
    rationale  TEXT NOT NULL,
    coverage   REAL NOT NULL,           -- 0–1
    thesis     TEXT NOT NULL,
    scored_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_axis_founder ON axis_scores(founder_id, axis);

-- Adjudication verdicts (fact-layer debate): the Judge's tier/trust decision on a
-- contested claim, with the prosecution/defense it turned on. Append-only audit trail.
CREATE TABLE IF NOT EXISTS adjudications (
    founder_id  TEXT NOT NULL REFERENCES founders(id),
    claim_id    TEXT NOT NULL,
    prosecution TEXT NOT NULL,
    defense     TEXT NOT NULL,
    corroboration TEXT NOT NULL,   -- Judge-set tier
    trust       REAL NOT NULL,     -- Judge-set trust
    rationale   TEXT NOT NULL,
    decided_at  TEXT NOT NULL
);

-- Final memo + recommendation from the diligence pipeline (decision-layer debate).
CREATE TABLE IF NOT EXISTS memos (
    founder_id     TEXT NOT NULL REFERENCES founders(id),
    thesis         TEXT NOT NULL,
    decision       TEXT NOT NULL,          -- invest | pass | conditional
    recommendation TEXT NOT NULL,          -- JSON (structured recommendation)
    memo_md        TEXT NOT NULL,          -- the memo (markdown, cites claim ids)
    bull           TEXT NOT NULL,
    bear           TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    PRIMARY KEY (founder_id, thesis)
);

-- Latency instrumentation (spec §2.6): per-stage wall-clock, signal -> decision.
-- Directly credited by the Investment Utility criterion (30%).
CREATE TABLE IF NOT EXISTS latency (
    founder_id  TEXT NOT NULL,
    stage       TEXT NOT NULL,
    seconds     REAL NOT NULL,
    measured_at TEXT NOT NULL,
    PRIMARY KEY (founder_id, stage)
);

-- First-pass kill screen (spec §2.3): log why a non-viable opportunity was killed.
CREATE TABLE IF NOT EXISTS kill_log (
    founder_id TEXT NOT NULL,
    reason     TEXT NOT NULL,
    thesis     TEXT NOT NULL,
    logged_at  TEXT NOT NULL
);

-- Live run progress (apply -> memo): one row per (founder, stage), rewritten as the
-- pipeline advances so the UI can render a watchable run. Errors land in detail.
CREATE TABLE IF NOT EXISTS run_status (
    founder_id TEXT NOT NULL,
    stage      TEXT NOT NULL,           -- ingest|screen|extract|adjudicate|debate|synthesize|done
    status     TEXT NOT NULL,           -- queued | running | ok | error
    detail     TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (founder_id, stage)
);

-- Activate (brief MVP 5): outreach drafts, each tied to the signal that triggered it.
CREATE TABLE IF NOT EXISTS outreach (
    founder_id TEXT NOT NULL REFERENCES founders(id),
    signal_id  TEXT NOT NULL REFERENCES signals(id),
    subject    TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (founder_id, signal_id)
);

-- Pipeline state per company (per firm): the investor's own stage + next step.
-- Absent row = stage derived mechanically from what the pipeline has produced.
CREATE TABLE IF NOT EXISTS company_state (
    founder_id TEXT PRIMARY KEY,
    stage      TEXT NOT NULL,           -- new|researching|diligence|decision|invested|passed
    next_step  TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);

-- Thesis Engine configs, one row per lens. Per-firm: lives in every firm store.
-- Results (axis_scores, memos, kill_log) still key on the thesis *name*.
CREATE TABLE IF NOT EXISTS theses (
    slug       TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    config     TEXT NOT NULL,           -- JSON of the Thesis dataclass
    updated_at TEXT NOT NULL
);
"""

# Control plane: accounts live ONLY in the default store, never in a firm store, so a
# firm snapshot or schema dump can never carry credentials.
CONTROL_SCHEMA = """
CREATE TABLE IF NOT EXISTS firms (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    firm_slug     TEXT NOT NULL REFERENCES firms(slug),
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,         -- sha256 of the cookie token
    user_id    TEXT NOT NULL REFERENCES users(id),
    firm_slug  TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
"""

# Append-only guard: the signals table cannot be updated or deleted from.
_SQLITE_TRIGGERS = """
CREATE TRIGGER IF NOT EXISTS signals_no_update BEFORE UPDATE ON signals
BEGIN SELECT RAISE(ABORT, 'signals table is append-only'); END;
CREATE TRIGGER IF NOT EXISTS signals_no_delete BEFORE DELETE ON signals
BEGIN SELECT RAISE(ABORT, 'signals table is append-only'); END;
"""

_PG_TRIGGERS = """
CREATE OR REPLACE FUNCTION signals_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'signals table is append-only'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS signals_no_update ON signals;
CREATE TRIGGER signals_no_update BEFORE UPDATE ON signals
FOR EACH ROW EXECUTE FUNCTION signals_append_only();
DROP TRIGGER IF EXISTS signals_no_delete ON signals;
CREATE TRIGGER signals_no_delete BEFORE DELETE ON signals
FOR EACH ROW EXECUTE FUNCTION signals_append_only();
"""

SCHEMA = _COMMON + _SQLITE_TRIGGERS
PG_SCHEMA = _COMMON + _PG_TRIGGERS


# ---------------------------------------------------------------------------
# Postgres proxy: translate the app's SQLite dialect at the connection seam.
# ---------------------------------------------------------------------------

# Conflict targets for INSERT OR REPLACE rewrites (every such table has a PK).
_PG_PK = {
    "founders": ("id",),
    "signals": ("id",),
    "claims": ("founder_id", "claim_id"),
    "resolutions": ("signal_id",),
    "memos": ("founder_id", "thesis"),
    "latency": ("founder_id", "stage"),
    "outreach": ("founder_id", "signal_id"),
    "theses": ("slug",),
    "company_state": ("founder_id",),
    "firms": ("slug",),
    "users": ("id",),
    "sessions": ("id",),
}

_RE_IOR = re.compile(r"^\s*INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)", re.I)
_RE_GC_DISTINCT = re.compile(r"GROUP_CONCAT\(\s*DISTINCT\s+([^)]+?)\s*\)", re.I)
_RE_GC_SEP = re.compile(r"GROUP_CONCAT\(\s*([^,()]+?)\s*,\s*'([^']*)'\s*\)", re.I | re.S)


def _to_pg(sql: str) -> str:
    m = _RE_IOR.match(sql)
    if m:
        table = m.group(1)
        cols = [c.strip() for c in m.group(2).split(",")]
        pk = _PG_PK[table]
        updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c not in pk)
        sql = _RE_IOR.sub(f"INSERT INTO {table} ({', '.join(cols)})", sql, count=1)
        sql = f"{sql} ON CONFLICT ({', '.join(pk)}) DO UPDATE SET {updates}"
    sql = _RE_GC_DISTINCT.sub(lambda g: f"STRING_AGG(DISTINCT {g.group(1)}, ',')", sql)
    sql = _RE_GC_SEP.sub(lambda g: f"STRING_AGG({g.group(1)}, '{g.group(2)}')", sql)
    return sql.replace("?", "%s")


class _EmptyResult:
    def fetchone(self):
        return None

    def fetchall(self):
        return []


def _putback(pool, raw):
    try:
        pool.putconn(raw)  # putconn rolls back any open transaction
    except Exception:
        try:
            raw.close()
        except Exception:
            pass


class PgConnection:
    """Duck-types the sqlite3.Connection surface the app uses:
    execute()/commit()/close(), with cursor.fetchone()/fetchall() dict rows.
    Returned to the pool when garbage-collected (CPython refcounting makes this
    prompt at request end) or on explicit close().

    Firm scoping: `schema` (firm_<slug>, or None for the default public store) is
    applied with `SET LOCAL search_path` as the FIRST statement of every transaction.
    The Supabase pooler runs in transaction mode, so a session-level SET would not
    survive a commit; psycopg opens a new implicit transaction on the next execute,
    and the lazy re-arm below puts the SET back in front of it. search_path is the
    firm schema alone — never `firm_x, public` — so a missing table can never fall
    through to another firm's rows."""

    def __init__(self, raw, pool, schema: str | None = None):
        self._raw = raw
        self._schema = schema
        self._armed = schema is None
        self._finalizer = weakref.finalize(self, _putback, pool, raw)

    def _arm(self):
        if not self._armed:
            from psycopg import sql as _sql
            self._raw.execute(_sql.SQL("SET LOCAL search_path TO {}").format(
                _sql.Identifier(self._schema)))
            self._armed = True

    def execute(self, sql: str, params=()):
        if sql.lstrip().upper().startswith("PRAGMA"):
            return _EmptyResult()
        self._arm()
        return self._raw.execute(_to_pg(sql), params)

    def executescript(self, script: str):
        self._arm()
        self._raw.execute(script)

    def commit(self):
        self._raw.commit()
        self._armed = self._schema is None

    def rollback(self):
        self._raw.rollback()
        self._armed = self._schema is None

    def close(self):
        self._finalizer()


_pool = None
_pool_lock = threading.Lock()
_pg_initialized: set[str] = set()      # schemas whose DDL has run in this process
_sqlite_initialized: set[str] = set()  # firm db files known to exist


def _get_pool():
    global _pool
    with _pool_lock:
        if _pool is None:
            from psycopg.rows import dict_row
            from psycopg_pool import ConnectionPool

            def _configure(c):
                c.row_factory = dict_row
                # Supabase pooler (transaction mode) breaks server-side prepares.
                c.prepare_threshold = None

            _pool = ConnectionPool(
                os.environ["DATABASE_URL"], min_size=1, max_size=5,
                timeout=10,  # fail fast when Postgres is unreachable
                # keep 1 connection warm so most requests skip the TLS handshake to
                # the (cross-region) Supabase pooler
                configure=_configure, open=True)
        return _pool


# ---------------------------------------------------------------------------
# Public seam — unchanged signatures.
# ---------------------------------------------------------------------------

def _sqlite_path(firm: str) -> Path:
    if firm == DEMO_FIRM:
        return Path(config.DB_PATH)
    return Path(config.DB_PATH).parent / "firms" / f"{validate_slug(firm)}.db"


def _schema_for(firm: str) -> str | None:
    return None if firm == DEMO_FIRM else f"firm_{validate_slug(firm)}"


def connect(path=None):
    """Open a connection to the ACTIVE firm's store (see firm_scope). An explicit
    path always means that SQLite file, regardless of firm."""
    # Precedence: an explicit path or VC_DB_PATH always means local SQLite —
    # so tests and local demo copies never accidentally reach the deployed DB.
    firm = active_firm()
    url = os.environ.get("DATABASE_URL")
    if url and path is None and not os.environ.get("VC_DB_PATH"):
        pool = _get_pool()
        conn = PgConnection(pool.getconn(), pool, _schema_for(firm))
        if conn._schema and conn._schema not in _pg_initialized:
            init_db(conn)  # a firm store must exist before any router touches it
        return conn
    if path is None:
        path = _sqlite_path(firm)
        if firm != DEMO_FIRM:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if firm != DEMO_FIRM and str(path) not in _sqlite_initialized:
        init_db(conn)
        _sqlite_initialized.add(str(path))
    return conn


def connect_default():
    """The default (demo/control) store, whatever firm is active. Accounts live here."""
    with firm_scope(None):
        return connect()


def init_db(conn) -> None:
    if isinstance(conn, PgConnection):
        key = conn._schema or "public"
        with _pool_lock:
            if key in _pg_initialized:
                return
        if conn._schema:
            from psycopg import errors as _pe
            from psycopg import sql as _sql
            try:
                conn._raw.execute(_sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(
                    _sql.Identifier(conn._schema)))
                conn._raw.commit()
            except _pe.UniqueViolation:  # two first requests raced; the schema exists
                conn._raw.rollback()
            conn._armed = False
        conn.executescript(PG_SCHEMA)
        _migrate(conn)
        conn.commit()
        with _pool_lock:
            _pg_initialized.add(key)
        return
    conn.executescript(SCHEMA)
    _migrate(conn)
    conn.commit()


def init_control(conn) -> None:
    """Account tables. Only ever called on the default store."""
    conn.executescript(CONTROL_SCHEMA)
    conn.commit()


# Additive, idempotent column adds for databases created before the column existed.
# CREATE TABLE IF NOT EXISTS silently skips an existing table, so a new column in the
# schema above never reaches a DB that already has rows.
_MIGRATIONS = [("claims", "subject", "TEXT")]


def _migrate(conn) -> None:
    pg = isinstance(conn, PgConnection)
    for table, column, coltype in _MIGRATIONS:
        if pg:
            # Postgres supports IF NOT EXISTS here. Letting the statement fail instead
            # would poison the surrounding transaction and take the whole init down.
            conn.execute(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {coltype}")
        else:
            # SQLite has no IF NOT EXISTS for ADD COLUMN, but a failed ALTER does not
            # invalidate the connection, so catching the duplicate is safe here.
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
            except sqlite3.OperationalError:
                pass
