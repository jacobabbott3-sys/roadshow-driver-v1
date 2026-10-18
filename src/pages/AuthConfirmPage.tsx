import { passwordFlow } from "../lib/authFlow";
import { CheckCircle2, Link2Off, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function AuthConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState("Verifying your secure account link…");

  const verification = useRef<{ key: string; request: ReturnType<typeof supabase.auth.verifyOtp> } | null>(null);

  useEffect(() => {
    let active = true;
    const tokenHash = params.get("token_hash");
    const type = passwordFlow(params.get("type"));
    if (!tokenHash || !type) {
      setStatus("error");
      setMessage("This account link is incomplete or unsupported. Request a new invitation or password-reset email.");
      return;
    }
    // Reuse the pending exchange across StrictMode effect replay; OTPs are single-use.
    const key = `${type}:${tokenHash}`;
    if (verification.current?.key !== key) {
      verification.current = { key, request: supabase.auth.verifyOtp({ token_hash: tokenHash, type }) };
    }
    setStatus("working");
    setMessage("Verifying your secure account link…");
    void verification.current.request.then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setStatus("error");
        setMessage("This account link is invalid or expired. Request a new invitation or password-reset email.");
        return;
      }
      sessionStorage.setItem("roadshow-session-active", "true");
      sessionStorage.setItem("roadshow-auth-flow", type);
      setStatus("success");
      setMessage("Link accepted. Opening password setup…");
      navigate("/update-password", { replace: true });
    }).catch(() => {
      if (!active) return;
      setStatus("error");
      setMessage("We couldn’t verify this account link. Please reopen it or request a new email.");
    });
    return () => { active = false; };
  }, [navigate, params]);

  return (
    <main className="center-page auth-simple">
      <section className="auth-card auth-confirm-card">
        {status === "working" ? <LoaderCircle className="confirm-spinner" /> : status === "success" ? <CheckCircle2 className="confirm-success" /> : <Link2Off className="confirm-error" />}
        <p className="eyebrow">SECURE ACCOUNT</p>
        <h2>{status === "error" ? "We couldn’t open this account link" : "Setting up your account"}</h2>
        <p className={status === "error" ? "error" : "muted"}>{message}</p>
      </section>
    </main>
  );
}
