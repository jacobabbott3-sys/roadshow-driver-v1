import { LockKeyhole } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function UpdatePasswordPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const inFlight = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!user) return setError("This secure link is no longer active. Request a new invitation or password-reset email.");
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      sessionStorage.removeItem("roadshow-auth-flow");
      navigate("/", { replace: true });
    } catch {
      setError("We couldn’t save your password. Try again, or request a new reset link if your session has expired.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="center-page auth-simple">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">SECURE ACCOUNT</p>
        <h2>Choose a new password</h2>
        <p className="muted">Your password is handled securely by Supabase and is never visible to administrators.</p>
        {!loading && !user && <div className="error">This invitation or reset link is not active. Please request a new email and open its newest link.</div>}
        {error && <div className="error">{error}</div>}
        <label>New password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></div></label>
        <label>Confirm password<div className="input-wrap"><LockKeyhole size={18} /><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required /></div></label>
        <button className="button primary" disabled={busy || loading || !user}>{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </main>
  );
}
