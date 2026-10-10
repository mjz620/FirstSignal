"""Discover feed: plain-words rows read mechanically off signals; fixture founders
(direct founder_id) and resolved founders both appear; unscreened rows carry no score."""
import pytest
from fastapi.testclient import TestClient

from app import config, discover
from app.memory import db, ingest
from app.memory.models import Founder, Signal
from app.server import app


def test_one_liner_and_why_per_source():
    assert discover.one_liner("hn", "Show HN: Show HN: Tracewell – CI tests | author=x points=890 comments=12") \
        == "Tracewell – CI tests"
    assert discover.why_surfaced("hn", "Show HN: X | author=x points=890 comments=12", "2026-06-24") \
        == "Show HN, 890 points, 12 comments, Jun 24"
    assert discover.one_liner("github", "nferris/tracewell: eval harness for agents | stars=1420") \
        == "eval harness for agents"
    assert discover.why_surfaced("github", "a/b: x | stars=14,525 forks=2", None) == "GitHub repo, 14,525 stars"
    assert discover.one_liner("yc", "YC W16: Deepgram — Speech AI. | team_size=115") == "Speech AI."
    assert discover.why_surfaced("yc", "YC W16: Deepgram — Speech AI. | team_size=115", "2026-07-18T01:02:03") \
        == "YC W16, team of 115, Jul 18"
    assert discover.one_liner("producthunt", "ProductHunt launch: Kit — Memory for agents | maker=A") \
        == "Memory for agents"
    assert discover.why_surfaced("deck", "ACME — Seed Deck", "2026-07-18") == "Applied with a deck, Jul 18"


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "t.db")
    c = db.connect(); db.init_db(c)
    # fixture-style founder: signal carries founder_id directly, no resolution row
    ingest.upsert_founder(c, Founder(id="f-direct", name="nferris / Tracewell"))
    ingest.ingest_signal(c, Signal(source="hn", source_url="https://news.ycombinator.com/item?id=1",
                                   content="Show HN: Tracewell – llm agents eval | points=890",
                                   observed_at="2026-06-24", founder_id="f-direct"))
    ingest.ingest_signal(c, Signal(source="web", source_url="https://x.test/notes",
                                   content="enrichment note", observed_at="2026-06-01",
                                   founder_id="f-direct"))
    # resolved founder: signal linked through resolutions
    ingest.upsert_founder(c, Founder(id="f-res", name="zibralabs.ai"))
    sid, _ = ingest.ingest_signal(c, Signal(source="yc", source_url="https://ycombinator.com/companies/z",
                                            content="YC P26: Zibra Labs — Distributed runtime | team_size=2",
                                            observed_at="2026-07-18"))
    c.execute("INSERT INTO resolutions VALUES (?,?,?,?)", (sid, "f-res", "t", "now"))
    c.commit()
    return c


def test_feed_rows(conn):
    class T: name = "Lens"; topics = ["llm agents", "runtime"]
    rows = {r["id"]: r for r in discover.feed(conn, T())}
    assert set(rows) == {"f-direct", "f-res"}
    d = rows["f-direct"]
    assert d["company"] == "Tracewell" and d["person"] == "nferris"
    assert d["one_liner"] == "Tracewell – llm agents eval"
    assert d["why"].startswith("Show HN, 890 points") and d["origin"] == "Found via hn"
    assert d["fit"] == ["llm agents"] and d["signal_count"] == 2
    assert d["score"] is None and d["researched"] is False and d["stage"] == "new"
    z = rows["f-res"]
    assert z["one_liner"] == "Distributed runtime" and z["why"] == "YC P26, team of 2, Jul 18"
    assert z["fit"] == ["runtime"]
    r = TestClient(app).get("/api/discover").json()
    assert {i["id"] for i in r["items"]} == {"f-direct", "f-res"}
