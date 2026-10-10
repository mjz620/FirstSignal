import { useEffect, useState } from "react";
import * as api from "../api";
import type { Company as Co } from "../api";
import { ClaimRow, Err, Memo, Meters, Skeleton, StanceWord, TracePanel } from "../components";

/* The Company page — the centre of the app. Every company name links here. One
   aggregate call; the LLM summary loads separately so the page never waits on a model.
   Nothing here is generated: a fact with no signal behind it reads "not on record". */
export type CoTab = "overview" | "evidence" | "memo" | "signals";

const STAGE_LABEL: Record<string, string> = {
  new: "New", researching: "Researching", diligence: "In diligence",
  decision: "Decision", invested: "Invested", passed: "Passed",
};
const DIM_LABEL: Record<string, string> = {
  execution_velocity: "Execution velocity", community_pull: "Community pull",
  domain_breadth: "Domain breadth", integrity: "Integrity", verified_depth: "Verified depth",
};
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "—");

export default function CompanyPage({ id, thesis, tab, setTab, openLedger, openMemo }: {
  id: string; thesis: string; tab: CoTab; setTab: (t: CoTab) => void;
  openLedger: (id: string) => void; openMemo: (id: string) => void;
}) {
  const [co, setCo] = useState<Co | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ headline: string; summary: string } | null | "none">(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.getCompany(id, thesis).then(setCo).catch((e) => setErr(e.message));
  useEffect(() => { setCo(null); setErr(null); setSummary(null); load(); }, [id, thesis]); // eslint-disable-line
  useEffect(() => {
    api.getFounderSummary(id, thesis).then((s) => setSummary(s.summary ?? "none")).catch(() => setSummary("none"));
  }, [id, thesis]);

  // A diligence run started here is polled until it settles, then the page reloads.
  useEffect(() => {
    if (co?.run_state !== "running") return;
    const t = setInterval(() => {
      api.getRun(id).then((r) => { if (r.state !== "running") { clearInterval(t); load(); } }).catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [co?.run_state, id]); // eslint-disable-line

  if (err) return <Err msg={err} />;
  if (!co) return <Skeleton lines={8} />;

  const setStage = async (stage: string, next_step = co.next_step) => {
    setBusy("stage");
    try { await api.setCompanyState(id, stage, next_step); await load(); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };
  const research = async () => {
    setBusy("research");
    try { await api.postDiligence(id, thesis); await load(); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };
  const draft = async () => {
    setBusy("draft");
    try { await api.postActivate(id, thesis); await load(); setTab("overview"); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };

  const verdict = co.decision ?? (co.killed_reason ? "pass" : null);
  const tabs: [CoTab, string][] = [["overview", "Overview"], ["evidence", `Evidence${co.claims.length ? ` · ${co.claims.length}` : ""}`],
    ["memo", co.memo_md ? "Memo" : "Memo · none yet"], ["signals", `Signals · ${co.signals.length}`]];

  return (
    <div className="co">
      <header className="co-head">
        <div className="co-title-row">
          <h1 className="co-title">{co.company}</h1>
          {verdict && <span className={`badge ${verdict}`}>{verdict}</span>}
          <span className="pill">{co.source === "deck" ? "applied" : `found via ${co.source}`}</span>
        </div>
        <p className="co-one">
          {summary === null ? <span className="muted">summarising…</span>
            : summary === "none" ? <span className="muted">No summary on record — summaries need a model or a cached run.</span>
            : summary.headline}
        </p>
        <div className="co-meta">
          {co.person && <span>Founder <b>{co.person}</b></span>}
          <span>First seen {fmtDate(co.first_seen)}</span>
          {co.links.map((l) => (
            <a key={l.url} className="domchip" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>
          ))}
        </div>
        <div className="co-actions">
          <label className="co-stage">Stage
            <select className="control" value={co.stage} disabled={busy === "stage"}
              onChange={(e) => setStage(e.target.value)}>
              {api.STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
            {!co.stage_set_by_user && <span className="muted co-hint">derived from the pipeline</span>}
          </label>
          {co.run_state === "running" ? (
            <span className="runline pulse">diligence running…</span>
          ) : (
            <button className="minibtn primary" onClick={research} disabled={busy !== null}>
              {co.memo_md ? "Re-run diligence" : "Start diligence"}
            </button>
          )}
          {co.stage !== "passed" && (
            <button className="minibtn" onClick={() => setStage("passed")} disabled={busy !== null}>Pass</button>
          )}
        </div>
      </header>

      <nav className="co-tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`co-tab ${tab === k ? "on" : ""}`}
            onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {tab === "overview" && <Overview co={co} summary={summary} draft={draft} research={research} busy={busy} />}
      {tab === "evidence" && (
        co.evidence.length === 0
          ? <p className="empty">No claim ledger yet — diligence hasn\u2019t run for this company.</p>
          : co.evidence.map((g) => (
            <section key={g.axis} className="block">
              <h3>{g.question} <span className="count">{g.claims.length}</span></h3>
              {g.claims.map((c) => (
                <ClaimRow key={c.id} c={c} active={traceId === c.id} onClick={() => setTraceId(c.id)} />
              ))}
            </section>
          ))
      )}
      {tab === "evidence" && co.claims.length > 0 && (
        <button className="minibtn" onClick={() => openLedger(id)}>Full claim ledger with contradictions →</button>
      )}
      {tab === "memo" && <MemoTab co={co} onCite={setTraceId} openMemo={openMemo} />}
      {tab === "signals" && (
        <ol className="tl">
          {co.signals.map((s) => (
            <li key={s.id} className="tl-item">
              <span className="tl-date">{fmtDate(s.observed_at)}</span>
              <span className="pill">{s.source}</span>
              <span className="tl-text">{s.content.length > 240 ? s.content.slice(0, 240) + "…" : s.content}</span>
              {s.url && s.url.startsWith("http") && (
                <a className="domchip" href={s.url} target="_blank" rel="noreferrer">source ↗</a>
              )}
            </li>
          ))}
        </ol>
      )}
      {traceId && <TracePanel founderId={id} claimId={traceId} onClose={() => setTraceId(null)} />}
    </div>
  );
}

function Overview({ co, summary, draft, research, busy }: {
  co: Co; summary: { headline: string; summary: string } | null | "none";
  draft: () => void; research: () => void; busy: string | null;
}) {
  const gaps = co.gaps.filter((g) => g.status === "gap");
  const missing = ["Founded", "Location", "Raising status"];  // never on record today — said so
  return (
    <div className="co-grid">
      <div>
        <section className="block">
          <h3>Summary</h3>
          {summary && summary !== "none"
            ? <p>{summary.summary}</p>
            : <p className="muted">Not on record.</p>}
          {co.killed_reason && <p className="muted">Killed at first-pass screen: {co.killed_reason}</p>}
          <table className="kv">
            <tbody>
              {co.facts.map((f) => (
                <tr key={f.label}>
                  <td className="kv-k">{f.label}</td>
                  <td className="kv-v">{f.value.toLocaleString()}</td>
                  <td className="kv-s">{f.url ? <a href={f.url} target="_blank" rel="noreferrer">{fmtDate(f.observed_at)} ↗</a> : fmtDate(f.observed_at)}</td>
                </tr>
              ))}
              {missing.map((m) => (
                <tr key={m}><td className="kv-k">{m}</td><td className="kv-v muted" colSpan={2}>not on record</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="block">
          <h3>Gaps &amp; open questions</h3>
          {gaps.length === 0 && co.open_items.length === 0 && (
            <p className="muted">{co.claims.length ? "Nothing flagged." : "Nothing checked yet — run diligence."}</p>
          )}
          {gaps.map((g) => <p key={g.field} className="gapline">⚠ {g.rendered}</p>)}
          {co.open_items.map((o) => <p key={o} className="gapline">☐ {o}</p>)}
          {(gaps.length > 0 || co.open_items.length > 0) && (
            <div className="co-gap-acts">
              <button className="minibtn" onClick={draft} disabled={busy !== null}>Draft email to founder</button>
              <button className="minibtn" onClick={research} disabled={busy !== null}>Run more research</button>
            </div>
          )}
          {co.outreach.map((o) => (
            <details key={o.created_at} className="co-outreach">
              <summary>Drafted: {o.subject}</summary>
              <pre className="outreach-body">{o.body}</pre>
            </details>
          ))}
        </section>
      </div>

      <div>
        <section className="block">
          <h3>People</h3>
          <p><b>{co.person ?? co.company}</b></p>
          <Meters signal={co.score} coverage={co.coverage} founderId={co.id} />
          <table className="kv">
            <tbody>
              {Object.entries(co.dimensions).map(([k, v]) => (
                <tr key={k}><td className="kv-k">{DIM_LABEL[k] ?? k}</td><td className="kv-v">{v}</td></tr>
              ))}
              <tr><td className="kv-k">Background</td><td className="kv-v muted">not on record</td></tr>
              <tr><td className="kv-k">Prior companies</td><td className="kv-v muted">not on record</td></tr>
            </tbody>
          </table>
        </section>
        <section className="block">
          <h3>Screening under this thesis</h3>
          {co.axes.every((a) => a.score == null)
            ? <p className="muted">Not yet screened.</p>
            : co.axes.map((a) => (
              <p key={a.axis} className="co-axis">
                <b>{a.axis}</b> {a.score != null ? `${a.score}/10` : "—"} <StanceWord s={a.stance} />
                {a.rationale && <span className="muted co-axis-why"> — {a.rationale}</span>}
              </p>
            ))}
        </section>
      </div>
    </div>
  );
}

function MemoTab({ co, onCite, openMemo }: { co: Co; onCite: (id: string) => void; openMemo: (id: string) => void }) {
  if (!co.memo_md) return <p className="empty">No memo yet — run diligence to produce one.</p>;
  const rec = co.recommendation ?? {};
  const d = co.decision ?? "none";
  return (
    <div>
      <div className="verdict-row">
        <span className={`verdict ${d}`}>{d}</span>
        {rec.amount_usd != null && <span className="verdict-amt"><b>${rec.amount_usd.toLocaleString()}</b> check</span>}
      </div>
      {d === "conditional" && co.open_items.length > 0 && (
        <section className="block">
          <h3>Invest once:</h3>
          {co.open_items.map((o) => <p key={o} className="gapline">☐ {o}</p>)}
          {rec.what_would_change_our_mind && <p className="muted">What would change our mind: {rec.what_would_change_our_mind}</p>}
        </section>
      )}
      {d !== "conditional" && rec.what_would_change_our_mind && (
        <p><b>What would change our mind:</b> {rec.what_would_change_our_mind}</p>
      )}
      <div className="co-grid">
        {co.bull && <section className="block"><h3>Bull case</h3><p className="co-case">{co.bull}</p></section>}
        {co.bear && <section className="block"><h3>Bear case</h3><p className="co-case">{co.bear}</p></section>}
      </div>
      <Memo md={co.memo_md} onCite={onCite} />
      <button className="minibtn" onClick={() => openMemo(co.id)}>Full memo &amp; decision page →</button>
    </div>
  );
}
