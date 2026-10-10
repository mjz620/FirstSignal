import { ReactNode, useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { FounderSummary, Methodology, ScorePoint, Trace } from "./api";

export const TREND: Record<string, string> = { improving: "↑", declining: "↓", stable: "→" };
/* A screen reader announces a bare Unicode arrow as "upwards arrow", not "improving" —
   wrap every TREND glyph render in this so the word is always available to AT.
   "new" (one score on record, no trend yet) is written as the word: a glyph for it
   reads like a rating. */
export function TrendGlyph({ trend }: { trend?: string }) {
  const t = trend || "new";
  if (!TREND[t]) return null;  // one score on record: no trend to show, no label either
  return <span aria-label={t} title={t}>{TREND[t]}</span>;
}
/* Plain words for the rubric's stance enum. The stored value stays verbatim; this is
   display only, with the one-sentence meaning in a tooltip. */
const STANCE_WORD: Record<string, [string, string]> = {
  strong: ["strong", "founder evidence supports a strong team"],
  mixed: ["mixed", "founder evidence cuts both ways"],
  weak: ["weak", "founder evidence is thin or negative"],
  bullish: ["tailwind", "market evidence favours this category"],
  neutral: ["neutral", "market evidence is inconclusive"],
  bear: ["headwind", "market evidence works against this category"],
  survives: ["holds up", "the idea holds up against the market as evidenced"],
  "pivot-bet": ["needs a pivot", "the idea only works if the company pivots from what the evidence shows"],
};
export function stanceWord(s?: string): string { return s ? (STANCE_WORD[s]?.[0] ?? s) : ""; }
export function StanceWord({ s }: { s?: string }) {
  if (!s) return null;
  const [w, tip] = STANCE_WORD[s] ?? [s, s];
  return <em className="stance" title={tip}>{w}</em>;
}
export const AXES = ["founder", "market", "idea"] as const;
export const AXLABEL: Record<string, string> = { founder: "Founder", market: "Market", idea: "Idea vs Mkt" };

export function stanceClass(s?: string): string {
  if (!s) return "";
  if (/bullish|strong|survives|corroborated/i.test(s)) return "good";
  if (/bear|weak|contradicted/i.test(s)) return "bad";
  return "mid";
}
/* one tier color language, used identically on every page */
export function tierClass(t?: string): string {
  if (!t) return "";
  if (t === "corroborated") return "tier-corr";
  if (t === "single_source") return "tier-single";
  if (t === "self_reported") return "tier-self";
  if (t === "contradicted") return "tier-contra";
  return "tier-inferred";
}
/* One tier vocabulary on every surface — the same words the memo prints. */
export const TIER_SHORT: Record<string, string> = {
  corroborated: "corroborated", single_source: "single-source", self_reported: "self-reported",
  contradicted: "contradicted", inferred: "inferred",
};
export function TierChip({ tier, trust }: { tier: string; trust?: number }) {
  return (
    <span className={`tierchip ${tierClass(tier)}`}>
      {trust != null ? `${trust.toFixed(2)} · ` : ""}{TIER_SHORT[tier] || tier}
    </span>
  );
}

/* ---- evidence source identity ------------------------------------------ */
/* file:// and application:// (pitch-deck) URLs are records, not links —
   they must never render as dead <a> tags. */
export function sourceDomain(url?: string | null): { label: string; href: string | null } {
  if (!url) return { label: "no source url", href: null };
  if (url.startsWith("file://") || url.startsWith("application://"))
    return { label: "pitch deck", href: null };
  try {
    return { label: new URL(url).hostname.replace(/^www\./, ""), href: url };
  } catch {
    return { label: url, href: null };
  }
}
export function DomainChip({ url }: { url?: string | null }) {
  const d = sourceDomain(url);
  return d.href
    ? <a className="domchip" href={d.href} target="_blank" rel="noreferrer">{d.label}</a>
    : <span className="domchip deck">{d.label}</span>;
}

/* ---- Founder Score sparkline (inline SVG, no library) -------------------- */
/* One point renders a flat tick — never a fake trend. Tooltip = trigger + date. */
export function Sparkline({ history, width = 96, height = 26 }:
  { history: ScorePoint[]; width?: number; height?: number }) {
  if (history.length < 2) return null;  // a single dot is not a trend
  if (!history?.length) return null;
  const pad = 4;
  const tip = (p: ScorePoint) => `${p.trigger} · ${p.timestamp.slice(0, 10)} · score ${p.score}`;
  if (history.length === 1) {
    return (
      <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
        role="img" aria-label="score history: one point on record">
        <title>{tip(history[0])}</title>
        <line x1={width / 2 - 8} x2={width / 2 + 8} y1={height / 2} y2={height / 2} />
        <circle cx={width / 2} cy={height / 2} r={2.5} />
      </svg>
    );
  }
  const scores = history.map((h) => h.score);
  const min = Math.min(...scores), max = Math.max(...scores);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (history.length - 1);
  const y = (s: number) => height - pad - ((s - min) / span) * (height - 2 * pad);
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label={`score history, ${history.length} points`}>
      <polyline points={history.map((h, i) => `${x(i)},${y(h.score)}`).join(" ")} />
      {history.map((h, i) => (
        <circle key={i} cx={x(i)} cy={y(h.score)} r={2.5}>
          <title>{tip(h)}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ---- InfoTip: "how is this computed" — the real formula, sourced live from
   the backend's own constants, never a hand-typed paraphrase that could drift. */
type InfoKind = "signal" | "coverage" | "axis" | "trust" | "fscore";
export function InfoTip({ kind, axis, founderId }: {
  kind: InfoKind; axis?: string; founderId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<Methodology | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (open && !m && !err) {
      api.getMethodology(founderId).then(setM).catch((e) => setErr(e.message));
    }
  }, [open, founderId, m, err]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="infotip" ref={ref}>
      <button type="button" className="infotip-btn"
        aria-label={`how is ${axis || kind} computed`} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v); }}>
        ⓘ
      </button>
      {open && (
        <div className="infotip-pop" role="dialog" aria-label="scoring methodology"
          onClick={(e) => e.stopPropagation()}>
          {err && <Err msg={err} />}
          {!m && !err && <Skeleton lines={3} />}
          {m && <InfoTipBody kind={kind} axis={axis} m={m} />}
        </div>
      )}
    </span>
  );
}

function InfoTipBody({ kind, axis, m }: { kind: InfoKind; axis?: string; m: Methodology }) {
  const forFounder = m.for_founder;
  if (kind === "fscore") {
    /* "F-Score" is the Founder Score — the same number the Signal meter shows. The
       tooltip says so outright rather than leaving the abbreviation to be guessed. */
    return (
      <>
        <InfoTipBody kind="signal" m={m} />
        <p className="it-p">This is the <b>Founder Score</b>, the same value as the Signal
          meter. The sparkline beside it is the append-only history: one point per
          re-score, hover a point for the event that triggered it. Memory never
          overwrites a past score, so improvement shows up as a trend rather than a
          silently-replaced number.</p>
      </>
    );
  }
  if (kind === "signal") {
    const sig = m.signal;
    const fd = forFounder?.signal.dimensions;
    return (
      <>
        <div className="it-h">{sig.name}</div>
        <p className="it-p">{sig.what_it_is}</p>
        <div className="it-formula">{sig.formula}</div>
        {fd ? (
          <table className="it-table">
            <tbody>
              {fd.map((d) => (
                <tr key={d.name} className={d.assessed ? "" : "muted"}>
                  <td>{d.name.replace(/_/g, " ")}</td>
                  <td className="it-num">{d.assessed ? d.value : "unassessed"}</td>
                  <td className="it-num">{d.assessed ? `×${d.renormalized_weight}` : `w=${d.weight}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="it-table">
            <tbody>
              {Object.entries(sig.dimensions).map(([k, desc]) => (
                <tr key={k}>
                  <td>{k.replace(/_/g, " ")} <em>w={sig.weights[k]}</em></td>
                  <td className="it-desc">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {fd && (
          <div className="it-note">
            these are THIS founder's actual numbers — click a founder's page for the
            per-dimension derivation shown here inline.
          </div>
        )}
      </>
    );
  }
  if (kind === "coverage") {
    const cov = m.coverage;
    const areas = forFounder?.coverage.areas;
    return (
      <>
        <div className="it-h">{cov.name}</div>
        <p className="it-p">{cov.what_it_is}</p>
        <div className="it-formula">{cov.formula}</div>
        <ul className="it-areas">
          {(areas || cov.areas.map((a) => ({ area: a, covered: undefined }))).map((a) => (
            <li key={a.area} className={a.covered === undefined ? "" : a.covered ? "good" : "bad"}>
              {a.covered === true ? "✓ " : a.covered === false ? "✗ " : "· "}{a.area}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (kind === "trust") {
    const t = m.trust;
    return (
      <>
        <div className="it-h">{t.name}</div>
        <p className="it-p">{t.what_it_is}</p>
        <table className="it-table">
          <tbody>
            {Object.entries(t.rubric).map(([tier, val]) => (
              <tr key={tier} className={t.contested_tiers.includes(tier) ? "" : "muted"}>
                <td>{tier.replace(/_/g, " ")}{t.contested_tiers.includes(tier) ? " *" : ""}</td>
                <td className="it-num">{val.toFixed(2)}</td>
                <td className="it-desc">{t.tier_definitions[tier]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="it-note">* contested tiers go to a prosecutor→defender→judge
          debate whose verdict overrides this rubric value.</div>
      </>
    );
  }
  // axis
  const ax = m.axes;
  const rub = axis ? ax.rubrics[axis] : null;
  return (
    <>
      <div className="it-h">{AXLABEL[axis || ""] || ax.name} axis</div>
      <p className="it-p">{ax.what_it_is}</p>
      {rub && (
        <>
          <div className="it-note">scored by {rub.model} against this rubric:</div>
          <pre className="it-rubric">{rub.rubric}</pre>
        </>
      )}
    </>
  );
}

/* ---- Signal / Coverage: TWO meters, deliberately never one number -------- */
/* ---- FounderPeek: "what are they actually building?" — the concrete answer behind
   an abstract cell like "2 topics · 1 sig". An LLM summary grounded in the founder's
   raw signals, with those signals listed underneath so the summary stays checkable.
   The trigger sits inside .tablewrap (overflow-x: auto), which would clip an absolute
   popover — so the panel is position: fixed, placed from the trigger's rect. */
export function FounderPeek({ fid, thesis, label, title }: {
  fid: string; thesis: string; label: ReactNode; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [d, setD] = useState<FounderSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !d && !err) {
      api.getFounderSummary(fid, thesis).then(setD).catch((e) => setErr(e.message));
    }
  }, [open, fid, thesis, d, err]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // A fixed panel would detach from its trigger on scroll/resize — close instead.
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const W = 380;
      setPos({
        top: Math.min(r.bottom + 6, window.innerHeight - 80),
        left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - W - 8)),
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button type="button" ref={btnRef} className="peek-btn" aria-expanded={open}
        title={title || "what are they building?"}
        onClick={(e) => { e.stopPropagation(); toggle(); }}>
        {label}
      </button>
      {open && pos && (
        <div ref={popRef} className="peek-pop" role="dialog"
          aria-label="what this founder is building"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}>
          {err && <Err msg={err} />}
          {!d && !err && <Skeleton lines={3} />}
          {d && <PeekBody d={d} />}
        </div>
      )}
    </>
  );
}

function PeekBody({ d }: { d: FounderSummary }) {
  return (
    <>
      <div className="peek-name">{d.name}</div>
      {d.summary ? (
        <>
          <div className="peek-headline">{d.summary.headline}</div>
          <p className="peek-summary">{d.summary.summary}</p>
        </>
      ) : (
        <p className="peek-nosum">
          No generated summary — no LLM key set and nothing cached for this founder.
          The raw signals below are the source record.
        </p>
      )}
      <div className="peek-sig-h">
        {d.signal_count} signal{d.signal_count === 1 ? "" : "s"} behind this
      </div>
      {d.signals.length === 0 && <p className="peek-nosum">No signals resolved yet.</p>}
      <ul className="peek-sigs">
        {d.signals.map((s, i) => (
          <li key={i}>
            <div className="peek-sig-top">
              <span className="src">{s.source}</span>
              {s.source_url && (
                <a href={s.source_url} target="_blank" rel="noreferrer">source ↗</a>
              )}
            </div>
            <div className="peek-ex">{s.excerpt}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* One visual for the Founder Score and the evidence behind it. Below 30% evidence
   depth the score is greyed and tagged: 8.4 on a thin record is uncertain, not strong,
   and the reader should not have to work that out from two separate numbers. */
export const LOW_EVIDENCE = 0.3;
export function Meters({ signal, coverage, founderId }: {
  signal: number | null; coverage: number; founderId?: string;
}) {
  const pct = Math.round(coverage * 100);
  const low = coverage < LOW_EVIDENCE;
  return (
    <div className={`meters ${low ? "low" : ""}`}>
      <div className="meter" title={`Score ${signal ?? "—"}/10 from verified evidence · evidence depth ${pct}%`}>
        <span className="m-k">Score <InfoTip kind="signal" founderId={founderId} />
          {low && <span className="lowev" title={`only ${pct}% of the record is covered by evidence`}>low evidence</span>}
        </span>
        <span className="m-bar">
          <span style={{ width: `${((signal ?? 0) / 10) * 100}%` }} />
          <span className="m-ev" style={{ width: `${pct}%` }} title={`evidence depth ${pct}%`} />
        </span>
        <span className="m-v">{signal ?? "—"}<em>/10 · evidence {pct}%</em>
          <InfoTip kind="coverage" founderId={founderId} /></span>
      </div>
    </div>
  );
}

/* ---- click-to-evidence memo (multi-id brackets become one chip per id) --- */
const BRACKET = /\[([^\]]*\b[a-z]{2,5}-\d{1,3}\b[^\]]*)\]/g;
const ID = /\b([a-z]{2,5}-\d{1,3})\b/g;
/* A memo citation is "[team-01 · 0.10 · contradicted]" in the markdown. Rendered,
   it is a small tier-coloured chip carrying only the id — trust and tier live in the
   tooltip and in the trace rail one click away — so the serif prose stays readable.
   Adjacent groups ("[a, b] [b] [c]") merge into one run with each id cited once. */
function parseCite(seg: string, id: string): { trust?: string; tier?: string } {
  const parts = seg.split("·").map((p) => p.trim());
  if (parts.length >= 3) return { trust: parts[1], tier: parts[2] };
  if (parts.length === 2) return { trust: parts[1] };
  void id;
  return {};
}
export function inline(text: string, onCite: (id: string) => void,
  tiers?: Map<string, string>): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, k = 0;
  BRACKET.lastIndex = 0;
  let group: { id: string; trust?: string; tier?: string }[] = [];
  const flush = () => {
    if (!group.length) return;
    const seen = new Set<string>();
    const uniq = group.filter((c) => !seen.has(c.id) && seen.add(c.id));
    out.push(
      <span key={k++} className="citegroup">
        {uniq.map((c) => (
          <button key={c.id} className={`cite ${tierClass(c.tier)}`} onClick={() => onCite(c.id)}
            title={`${c.id}${c.trust ? ` · trust ${c.trust}` : ""}${c.tier ? ` · ${c.tier.replace(/_/g, " ")}` : ""} — open trace`}>
            {c.id}
          </button>
        ))}
      </span>,
    );
    group = [];
  };
  while ((m = BRACKET.exec(text))) {
    const between = text.slice(last, m.index);
    if (between.trim() !== "") { flush(); out.push(bold(between, k++)); }
    else if (between && !group.length) out.push(bold(between, k++));
    const segs = m[1].split(";");
    for (const seg of segs) {
      const ids = [...seg.matchAll(ID)].map((x) => x[1]);
      const meta = ids.length === 1 ? parseCite(seg, ids[0]) : {};
      for (const id of ids) group.push({ id, tier: tiers?.get(id), ...meta });
    }
    last = m.index + m[0].length;
  }
  flush();
  if (last < text.length) out.push(bold(text.slice(last), k++));
  return out;
}
function bold(t: string, key: number): ReactNode {
  const parts = t.split(/\*\*(.+?)\*\*/g);
  return <span key={key}>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</span>;
}

export function Memo({ md, onCite, tiers }: {
  md: string; onCite: (id: string) => void; tiers?: Map<string, string>;
}) {
  const cite = (t: string) => inline(t, onCite, tiers);
  return (
    <div className="memo">
      {md.split("\n").map((line, i) => {
        const t = line.trimEnd();
        if (t.startsWith("## ")) return <h2 key={i}>{cite(t.slice(3))}</h2>;
        if (t.startsWith("# ")) return <h2 key={i}>{cite(t.slice(2))}</h2>;
        if (t.startsWith("### ")) return <h3 key={i}>{cite(t.slice(4))}</h3>;
        if (t.startsWith("- ") || t.startsWith("* "))
          return <li key={i}>{cite(t.slice(2))}</li>;
        const ol = t.match(/^(\d{1,2})\.\s+(.*)/);  // ordered list: "1. …"
        if (ol) return (
          <div key={i} className="memo-oli">
            <b>{ol[1]}.</b><span className="memo-oli-body">{cite(ol[2])}</span>
          </div>
        );
        if (!t) return <div key={i} className="sp" />;
        return <p key={i}>{cite(t)}</p>;
      })}
    </div>
  );
}

/* ---- the trace panel: claim -> evidence -> signal -> how trust was set --- */
export function TracePanel({ founderId, claimId, onClose }:
  { founderId: string; claimId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDebate, setShowDebate] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setTrace(null); setErr(null); setShowDebate(false);
    api.getTraceCached(founderId, claimId).then(setTrace).catch((e) => setErr(e.message));
    // On narrow screens the rail stacks out of view; bring it to the user on open.
    // scrollIntoView's own `behavior` option ignores the CSS reduced-motion override,
    // so it's gated here explicitly.
    if (window.innerWidth <= 860) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [founderId, claimId]);
  // Esc closes the evidence rail — a keyboard exit from the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="evidence trace" role="complementary" aria-label="Evidence trace" ref={panelRef}>
      <button className="x" onClick={onClose} aria-label="Close evidence panel"
        title="Close (Esc)">×</button>
      {err && <Err msg={err} />}
      {!trace && !err && <Skeleton lines={6} />}
      {trace && (
        <>
          <div className="ev-id">{trace.claim.id}</div>
          <div style={{ margin: "4px 0 10px" }}>
            <TierChip tier={trace.claim.corroboration} trust={trace.claim.trust} />
            <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>{trace.claim.stance}</span>
          </div>
          <p className="ev-text">{trace.claim.text}</p>

          <div className="ev-label">How trust was set <InfoTip kind="trust" /></div>
          {trace.adjudication ? (
            <div className="tr-adj">
              <p className="ev-snip">
                rubric <s>{trace.rubric_trust.toFixed(2)}</s> → judge{" "}
                <b>{trace.adjudication.trust.toFixed(2)}</b>{" "}
                <TierChip tier={trace.adjudication.corroboration} />
              </p>
              <p className="ev-snip"><em>{trace.adjudication.rationale}</em></p>
              <button className="linkbtn" onClick={() => setShowDebate(!showDebate)}>
                {showDebate ? "hide" : "show"} prosecutor / defender transcript
              </button>
              {showDebate && (
                <div className="transcript">
                  <div className="t-role bad">Prosecutor</div>
                  <p>{trace.adjudication.prosecution}</p>
                  <div className="t-role good">Defender</div>
                  <p>{trace.adjudication.defense}</p>
                  <div className="t-role">Judge</div>
                  <p>{trace.adjudication.rationale}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="ev-snip">
              rubric-anchored: tier "{trace.claim.corroboration.replace(/_/g, " ")}" → trust {trace.claim.trust.toFixed(2)}
              {" "}(uncontested — no adjudication needed)
            </p>
          )}

          <div className="ev-label">Evidence</div>
          <div className="srccard">
            <div className="src-top">
              <DomainChip url={trace.claim.evidence_url} />
              {trace.claim.retrieved_at && (
                <span className="src-date">retrieved {trace.claim.retrieved_at.slice(0, 10)}</span>
              )}
            </div>
            {/* title, excerpt and raw signal are often the same sentence three times —
                show each only where it adds something the previous line didn't */}
            {trace.claim.evidence_title && !sameText(trace.claim.evidence_excerpt, trace.claim.evidence_title) && (
              <div className="src-title">{trace.claim.evidence_title}</div>
            )}
            {trace.claim.evidence_excerpt
              ? <blockquote className="src-quote">“{trace.claim.evidence_excerpt}”</blockquote>
              : <p className="ev-snip" style={{ margin: "6px 0 0" }}>{trace.claim.evidence}</p>}
          </div>

          <div className="ev-label">Source signal{trace.signals.length === 1 ? "" : "s"}</div>
          {trace.signals.length === 0 && (
            <p className="ev-snip">
              no raw signal on record — the source card above is the whole provenance
            </p>
          )}
          {trace.signals.map((s) => (
            <div key={s.id} className="tr-signal">
              <span className="src">{s.source}</span>
              <span className="tr-date">{(s.observed_at || s.ingested_at).slice(0, 10)}</span>
              {!sameText(trace.claim.evidence_excerpt, s.content) && (
                <p className="ev-snip">{s.content.length > 220 ? s.content.slice(0, 220) + "…" : s.content}</p>
              )}
              <a className="ev-src" href={s.source_url} target="_blank" rel="noreferrer">{s.source_url}</a>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

/* Two evidence strings are "the same" when one opens with the other's first
   80 characters — the title/excerpt/signal triplet is usually one sentence. */
function sameText(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const n = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const x = n(a), y = n(b);
  return x.startsWith(y.slice(0, 80)) || y.startsWith(x.slice(0, 80));
}

/* ---- one claim row, used by the ledger, the spotlight and the decision card --- */
export function ClaimRow({ c, active, onClick }: {
  c: { id: string; text: string; trust: number; corroboration: string; axis: string };
  active: boolean; onClick: () => void;
}) {
  return (
    <button className={`claimrow ${active ? "active" : ""}`} onClick={onClick}
      aria-label={`${c.id}, ${c.corroboration} — open full trace`}>
      <span className="cr-id">{c.id}</span>
      <TierChip tier={c.corroboration} trust={c.trust} />
      <span className="cr-axis">{c.axis}</span>
      <span className="cr-text">{c.text}</span>
    </button>
  );
}

/* Adjudication verdict one-liner, fetched only when the claim is clicked
   (shared trace cache — the panel and this line cost one request total). */
export function VerdictLine({ founderId, claimId }: { founderId: string; claimId: string }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  useEffect(() => {
    let live = true;
    setTrace(null);
    api.getTraceCached(founderId, claimId).then((t) => { if (live) setTrace(t); }).catch(() => {});
    return () => { live = false; };
  }, [founderId, claimId]);
  if (!trace) return <div className="claim-verdict">…</div>;
  if (!trace.adjudication) return <div className="claim-verdict">uncontested — rubric-anchored, no debate needed</div>;
  return (
    <div className="claim-verdict">
      judge: trust <b>{trace.rubric_trust.toFixed(2)} → {trace.adjudication.trust.toFixed(2)}</b>
      {" — "}{trace.adjudication.rationale}
    </div>
  );
}

/* Contradicted claims, pinned first on both Diligence and Decision. */
export function ContradictionSpotlight({ founderId, claims, total, traceId, onOpen }: {
  founderId: string;
  claims: { id: string; text: string; trust: number; corroboration: string; axis: string }[];
  total: number; traceId: string | null; onOpen: (id: string) => void;
}) {
  if (claims.length === 0) return null;
  return (
    <div className="spotlight">
      <div className="spot-head">
        <h2>⚠ Contradictions — read first</h2>
        <span className="spot-count">
          {claims.length} of {total} claims contradicted by external evidence · click one for the trace
        </span>
      </div>
      {claims.map((c) => (
        <div key={c.id}>
          <ClaimRow c={c} active={traceId === c.id} onClick={() => onOpen(c.id)} />
          {traceId === c.id && <VerdictLine founderId={founderId} claimId={c.id} />}
        </div>
      ))}
    </div>
  );
}

/* ---- evidence provenance graph (pure inline SVG, no library) -------------
   decision → the claims the recommendation turns on (tier-colored) → the
   evidence domains they rest on. Hover highlights a chain; click a claim
   opens its full trace. Contradicted claims are always shown. */
export function ProvenanceGraph({ decision, turnsOn, claims, totalClaims, onOpenClaim }: {
  decision: string;
  turnsOn: string[];
  claims: { id: string; text: string; corroboration: string; evidence_url: string }[];
  totalClaims: number;
  onOpenClaim: (id: string) => void;
}) {
  const [hover, setHover] = useState<{ kind: "claim" | "domain"; key: string } | null>(null);
  const byId = new Map(claims.map((c) => [c.id, c]));
  let shown = turnsOn.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const shownIds = new Set(shown.map((c) => c.id));
  for (const c of claims) {
    if (c.corroboration === "contradicted" && !shownIds.has(c.id)) {
      shown.push(c); shownIds.add(c.id);
    }
  }
  if (shown.length > 12) shown = shown.slice(0, 12);
  const more = totalClaims - shown.length;

  const domains = [...new Set(shown.map((c) => sourceDomain(c.evidence_url).label))];
  const domY = new Map(domains.map((d, i) => [d, i]));
  const ROW = 36, W = 720, PAD = 10;
  const rows = Math.max(shown.length, domains.length, 1);
  const H = rows * ROW + PAD * 2 + (more > 0 ? 18 : 0);
  const cy = (i: number, n: number) => PAD + ((rows - n) * ROW) / 2 + i * ROW + 12;
  const decY = cy(0, 1) + ((rows - 1) * ROW) / 2;
  const bez = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };
  const activeClaims: Set<string> = !hover ? new Set()
    : hover.kind === "claim" ? new Set([hover.key])
    : new Set(shown.filter((c) => sourceDomain(c.evidence_url).label === hover.key).map((c) => c.id));
  const activeDomains = new Set(
    [...activeClaims].map((id) => sourceDomain(byId.get(id)?.evidence_url).label));
  const dim = (on: boolean) => (hover && !on ? " dim" : "");
  // Exact match — decision is the invest|pass|conditional enum, not free text.
  const decClass = ["invest", "pass", "conditional"].includes(decision) ? decision : "none";

  return (
    <div className="prov">
      <svg viewBox={`0 0 ${W} ${H}`} role="group"
        aria-label="provenance: decision to claims to evidence domains">
        {shown.map((c, i) => (
          <path key={`e1-${c.id}`}
            className={`edge${hover && activeClaims.has(c.id) ? " hot" : ""}${dim(activeClaims.has(c.id))}`}
            d={bez(148, decY, 280, cy(i, shown.length))} />
        ))}
        {shown.map((c, i) => {
          const d = sourceDomain(c.evidence_url).label;
          const j = domY.get(d) ?? 0;
          return (
            <path key={`e2-${c.id}`}
              className={`edge${hover && activeClaims.has(c.id) ? " hot" : ""}${dim(activeClaims.has(c.id))}`}
              d={bez(432, cy(i, shown.length), 530, cy(j, domains.length))} />
          );
        })}
        <g className={`dec-node dec-${decClass}${dim(true)}`}>
          <rect x={8} y={decY - 14} width={140} height={28} rx={7} />
          <text x={78} y={decY + 4} textAnchor="middle">{decision}</text>
        </g>
        {shown.map((c, i) => (
          <g key={c.id} className={`pnode ${tierClass(c.corroboration)}${dim(activeClaims.has(c.id))}`}
            role="button" tabIndex={0}
            aria-label={`${c.id}, ${c.corroboration} — open full trace`}
            onMouseEnter={() => setHover({ kind: "claim", key: c.id })}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover({ kind: "claim", key: c.id })}
            onBlur={() => setHover(null)}
            onClick={() => onOpenClaim(c.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenClaim(c.id); } }}>
            <title>{`${c.id} (${c.corroboration}) — ${c.text} · click for full trace`}</title>
            <rect x={280} y={cy(i, shown.length) - 12} width={152} height={24} rx={6} />
            <text x={292} y={cy(i, shown.length) + 4}>{c.id} · {TIER_SHORT[c.corroboration] || c.corroboration}</text>
          </g>
        ))}
        {domains.map((d, j) => (
          <g key={d} className={`dnode${dim(activeDomains.has(d))}`}
            onMouseEnter={() => setHover({ kind: "domain", key: d })}
            onMouseLeave={() => setHover(null)}>
            <rect x={530} y={cy(j, domains.length) - 12} width={182} height={24} rx={6} />
            <text x={541} y={cy(j, domains.length) + 4}>
              {d.length > 26 ? d.slice(0, 25) + "…" : d}
            </text>
          </g>
        ))}
        {more > 0 && (
          <text className="prov-more" x={280} y={H - 6}>+{more} more claims in the ledger</text>
        )}
      </svg>
    </div>
  );
}

/* ---- loading / error --------------------------------------------------- */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton">
      {Array.from({ length: lines }, (_, i) => <div key={i} className="sk-line" />)}
    </div>
  );
}
export function Err({ msg }: { msg: string }) {
  return <div className="err">⚠ {msg}</div>;
}

/* Persistent founder switcher (page header): lateral movement at any time —
   never a dead end. Empty option resets to the picker. */
export function FounderSwitcher({ founderId, founders, openFounder }: {
  founderId: string | null;
  founders: { id: string; name: string }[];
  openFounder: (id: string) => void;
}) {
  return (
    <select className="control" value={founderId ?? ""}
      onChange={(e) => openFounder(e.target.value)} title="switch founder">
      <option value="">choose a founder…</option>
      {founderId && !founders.some((f) => f.id === founderId) && (
        <option value={founderId}>{founderId.replace("founder-", "")}</option>
      )}
      {founders.map((f) => (
        <option key={f.id} value={f.id}>{f.name}</option>
      ))}
    </select>
  );
}
