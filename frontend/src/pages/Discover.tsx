import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { DiscoverItem, RunStatus } from "../api";
import { Err, Skeleton } from "../components";

/* Discover — the investor's triage feed. One row per company answering "why should
   I look at this?" in plain words: what it is, why it surfaced, why it fits the
   thesis, when it was first seen. Inbound and outbound sit together, tagged.
   Scanner controls and channel yield live on the Sources page; nothing here is a
   system-health number. Keyboard: j/k move, t track, p pass, r research, enter open. */
const STAGE_LABEL: Record<string, string> = {
  new: "New", researching: "Tracking", diligence: "In diligence",
  decision: "Decided", invested: "Invested", passed: "Passed",
};
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "—");

export default function Discover({ thesis, openCompany }:
  { thesis: string; openCompany: (id: string) => void }) {
  const [items, setItems] = useState<DiscoverItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hidePassed, setHidePassed] = useState(true);
  const [onlyNew, setOnlyNew] = useState(false);
  const [allCompanies, setAllCompanies] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getDiscover(thesis).then((r) => setItems(r.items)).catch((e) => setErr(e.message));
  }, [thesis]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const visible = (items ?? []).filter((i) =>
    (allCompanies || api.inThesis(i)) && (!hidePassed || i.stage !== "passed") && (!onlyNew || i.stage === "new"));
  const outside = (items ?? []).filter((i) => !api.inThesis(i)).length;

  const setStage = async (it: DiscoverItem, stage: string) => {
    setBusy(it.id);
    try {
      await api.setCompanyState(it.id, stage, "");
      setItems((prev) => prev && prev.map((x) => x.id === it.id ? { ...x, stage, stage_set_by_user: true } : x));
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };
  const research = async (it: DiscoverItem) => {
    setBusy(it.id);
    try {
      await api.postDiligence(it.id, thesis);
      setItems((prev) => prev && prev.map((x) => x.id === it.id ? { ...x, stage: "diligence" } : x));
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey) return;
      const it = visible[cursor];
      if (e.key === "j") setCursor((c) => Math.min(c + 1, visible.length - 1));
      else if (e.key === "k") setCursor((c) => Math.max(c - 1, 0));
      else if (it && e.key === "t") setStage(it, "researching");
      else if (it && e.key === "p") setStage(it, "passed");
      else if (it && e.key === "r") research(it);
      else if (it && e.key === "Enter") openCompany(it.id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="page-h">
        <h1>Discover</h1>
        <p className="page-sub">
          Companies that surfaced under this thesis, inbound and outbound together.
          Each row says why it surfaced and why it fits. Track what's worth a look, pass
          on the rest, research the ones that matter.
        </p>
      </div>
      <div className="disc-bar">
        <label className="disc-toggle"><input type="checkbox" checked={hidePassed}
          onChange={(e) => setHidePassed(e.target.checked)} /> hide passed</label>
        <label className="disc-toggle"><input type="checkbox" checked={onlyNew}
          onChange={(e) => setOnlyNew(e.target.checked)} /> only new</label>
        {outside > 0 && (
          <label className="disc-toggle" title="companies whose signals match none of this thesis's topics">
            <input type="checkbox" checked={allCompanies}
              onChange={(e) => setAllCompanies(e.target.checked)} /> show {outside} outside this thesis</label>
        )}
        <span className="count">{items ? `${visible.length} of ${items.length}` : ""}</span>
        <span className="disc-keys muted">j / k move · t track · p pass · r research · ↵ open</span>
        <button className="minibtn primary" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "+ Add company"}
        </button>
      </div>
      {adding && (
        <div className="block disc-add">
          <h3>Add a company</h3>
          <ApplyForm openMemo={(id) => { setAdding(false); load(); openCompany(id); }} />
        </div>
      )}
      {err && <Err msg={err} />}
      {!items && !err && <Skeleton lines={8} />}
      {items && visible.length === 0 && (
        <p className="empty">Nothing matches this thesis yet — scan a source on the Sources page, add a company, or show the companies outside it.</p>
      )}
      <div className="disc-list">
        {visible.map((it, i) => (
          <article key={it.id} className={`disc-row ${i === cursor ? "cur" : ""} ${it.stage === "passed" ? "passed" : ""}`}
            onMouseEnter={() => setCursor(i)}>
            <div className="disc-main">
              <div className="disc-title">
                <button className="rowlink disc-name" onClick={() => openCompany(it.id)}>{it.company}</button>
                {it.person && <span className="muted">· {it.person}</span>}
                <span className="pill">{it.origin}</span>
                {it.decision && <span className={`badge ${it.decision}`}>{it.decision}</span>}
                {it.stage !== "new" && !it.decision && <span className="disc-stage">{STAGE_LABEL[it.stage]}</span>}
              </div>
              <p className="disc-one">{it.one_liner || <span className="muted">no description on record</span>}</p>
              <p className="disc-why">
                <b>Why:</b> {it.origin_url ? <a href={it.origin_url} target="_blank" rel="noreferrer">{it.why} ↗</a> : it.why}
                {it.signal_count > 1 && <span className="muted"> · {it.signal_count} signals</span>}
                <span className="disc-sep">·</span>
                <b>Fits:</b> {it.fit.length ? it.fit.join(", ") : <span className="muted">no thesis topic in its signals</span>}
              </p>
            </div>
            <div className="disc-side">
              <div className="disc-score">
                {it.researched && it.score != null
                  ? <><b>{it.score}</b><span className="muted">/10 · evidence {Math.round((it.coverage ?? 0) * 100)}%</span></>
                  : <span className="muted">Not researched yet</span>}
              </div>
              <div className="disc-seen muted">first seen {fmtDate(it.first_seen)}</div>
              <div className="disc-acts">
                {it.stage !== "researching" && it.stage !== "passed" && (
                  <button className="minibtn" disabled={busy === it.id} onClick={() => setStage(it, "researching")}>Track</button>
                )}
                {it.stage !== "passed" && (
                  <button className="minibtn" disabled={busy === it.id} onClick={() => setStage(it, "passed")}>Pass</button>
                )}
                {it.stage === "passed" && (
                  <button className="minibtn" disabled={busy === it.id} onClick={() => setStage(it, "new")}>Undo pass</button>
                )}
                {it.stage !== "diligence" && (
                  <button className="minibtn primary" disabled={busy === it.id} onClick={() => research(it)}>Research</button>
                )}
                {it.stage === "diligence" && <span className="runline pulse">researching…</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const STATUS_MARK: Record<string, string> = { ok: "✓", error: "✗", running: "…", queued: "·" };
const RUN_STAGE_LABEL: Record<string, string> = {
  ingest: "Ingest deck", screen: "Screen — 3 axes",
  news: "News research (Tavily)", market: "Market research (Tavily)",
  extract: "Extract claims", adjudicate: "Adjudicate contested claims",
  debate: "Bull/bear debate", synthesize: "Synthesize memo", done: "Done",
};

function ApplyForm({ openMemo }: { openMemo: (id: string) => void }) {
  const [company, setCompany] = useState("");
  const [deck, setDeck] = useState("");
  const [mode, setMode] = useState<"paste" | "pdf">("paste");
  const [pdf, setPdf] = useState<File | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [fid, setFid] = useState<string | null>(null);
  const [run, setRun] = useState<RunStatus | null>(null);

  const ready = company.trim() !== "" && (mode === "pdf" ? pdf !== null : deck.trim() !== "");

  const submit = async () => {
    setState(mode === "pdf"
      ? "parsing deck + submitting… (screening runs before this returns)"
      : "submitting… (screening runs before this returns)");
    setFid(null); setRun(null);
    try {
      const r = mode === "pdf"
        ? await api.postApplyPdf(company, pdf!)
        : await api.postApply(company, deck);
      setState(r.screen_error
        ? `⚠ ${r.founder_id}: ${r.screen_error}`
        : r.killed
          ? `application ${r.founder_id} screened — killed at first pass (see run below)`
          : `application ${r.founder_id} ingested + screened — full diligence running`);
      setFid(r.founder_id);
    } catch (e) {
      setState(`⚠ ${(e as Error).message}`);
    }
  };

  // Poll the run every 1.5s until it reaches done/error — a watchable pipeline.
  useEffect(() => {
    if (!fid) return;
    if (run && run.state !== "running") return;
    const t = setInterval(() => { api.getRun(fid).then(setRun).catch(() => {}); }, 1500);
    return () => clearInterval(t);
  }, [fid, run]);

  return (
    <div className="apply">
      <p className="muted" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
        Deck + company name is the whole bar — over-collecting works against you.
      </p>
      <input className="filter" placeholder="Company name" value={company}
        onChange={(e) => setCompany(e.target.value)} />
      <div style={{ display: "flex", gap: 6, margin: "0 0 8px" }}>
        {(["paste", "pdf"] as const).map((m) => (
          <button key={m} className={`minibtn${mode === m ? " primary" : ""}`}
            onClick={() => setMode(m)}>
            {m === "paste" ? "Paste text" : "Upload PDF"}
          </button>
        ))}
      </div>
      {mode === "paste" ? (
        <textarea className="filter" rows={6} placeholder="Paste deck text / summary…"
          value={deck} onChange={(e) => setDeck(e.target.value)} />
      ) : (
        <>
          <input className="filter" type="file" accept="application/pdf,.pdf"
            onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
          <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
            Text is extracted verbatim and stored as a self-reported signal — nothing
            is summarized on the way in. Image-only decks are rejected, not guessed at.
          </p>
        </>
      )}
      <button className="minibtn primary" onClick={submit}
        disabled={!ready}>Submit application</button>
      {state && <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>{state}</div>}
      {fid && run && (
        <div style={{ marginTop: 10 }}>
          {run.stages.map((s) => (
            <div key={s.stage}
              className={s.status === "running" ? "runline pulse" : "muted"}
              style={{ fontSize: 12.5 }}>
              {STATUS_MARK[s.status] || "·"} {RUN_STAGE_LABEL[s.stage] || s.stage} — {s.status}
              {s.detail ? ` — ${s.detail}` : ""}
            </div>
          ))}
          {run.state === "ok" && run.has_memo && (
            <button className="minibtn primary" style={{ marginTop: 8 }}
              onClick={() => openMemo(fid)}>Open memo &amp; decision →</button>
          )}
        </div>
      )}
    </div>
  );
}
