import type { EmailOtpType } from "@supabase/supabase-js";
import { CheckCircle2, Link2Off, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function AuthConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState("Verifying your secure invitation…");

  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") || "invite") as EmailOtpType;
    if (!tokenHash) {
      setStatus("error");
      setMessage("This invitation link is incomplete. Ask an administrator to send a new invitation.");
      return;
    }
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message.includes("expired") ? "This invitation has expired. Ask an administrator to send a new one." : error.message);
        return;
      }
      sessionStorage.setItem("roadshow-session-active", "true");
      setStatus("success");
      setMessage("Invitation accepted. Opening password setup…");
      window.setTimeout(() => navigate("/update-password", { replace: true }), 500);
    });
  }, [navigate, params]);

  return (
    <main className="center-page auth-simple">
      <section className="auth-card auth-confirm-card">
        {status === "working" ? <LoaderCircle className="confirm-spinner" /> : status === "success" ? <CheckCircle2 className="confirm-success" /> : <Link2Off className="confirm-error" />}
        <p className="eyebrow">ACCOUNT INVITATION</p>
        <h2>{status === "error" ? "We couldn’t open this invitation" : "Setting up your account"}</h2>
        <p className={status === "error" ? "error" : "muted"}>{message}</p>
      </section>
    </main>
  );
}
