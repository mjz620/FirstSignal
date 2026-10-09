"""Accounts + per-firm segregation: a firm's store holds its own theses and
founders, is seeded on creation, and nothing leaks across firms. These tests use
the REAL cookie path (marker real_auth disables the demo-session patch)."""
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import auth, config, seed
from app.memory import db
from app.server import app

pytestmark = pytest.mark.real_auth


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.db")
    for k in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    db.init_db(db.connect())  # the demo store, as the server boot would leave it
    return lambda: TestClient(app)


def _signup(c, email, **kw):
    r = c.post("/api/auth/signup", json={"email": email, "password": "hunter2hunter2", **kw})
    assert r.status_code == 200, r.text
    return r.json()


def test_api_requires_a_session(client):
    c = client()
    assert c.get("/api/founders").status_code == 401
    assert c.get("/api/auth/me").status_code == 401
    assert c.post("/api/thesis", json={}).status_code == 401


def test_signup_creates_a_seeded_firm_and_sets_cookie(client):
    c = client()
    me = _signup(c, "ann@acme.vc", firm_name="Acme Capital")
    assert me["firm"]["slug"] == "acme_capital" and me["firm"]["invite_code"]
    assert auth.COOKIE in c.cookies
    assert c.get("/api/auth/me").json()["email"] == "ann@acme.vc"
    # Seeded: the demo story (Corevance et al.) and the default lens are there.
    slugs = [t["slug"] for t in c.get("/api/theses").json()]
    assert slugs == ["preseed_ai_infra"]
    ids = {f["id"] for f in c.get("/api/founders").json()}
    assert "founder-corevance" in ids
    assert (config.DB_PATH.parent / "firms" / "acme_capital.db").exists()


def test_login_logout_and_bad_credentials(client):
    c = client()
    _signup(c, "ann@acme.vc", firm_name="Acme")
    c.post("/api/auth/logout")
    assert c.get("/api/auth/me").status_code == 401
    r = c.post("/api/auth/login", json={"email": "ann@acme.vc", "password": "wrong-wrong"})
    assert r.status_code == 401
    assert c.post("/api/auth/login", json={"email": "nobody@x.io", "password": "wrong-wrong"}
                  ).json()["detail"] == r.json()["detail"]  # no account enumeration
    assert c.post("/api/auth/login", json={"email": "ANN@acme.vc",
                                           "password": "hunter2hunter2"}).status_code == 200
    assert c.get("/api/auth/me").json()["firm"]["slug"] == "acme"
    dup = c.post("/api/auth/signup", json={"email": "ann@acme.vc", "password": "hunter2hunter2",
                                           "firm_name": "Other"})
    assert dup.status_code == 409


def test_invite_code_joins_the_same_firm(client):
    a = client()
    me = _signup(a, "ann@acme.vc", firm_name="Acme")
    b = client()
    joined = _signup(b, "bob@acme.vc", invite_code=me["firm"]["invite_code"])
    assert joined["firm"]["slug"] == "acme"
    assert client().post("/api/auth/signup", json={
        "email": "x@y.io", "password": "hunter2hunter2", "invite_code": "nope"}).status_code == 404


def test_firms_are_segregated(client):
    a, b = client(), client()
    _signup(a, "ann@acme.vc", firm_name="Acme")
    _signup(b, "bea@birch.vc", firm_name="Birch")

    # Theses: A's new lens never appears in B's list.
    r = a.post("/api/thesis", json={
        "name": "Acme Climate", "sectors": ["climate"], "stage": "seed", "geography": ["EU"],
        "check_size_usd": 250000, "ownership_target_pct": 10, "risk_appetite": "medium",
        "topics": ["carbon"]})
    assert r.json()["slug"] == "acme_climate"
    assert "acme_climate" in [t["slug"] for t in a.get("/api/theses").json()]
    assert "acme_climate" not in [t["slug"] for t in b.get("/api/theses").json()]
    rows = a.get("/api/founders?thesis=acme_climate").json()  # nothing scored under it yet
    assert rows and all(ax["status"] == "not yet screened" for f in rows for ax in f["axes"])
    assert b.get("/api/founders?thesis=acme_climate").status_code == 404

    # Founders: an inbound apply in A (no LLM key → stored, screening skipped) is
    # invisible to B, and to the demo store.
    r = a.post("/api/apply", json={"company": "Northwind Robotics",
                                   "deck_text": "x" * 200}).json()
    fid = r["founder_id"]
    assert a.get(f"/api/runs/{fid}").json()["state"] != "none"
    assert b.get(f"/api/runs/{fid}").json()["state"] == "none"
    with db.firm_scope("birch"):
        assert db.connect().execute("SELECT 1 FROM founders WHERE id=?", (fid,)).fetchone() is None
    assert db.connect().execute("SELECT 1 FROM founders WHERE id=?", (fid,)).fetchone() is None

    # Deleting down to the last lens is refused per firm.
    assert a.delete("/api/thesis?slug=acme_climate").json()["next"] == "preseed_ai_infra"
    assert a.delete("/api/thesis?slug=preseed_ai_infra").status_code == 409


def test_snapshot_never_carries_accounts(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "live.db")
    monkeypatch.setattr(seed, "SNAPSHOT", tmp_path / "snap.sqlite")
    db.init_db(db.connect())  # the demo store, as the server boot would leave it
    auth.signup("ann@acme.vc", "hunter2hunter2", firm_name="Acme")  # writes users/sessions
    seed.snapshot()
    names = {r[0] for r in sqlite3.connect(seed.SNAPSHOT).execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert names & {"users", "sessions", "firms", "theses"} == set()
    assert "founders" in names


def test_slug_validation_blocks_injection():
    for bad in ("demo", "public", "pg_catalog", "a;drop", "../x", "Firm", ""):
        with pytest.raises(ValueError):
            db.validate_slug(bad)
    assert db.validate_slug("acme_2") == "acme_2"
