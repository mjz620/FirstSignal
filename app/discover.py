"""Discover feed: one row per company answering "why should I look at this?" in
plain words — what it is, why it surfaced, why it fits the thesis, when it was first
seen — plus the investor's stage. Everything here is read mechanically off the
signals adapters wrote; nothing is generated. A company that was never screened
shows no score at all rather than a meaningless one.
"""
import re
from datetime import datetime

from . import companies
from .memory import founder_score

_FACT_RE = companies._FACT_RE
_BATCH_RE = re.compile(r"^YC\s+([A-Z]\d{2})")
_MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def _when(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        d = datetime.fromisoformat(iso[:19])
        year = "" if d.year == datetime.now().year else f", {d.year}"
        return f"{_MONTHS[d.month - 1]} {d.day}{year}"
    except ValueError:
        return iso[:10]


def one_liner(source: str, content: str) -> str:
    head = (content or "").split(" | ")[0].strip().splitlines()[0] if content else ""
    if source == "hn":
        while head.lower().startswith("show hn:"):
            head = head[8:].strip()
        return head
    if source == "github":
        return head.split(": ", 1)[1] if ": " in head else head
    if source in ("yc", "producthunt"):
        body = head.split(": ", 1)[1] if ": " in head else head
        return body.split(" — ", 1)[1] if " — " in body else body
    if source == "arxiv":
        return head.removeprefix("arXiv:").strip()
    if source == "deck":
        return head[:140]
    return head[:140]


def why_surfaced(source: str, content: str, observed_at: str | None) -> str:
    f = {k: int(v.replace(",", "")) for k, v in _FACT_RE.findall(content or "")}
    head = (content or "").split(" | ")[0]
    if source == "hn":
        bits = ["Show HN" if "show hn" in head.lower() else "Hacker News"]
        if "points" in f:
            bits.append(f"{f['points']} points")
        if f.get("comments"):
            bits.append(f"{f['comments']} comments")
    elif source == "github":
        bits = ["GitHub repo"]
        if "stars" in f:
            bits.append(f"{f['stars']:,} stars")
    elif source == "yc":
        m = _BATCH_RE.match(head)
        bits = [f"YC {m.group(1)}" if m else "YC"]
        if "team_size" in f:
            bits.append(f"team of {f['team_size']}")
    elif source == "producthunt":
        bits = ["Product Hunt launch"]
    elif source == "arxiv":
        bits = ["arXiv paper"]
    elif source == "deck":
        bits = ["Applied with a deck"]
    elif source == "launchtracker":
        bits = ["New launch"]
    else:
        bits = ["Open web"]
    w = _when(observed_at)
    return ", ".join(bits) + (f", {w}" if w else "")


def _stage_sets(conn, thesis_name: str) -> dict[str, set]:
    q = lambda sql, p=(): {r["fid"] for r in conn.execute(sql, p).fetchall()}  # noqa: E731
    return {
        "decision": q("SELECT DISTINCT founder_id fid FROM memos WHERE thesis=?", (thesis_name,)),
        "passed": q("SELECT DISTINCT founder_id fid FROM kill_log WHERE thesis=?", (thesis_name,)),
        "running": q("SELECT founder_id fid FROM run_status GROUP BY founder_id HAVING "
                     "SUM(CASE WHEN stage='done' AND status IN ('ok','error') THEN 1 ELSE 0 END)=0"),
        "researching": q("SELECT DISTINCT founder_id fid FROM axis_scores WHERE thesis=?",
                         (thesis_name,)),
        "user": {r["fid"]: (r["stage"], r["next_step"]) for r in conn.execute(
            "SELECT founder_id fid, stage, next_step FROM company_state").fetchall()},
    }


def stage_for(fid: str, sets: dict) -> tuple[str, bool, str]:
    """(stage, set_by_user, next_step)."""
    if fid in sets["user"]:
        st, nxt = sets["user"][fid]
        return st, True, nxt or ""
    for st in ("decision", "passed", "running", "researching"):
        if fid in sets[st]:
            return ("diligence" if st == "running" else st), False, ""
    return "new", False, ""


def feed(conn, thesis) -> list[dict]:
    rows = conn.execute(
        "SELECT COALESCE(s.founder_id, r.founder_id) fid, f.name, s.id sid, s.source, "
        "s.source_url, s.content, COALESCE(s.observed_at, s.ingested_at) at "
        "FROM signals s LEFT JOIN resolutions r ON r.signal_id = s.id "
        "JOIN founders f ON f.id = COALESCE(s.founder_id, r.founder_id)").fetchall()
    by: dict[str, dict] = {}
    for r in rows:
        e = by.setdefault(r["fid"], {"name": r["name"], "signals": []})
        e["signals"].append({"id": r["sid"], "source": r["source"], "url": r["source_url"],
                             "content": r["content"] or "", "observed_at": r["at"]})
    sets = _stage_sets(conn, thesis.name)
    scores = founder_score.compute_batch(conn, list(by))
    memo_decisions = {r["fid"]: r["decision"] for r in conn.execute(
        "SELECT founder_id fid, decision FROM memos WHERE thesis=?", (thesis.name,)).fetchall()}
    out = []
    for fid, e in by.items():
        sigs = sorted(e["signals"], key=lambda s: s["observed_at"] or "", reverse=True)
        origin_src = companies.found_via(sigs)
        origin = next(s for s in reversed(sigs) if s["source"] == origin_src)
        blob = "\n".join(s["content"] for s in sigs).lower()
        fit = [tp for tp in thesis.topics if tp.lower() in blob]
        stage, by_user, next_step = stage_for(fid, sets)
        researched = fid in sets["researching"] or fid in sets["decision"]
        name = e["name"] or fid
        company = name.split("/", 1)[1].strip() if "/" in name else name
        person = name.split("/", 1)[0].strip() if "/" in name else None
        cur = scores[fid]
        out.append({
            "id": fid, "company": company, "person": person,
            "one_liner": one_liner(origin["source"], origin["content"]),
            "why": why_surfaced(origin["source"], origin["content"], origin["observed_at"]),
            "origin": "Applied" if origin["source"] == "deck" else f"Found via {origin['source']}",
            "origin_url": origin["url"] if (origin["url"] or "").startswith("http") else None,
            "fit": fit, "first_seen": origin["observed_at"], "latest": sigs[0]["observed_at"],
            "signal_count": len(sigs),
            "sources": sorted({s["source"] for s in sigs}),
            "stage": stage, "stage_set_by_user": by_user, "next_step": next_step,
            "researched": researched,
            "score": cur["score"] if researched else None,
            "coverage": cur["coverage"] if researched else None,
            "decision": memo_decisions.get(fid),
        })
    # Thesis first: what fits this lens (or was researched under it) ranks above what
    # merely arrived recently — swapping the lens must change the list, not just a label.
    out.sort(key=lambda x: (len(x["fit"]) > 0 or x["researched"], len(x["fit"]),
                            x["latest"] or ""), reverse=True)
    return out
