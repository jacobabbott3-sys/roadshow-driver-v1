import { ArrowRight, LockKeyhole, Mail, Route } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabase";

export function LoginPage() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(
    () => localStorage.getItem("roadshow-stay-logged-in") !== "false",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password, stayLoggedIn);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro"><div><div className="auth-brand"><Route size={26} /> Roadshow Driver</div></div><div><p className="eyebrow">READY FOR THE NEXT SHOW</p><h1>Your route.<br />Your checklist.<br /><em>All in one place.</em></h1><p>Everything your crew needs—from signed contract to final walkthrough.</p></div><p className="auth-foot">Built for life on the road.</p></section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-logo"><img src="/favicon.svg" alt="" /></div>
          <p className="eyebrow">WELCOME BACK</p><h2>Sign in to continue</h2><p className="muted">Use the account provided by your administrator.</p>
          {!isSupabaseConfigured && <div className="notice">Supabase isn’t connected yet. Add your project details to <code>.env</code>.</div>}
          {error && <div className="error" role="alert">{error}</div>}
          <label>Email address<div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" /></div></label>
          <label>Password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required autoComplete="current-password" /></div></label>
          <div className="login-options"><label className="stay-logged-in"><input type="checkbox" checked={stayLoggedIn} onChange={(event) => setStayLoggedIn(event.target.checked)} /> Stay logged in</label><Link className="forgot" to="/forgot-password">Forgot password?</Link></div>
          <button className="button primary" disabled={busy || !isSupabaseConfigured}>{busy ? "Signing in…" : <>Sign in <ArrowRight size={18} /></>}</button>
        </form>
      </section>
    </main>
  );
}
