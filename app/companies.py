"""Company page aggregate: everything the store holds about one company, in one
response, plus the investor's own pipeline stage.

Facts are mechanical only — parsed `key=value` tokens that adapters wrote into signal
content (stars=, points=, team_size=, …), each carrying the signal it came from. A
fact with no signal behind it is not rendered; the page shows "not on record".
"""
import json
import re
from datetime import datetime, timezone

from .decision import decision as dec
from .memory import founder_score, ingest

STAGES = ("new", "researching", "diligence", "decision", "invested", "passed")

# question each claim axis answers — the page groups evidence by these, not by a flat list
QUESTIONS = {
    "founder": "Is the team strong?",
    "traction": "Is there real traction?",
    "market": "Is the market real?",
    "idea": "Does the idea fit the market?",
    "risk": "What could kill it?",
}

_FACT_RE = re.compile(r"\b(stars|forks|points|team_size|commits_6w|active_days|comments)=(\d[\d,]*)")
_FACT_LABEL = {"stars": "GitHub stars", "forks": "Forks", "points": "HN points",
               "team_size": "Team size", "commits_6w": "Commits (6 wks)",
               "active_days": "Active days", "comments": "HN comments"}
_FACT_ORDER = list(_FACT_LABEL)


def _signals(conn, fid: str) -> list[dict]:
    rows = conn.execute(
        "SELECT DISTINCT s.id, s.source, s.source_url, s.content, s.observed_at, s.ingested_at "
        "FROM signals s LEFT JOIN resolutions r ON r.signal_id = s.id "
        "WHERE s.founder_id = ? OR r.founder_id = ? "
        "ORDER BY COALESCE(s.observed_at, s.ingested_at) DESC", (fid, fid)).fetchall()
    return [{"id": r["id"], "source": r["source"], "url": r["source_url"],
             "content": r["content"], "observed_at": r["observed_at"] or r["ingested_at"]}
            for r in rows]


def facts(signals: list[dict]) -> list[dict]:
    """Latest value per fact key, each pointing at the signal it was read from."""
    best: dict[str, dict] = {}
    for s in signals:  # newest first, so the first hit per key wins
        for key, val in _FACT_RE.findall(s["content"] or ""):
            if key not in best:
                best[key] = {"label": _FACT_LABEL[key], "value": int(val.replace(",", "")),
                             "signal_id": s["id"], "url": s["url"], "observed_at": s["observed_at"]}
    return [best[k] for k in _FACT_ORDER if k in best]


def links(signals: list[dict], entity_keys: dict) -> list[dict]:
    out, seen = [], set()
    if entity_keys.get("domain"):
        d = entity_keys["domain"]
        out.append({"label": d, "url": f"https://{d}"}); seen.add(f"https://{d}")
    for s in signals:
        u = s["url"] or ""
        if not u.startswith("http") or u in seen or "/commits" in u:
            continue
        if s["source"] in ("github", "hn", "producthunt", "yc", "arxiv"):
            out.append({"label": s["source"], "url": u}); seen.add(u)
    return out[:6]


def derive_stage(conn, fid: str, brief: dict, run_state: str, thesis_name: str) -> str:
    """Mechanical stage from what the pipeline produced UNDER THIS THESIS: a memo
    beats a first-pass kill (the analyst forced it through), and a kill under another
    lens says nothing about this one."""
    if brief["decision"]:
        return "decision"
    if conn.execute("SELECT 1 FROM kill_log WHERE founder_id=? AND thesis=? LIMIT 1",
                    (fid, thesis_name)).fetchone():
        return "passed"
    if run_state == "running":
        return "diligence"
    if any(a.get("score") is not None for a in brief["axes"]):
        return "researching"
    return "new"


def run_state(conn, fid: str) -> str:
    rows = conn.execute("SELECT stage, status FROM run_status WHERE founder_id=?",
                        (fid,)).fetchall()
    done = next((r for r in rows if r["stage"] == "done"), None)
    if done and done["status"] in ("ok", "error"):
        return done["status"]
    return "running" if rows else "none"


def get_state(conn, fid: str) -> dict | None:
    r = conn.execute("SELECT stage, next_step, updated_at FROM company_state WHERE founder_id=?",
                     (fid,)).fetchone()
    return dict(r) if r else None


def set_state(conn, fid: str, stage: str, next_step: str) -> dict:
    if stage not in STAGES:
        raise ValueError(f"stage must be one of {', '.join(STAGES)}")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("INSERT OR REPLACE INTO company_state (founder_id, stage, next_step, updated_at) "
                 "VALUES (?,?,?,?)", (fid, stage, next_step.strip(), now))
    conn.commit()
    return {"stage": stage, "next_step": next_step.strip(), "updated_at": now, "set_by_user": True}


def build(conn, fid: str, thesis) -> dict | None:
    f = conn.execute("SELECT * FROM founders WHERE id=?", (fid,)).fetchone()
    if not f:
        return None
    brief = dec.build(conn, fid, thesis)
    sigs = _signals(conn, fid)
    claims = [c.model_dump() for c in ingest.get_claims(conn, fid)]
    memo = conn.execute("SELECT bull, bear, created_at FROM memos WHERE founder_id=? AND thesis=?",
                        (fid, thesis.name)).fetchone()
    kill = conn.execute("SELECT reason FROM kill_log WHERE founder_id=? AND thesis=? "
                        "ORDER BY logged_at DESC LIMIT 1", (fid, thesis.name)).fetchone()
    outreach = conn.execute("SELECT subject, body, created_at FROM outreach WHERE founder_id=?",
                            (fid,)).fetchall()
    cur = founder_score.compute(conn, fid)
    stored = founder_score.stored(conn, fid)
    rs = run_state(conn, fid)
    state = get_state(conn, fid)
    name = f["name"]
    person, company = (name.split("/", 1) + [None])[:2] if "/" in name else (None, name)
    entity_keys = json.loads(f["entity_keys"] or "{}")
    grouped = []
    for axis, q in QUESTIONS.items():
        cs = [c for c in claims if c["axis"] == axis]
        if cs:
            grouped.append({"axis": axis, "question": q, "claims": cs})
    rec = brief["recommendation"] or {}
    return {
        "id": fid, "name": name, "company": (company or name).strip(),
        "person": person.strip() if person else None,
        "first_seen": f["first_seen"], "source": sigs[-1]["source"] if sigs else "unknown",
        "links": links(sigs, entity_keys),
        "stage": state["stage"] if state else derive_stage(conn, fid, brief, rs, thesis.name),
        "next_step": state["next_step"] if state else "",
        "stage_set_by_user": bool(state),
        "run_state": rs,
        "decision": brief["decision"], "recommendation": brief["recommendation"],
        "killed_reason": kill["reason"] if kill else None,
        "axes": brief["axes"], "score": cur["score"], "coverage": cur["coverage"],
        "dimensions": cur.get("dimensions", {}),
        "score_history": stored["history"] if stored else [],
        "facts": facts(sigs), "signals": sigs,
        "evidence": grouped, "claims": claims, "gaps": brief["gaps"],
        "open_items": rec.get("open_items", []),
        "memo_md": brief["memo_md"],
        "bull": memo["bull"] if memo else None, "bear": memo["bear"] if memo else None,
        "memo_at": memo["created_at"] if memo else None,
        "outreach": [dict(o) for o in outreach],
    }
