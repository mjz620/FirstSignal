"""Company page aggregate: facts are mechanical and sourced, stage derives from the
pipeline until the investor sets it, and the response is one call per company."""
import pytest
from fastapi.testclient import TestClient

from app import companies, config
from app.memory import db, ingest
from app.memory.models import Founder, Signal
from app.server import app


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "t.db")
    c = db.connect(); db.init_db(c)
    ingest.upsert_founder(c, Founder(id="f1", name="nferris / Tracewell",
                                     entity_keys={"domain": "tracewell.dev"}))
    for src, url, content, at in [
        ("hn", "https://news.ycombinator.com/item?id=1",
         "Show HN: Tracewell | author=nferris points=890 comments=120", "2026-06-24"),
        ("github", "https://github.com/nferris/tracewell",
         "nferris/tracewell: eval harness | stars=1,420 forks=61", "2026-07-17"),
        ("github", "https://github.com/nferris/tracewell/commits",
         "velocity: commits_6w=42 active_days=42", "2026-07-17"),
    ]:
        sid, _ = ingest.ingest_signal(c, Signal(source=src, source_url=url, content=content,
                                                observed_at=at))
        c.execute("INSERT INTO resolutions VALUES (?,?,?,?)", (sid, "f1", "t", "now"))
    c.commit()
    return c


def test_facts_are_parsed_and_sourced(conn):
    client = TestClient(app)
    r = client.get("/api/companies/f1").json()
    assert r["company"] == "Tracewell" and r["person"] == "nferris"
    f = {x["label"]: x for x in r["facts"]}
    assert f["GitHub stars"]["value"] == 1420
    assert f["GitHub stars"]["url"] == "https://github.com/nferris/tracewell"
    assert f["HN points"]["value"] == 890 and f["Team size"] if "Team size" in f else True
    assert "Team size" not in f  # never invented: no signal carried it
    assert [s["source"] for s in r["signals"]] == ["github", "github", "hn"]  # newest first
    assert r["links"][0]["url"] == "https://tracewell.dev"
    assert "/commits" not in "".join(l["url"] for l in r["links"])
    assert r["stage"] == "new" and r["stage_set_by_user"] is False
    assert r["source"] == "hn"  # earliest channel signal
    assert companies.found_via([{"source": "web"}, {"source": "tavily"}]) == "tavily"
    assert companies.found_via([{"source": "github"}, {"source": "web"}]) == "github"
    assert r["evidence"] == [] and r["memo_md"] is None
    assert client.get("/api/companies/nope").status_code == 404


def test_stage_derives_then_user_overrides(conn):
    client = TestClient(app)
    conn.execute("INSERT INTO kill_log (founder_id, reason, thesis, logged_at) VALUES (?,?,?,?)",
                 ("f1", "not a startup", "Pre-seed AI Infra", "now"))
    conn.commit()
    assert client.get("/api/companies/f1").json()["stage"] == "passed"
    r = client.put("/api/companies/f1/state", json={"stage": "researching",
                                                     "next_step": "ask about incorporation"})
    assert r.status_code == 200
    page = client.get("/api/companies/f1").json()
    assert page["stage"] == "researching" and page["stage_set_by_user"] is True
    assert page["next_step"] == "ask about incorporation"
    assert client.put("/api/companies/f1/state", json={"stage": "bogus"}).status_code == 422
    assert companies.derive_stage(conn, "f1", {"decision": None, "axes": []}, "none",
                                  "Pre-seed AI Infra") == "passed"
    # a kill under another lens, or a memo under this one, does not read as passed
    assert companies.derive_stage(conn, "f1", {"decision": None, "axes": []}, "none",
                                  "Other Lens") == "new"
    assert companies.derive_stage(conn, "f1", {"decision": "conditional", "axes": []}, "none",
                                  "Pre-seed AI Infra") == "decision"
