import { MessageSquareText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BackButton } from "../components/BackButton";
import { MutationNotice } from "../components/MutationNotice";
import { useAuth } from "../context/AuthContext";
import { useMutationFeedback } from "../hooks/useMutationFeedback";
import { supabase } from "../lib/supabase";

export function FeedbackPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<"app" | "general">("general");
  const [message, setMessage] = useState("");
  const feedback = useMutationFeedback();

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await feedback.run(async () => {
        const { error } = await supabase.from("feedback").insert({ submitted_by: user!.id, category, message });
        if (error) throw error;
      }, { successMessage: "Thanks—your feedback was sent.", retryable: false });
      setMessage("");
    } catch { /* MutationNotice presents the failure. */ }
  }

  return <main className="page">
    <BackButton to="/resources" label="Back to resources" />
    <header className="page-header"><div><p className="eyebrow">WE'RE LISTENING</p><h1>Submit feedback</h1><p>Share an app issue or a general suggestion with the admin team.</p></div></header>
    <form className="feedback-card feedback-page" onSubmit={submit}>
      <MessageSquareText />
      <label>Feedback type<select value={category} onChange={(event) => setCategory(event.target.value as "app" | "general")}><option value="general">General feedback</option><option value="app">App feedback</option></select></label>
      <label>Your feedback<textarea required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What should we know?" /></label>
      <button className="button primary" disabled={feedback.state === "saving"}>{feedback.state === "saving" ? "Sending…" : "Send feedback"}</button>
      <MutationNotice state={feedback.state} message={feedback.message} onDismiss={feedback.clear} />
    </form>
  </main>;
}
