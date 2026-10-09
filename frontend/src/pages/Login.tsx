import { useState } from "react";
import * as api from "../api";
import type { Me } from "../api";
import { Err } from "../components";

/* Sign-in card. Each firm gets its own segregated store: create one (seeded with
   the demo founders and the default lens) or join a colleague's with its invite code. */
type Mode = "signin" | "create" | "join";

export default function Login({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firm, setFirm] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const me = mode === "signin" ? await api.login(email, password)
        : mode === "create" ? await api.signup({ email, password, firm_name: firm })
        : await api.signup({ email, password, invite_code: code });
      onSignedIn(me);
    } catch (ex) {
      setErr((ex as Error).message);
    }
    setBusy(false);
  };

  const tabs: [Mode, string][] = [["signin", "Sign in"], ["create", "Create a firm"], ["join", "Join a firm"]];
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">FirstSignal<span className="dot">.</span></div>
        <p className="login-sub">
          Every firm runs on its own thesis and its own evidence store. Nothing is shared
          across firms.
        </p>
        <div className="login-tabs" role="tablist">
          {tabs.map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m}
              className={`login-tab ${mode === m ? "on" : ""}`}
              onClick={() => { setMode(m); setErr(null); }}>{label}</button>
          ))}
        </div>
        {mode === "create" && (
          <label>Firm name
            <input className="filter" value={firm} onChange={(e) => setFirm(e.target.value)}
              autoComplete="organization" required />
          </label>
        )}
        {mode === "join" && (
          <label>Invite code
            <input className="filter" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="from a colleague's sidebar" required />
          </label>
        )}
        <label>Email
          <input className="filter" type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input className="filter" type="password" value={password} minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <Err msg={err} />}
        <button className="minibtn primary login-go" type="submit" disabled={busy}>
          {busy ? "…" : mode === "signin" ? "Sign in" : mode === "create" ? "Create firm" : "Join firm"}
        </button>
        {mode === "create" && (
          <p className="login-note">
            A new firm starts with the demo founders (Corevance, Tracewell, …) and the
            Pre-seed AI Infra lens, so there is something to look at on day one.
          </p>
        )}
      </form>
    </div>
  );
}
