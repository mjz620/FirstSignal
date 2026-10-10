import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { DiscoverItem } from "../api";
import { Err, Skeleton } from "../components";

/* Pipeline — "what's on my plate": every company by stage, with its verdict, last
   activity and the next step you wrote down. Stages are yours to move; until you do,
   a company sits where the pipeline's own output puts it. */
const COLS: [string, string][] = [
  ["new", "New"], ["researching", "Researching"], ["diligence", "In diligence"],
  ["decision", "Decision"], ["invested", "Invested"], ["passed", "Passed"],
];
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "—");
const CAP = 12;

export default function Pipeline({ thesis, openCompany }:
  { thesis: string; openCompany: (id: string) => void }) {
  const [items, setItems] = useState<DiscoverItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getDiscover(thesis).then((r) => setItems(r.items)).catch((e) => setErr(e.message));
  }, [thesis]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const save = async (it: DiscoverItem, stage: string, next_step: string) => {
    setBusy(it.id);
    try {
      await api.setCompanyState(it.id, stage, next_step);
      setItems((prev) => prev && prev.map((x) => x.id === it.id ? { ...x, stage, next_step, stage_set_by_user: true } : x));
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };

  const byStage = (st: string) => (items ?? []).filter((i) => i.stage === st && api.inThesis(i))
    .sort((a, b) => (b.latest ?? "").localeCompare(a.latest ?? ""));

  return (
    <div>
      <div className="page-h">
        <h1>Pipeline</h1>
        <p className="page-sub">
          Companies that belong to this thesis, by stage. Move a company with its stage
          menu; write the next step on the card so tomorrow-you knows what to do.
        </p>
      </div>
      {err && <Err msg={err} />}
      {!items && !err && <Skeleton lines={6} />}
      {items && (
        <div className="board">
          {COLS.map(([st, label]) => {
            const col = byStage(st);
            const show = expanded[st] ? col : col.slice(0, CAP);
            return (
              <section key={st} className="board-col">
                <header className="board-h">{label} <span className="count">{col.length}</span></header>
                {col.length === 0 && <p className="muted board-empty">—</p>}
                {show.map((it) => (
                  <article key={it.id} className="board-card">
                    <div className="board-title">
                      <button className="rowlink" onClick={() => openCompany(it.id)}>{it.company}</button>
                      {it.decision && <span className={`badge ${it.decision}`}>{it.decision}</span>}
                    </div>
                    {it.one_liner && <p className="board-one">{it.one_liner.length > 90 ? it.one_liner.slice(0, 90) + "…" : it.one_liner}</p>}
                    <div className="board-meta muted">
                      {it.person && <span>{it.person} · </span>}last activity {fmtDate(it.latest)}
                    </div>
                    <input className="filter board-next" placeholder="Next step…" defaultValue={it.next_step}
                      disabled={busy === it.id}
                      onBlur={(e) => { if (e.target.value !== it.next_step) save(it, it.stage, e.target.value); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    <select className="control board-move" value={it.stage} disabled={busy === it.id}
                      aria-label={`move ${it.company}`}
                      onChange={(e) => save(it, e.target.value, it.next_step)}>
                      {COLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </article>
                ))}
                {col.length > CAP && (
                  <button className="linkbtn" onClick={() => setExpanded((x) => ({ ...x, [st]: !x[st] }))}>
                    {expanded[st] ? "show fewer" : `show all ${col.length}`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
