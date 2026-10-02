import { LogOut, ShieldX } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export function InactiveAccountPage() {
  const { profile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function leave() {
    setBusy(true);
    setError("");
    try { await signOut(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to sign out."); }
    finally { setBusy(false); }
  }
  return (
    <main className="recovery-screen inactive-account-screen">
      <section className="recovery-card">
        <span className="recovery-icon"><ShieldX /></span>
        <p className="eyebrow">ACCOUNT ACCESS</p>
        <h1>Your account is inactive</h1>
        <p>{profile?.full_name ? `${profile.full_name}, your` : "Your"} Roadshow Driver account has been deactivated. Contact an administrator if you think this was a mistake.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button primary" onClick={() => void leave()} disabled={busy}><LogOut /> {busy ? "Signing out…" : "Sign out"}</button>
      </section>
    </main>
  );
}
