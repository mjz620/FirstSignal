import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { Channel } from "../api";
import { Err, Skeleton } from "../components";

const SCAN_LABEL: Record<string, string> = {
  launchtracker: "launchtracker (new launches)",
  websearch: "websearch (Tavily, open web)",
};

/* Sources — scanner health, not deal flow: which channels yield, what to scan next,
   what the resolver could not place. Moved off Discover so triage stays triage. */
export default function Sources({ thesis }: { thesis: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [scanSources, setScanSources] = useState<string[]>([]);
  const [dropped, setDropped] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getChannels().then((c) => { setChannels(c.channels); setSuggestion(c.suggestion); })
      .catch((e) => setErr(e.message));
    api.getSourcing(thesis).then((f) => { setScanSources(f.scan_sources); setDropped(f.droplog_count); })
      .catch(() => {});
  }, [thesis]);
  useEffect(load, [load]);

  return (
    <div>
      <div className="page-h">
        <h1>Sources</h1>
        <p className="page-sub">
          Where companies come from. Scan a channel live, see how much of each channel
          resolves to a real founder, and how many signals could not be matched
          {dropped != null ? <> (<b>{dropped}</b> kept in the drop-log, nothing discarded)</> : null}.
        </p>
      </div>
      <div className="section-h"><h2>Scan a source</h2></div>
      <ScanNow thesis={thesis} sources={scanSources} onDone={load} />
      <div className="section-h"><h2>Channel yield</h2>
        <span className="count">signals scanned → matched to a founder → researched</span></div>
      {err && <Err msg={err} />}
      {channels.length === 0 ? <Skeleton lines={2} /> : (
        <div className="chan-row">
          {channels.filter((c) => !["deck", "web", "manual", "tavily"].includes(c.source)).map((c) => (
            <div key={c.source} className="chan">
              <div className="chan-name">{c.source}</div>
              <div className="chan-funnel">
                <span title="signals scanned">{c.signals}</span> →{" "}
                <span title="matched to a founder">{c.resolved}</span> →{" "}
                <span title="researched">{c.screened}</span>
              </div>
              <div className="chan-rate">{Math.round(c.resolve_rate * 100)}% matched to a founder</div>
            </div>
          ))}
        </div>
      )}
      {suggestion && <div className="suggestion">💡 {suggestion}</div>}
    </div>
  );
}

function ScanNow({ thesis, sources, onDone }:
  { thesis: string; sources: string[]; onDone: () => void }) {
  const [source, setSource] = useState("hn");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.postScan(source, thesis);
      const n = r.counts[source];
      setMsg(typeof n === "string"
        ? `⚠ ${source}: ${n}`
        : `${n} signals fetched live from ${source} — ${r.resolved} resolved, `
          + `${r.dropped} to drop-log`
          // name the reasons, not the raw signal ids — "why" is the useful part
          + (r.dropped_detail?.length
            ? ` (${[...new Set(r.dropped_detail.map((d) => d.reason))].join(", ")})`
            : "")
          + (r.new_founders.length
            ? `; new founders: ${r.new_founders.map((f) => f.name).join(", ")}`
            : ""));
      onDone();
    } catch (e) {
      setMsg(`⚠ ${(e as Error).message}`);
    }
    setBusy(false);
  };
  return (
    <div style={{ margin: "0 0 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select className="control" value={source} onChange={(e) => setSource(e.target.value)}
        title="source to scan live (one per call — rate-limited)">
        {sources.map((s) => (
          <option key={s} value={s}>{SCAN_LABEL[s] || s}</option>
        ))}
      </select>
      <button className={`minibtn primary${busy ? " pulse" : ""}`} onClick={go} disabled={busy}>
        {busy ? "scanning live…" : "Scan now (live)"}
      </button>
      {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
    </div>
  );
}

