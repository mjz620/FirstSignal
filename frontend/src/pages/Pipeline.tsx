import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { DiscoverItem } from "../api";
import { Err, Skeleton } from "../components";

/* Pipeline — "what's on my plate". One table, sectioned by stage, active work first:
   every stage is visible at a glance instead of three columns and a scroll. "New" is
   the untriaged bucket (Discover's job), so it sits collapsed at the bottom. Stages
   are yours to move; until you do, a company sits where the pipeline's output puts it. */
const SECTIONS: [string, string, boolean][] = [   // key, label, open by default
  ["diligence", "In diligence", true],
  ["decision", "Decision", true],
  ["researching", "Researching", true],
  ["invested", "Invested", true],
  ["passed", "Passed", false],
  ["new", "New — not yet triaged", false],
];
const STAGES = SECTIONS.map(([k, l]) => [k, l.split(" — ")[0]] as [string, string]);
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "—");

export default function Pipeline({ thesis, openCompany }:
  { thesis: string; openCompany: (id: string) => void }) {
  const [items, setItems] = useState<DiscoverItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(([k, , o]) => [k, o])));
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

  const rows = (st: string) => (items ?? []).filter((i) => i.stage === st && api.inThesis(i))
    .sort((a, b) => (b.latest ?? "").localeCompare(a.latest ?? ""));
  const active = SECTIONS.filter(([k]) => k !== "new" && k !== "passed")
    .reduce((n, [k]) => n + rows(k).length, 0);

  return (
    <div>
      <div className="page-h">
        <h1>Pipeline</h1>
        <p className="page-sub">
          What's on your plate under this thesis: <b>{items ? active : "…"}</b> companies in
          play. Move one with its stage menu; write the next step so tomorrow-you knows what to do.
        </p>
      </div>
      {err && <Err msg={err} />}
      {!items && !err && <Skeleton lines={6} />}
      {items && (
        <div className="tablewrap">
          <table className="funnel pipe">
            <thead>
              <tr><th>Company</th><th>What</th><th>Founder</th><th>Last activity</th><th>Verdict</th><th>Next step</th><th>Stage</th></tr>
            </thead>
            {SECTIONS.map(([st, label]) => {
              const r = rows(st);
              const isOpen = !!open[st];
              return (
                <tbody key={st} className={`pipe-sec ${isOpen ? "" : "closed"}`}>
                  <tr className="pipe-h">
                    <td colSpan={7}>
                      <button className="pipe-toggle" onClick={() => setOpen((o) => ({ ...o, [st]: !o[st] }))}
                        aria-expanded={isOpen}>
                        <span className="pipe-caret">{isOpen ? "▾" : "▸"}</span> {label}
                        <span className="count">{r.length}</span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && r.length === 0 && (
                    <tr><td colSpan={7} className="muted pipe-empty">nothing here</td></tr>
                  )}
                  {isOpen && r.map((it) => (
                    <tr key={it.id}>
                      <td className="fname"><button className="rowlink" onClick={() => openCompany(it.id)}>{it.company}</button></td>
                      <td className="pipe-what">{it.one_liner || <span className="muted">—</span>}</td>
                      <td className="muted">{it.person ?? "—"}</td>
                      <td className="muted pipe-date">{fmtDate(it.latest)}</td>
                      <td>{it.decision ? <span className={`badge ${it.decision}`}>{it.decision}</span>
                        : it.researched ? <span className="muted">screened</span> : <span className="muted">—</span>}</td>
                      <td className="pipe-next">
                        <input className="filter" placeholder="…" defaultValue={it.next_step} disabled={busy === it.id}
                          aria-label={`next step for ${it.company}`}
                          onBlur={(e) => { if (e.target.value !== it.next_step) save(it, it.stage, e.target.value); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                      </td>
                      <td>
                        <select className="control pipe-move" value={it.stage} disabled={busy === it.id}
                          aria-label={`move ${it.company}`} onChange={(e) => save(it, e.target.value, it.next_step)}>
                          {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}
