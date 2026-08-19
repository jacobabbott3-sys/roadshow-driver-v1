import { Mail, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AdminHeader } from "../components/AdminNav";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { getUsers } from "../lib/adminData";
import { sendMessage } from "../lib/communications";

export function AdminMessagesPage() {
  const { user } = useAuth();
  const users = useAsync(getUsers, []);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const availableUsers =
    users.data?.filter((member) => member.is_active && member.id !== user!.id) ||
    [];

  async function send(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await sendMessage(user!.id, recipients, subject, body);
      setRecipients([]);
      setSubject("");
      setBody("");
      setMessage(
        "Message sent to " +
          recipients.length +
          " recipient" +
          (recipients.length === 1 ? "." : "s."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to send message.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="page">
      <AdminHeader
        eyebrow="COMMUNICATIONS"
        title="Send messages"
        description="Send a direct inbox message to drivers or other administrators."
      />
      {message && <div className="notice">{message}</div>}
      <form className="admin-form message-composer" onSubmit={send}>
        <Mail />
        <h2>New message</h2>
        <fieldset className="driver-selector">
          <legend>Recipients</legend>
          <div>
            {availableUsers.map((member) => (
              <label key={member.id}>
                <input
                  type="checkbox"
                  checked={recipients.includes(member.id)}
                  onChange={(event) =>
                    setRecipients(
                      event.target.checked
                        ? [...recipients, member.id]
                        : recipients.filter((id) => id !== member.id),
                    )
                  }
                />
                <span>{member.full_name || "Unnamed team member"}</span>
                <small>{member.role === "admin" ? "Admin" : "Driver"}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Subject
          <input
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label>
          Message
          <textarea
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <button
          className="button primary"
          disabled={sending || !recipients.length}
        >
          <Send />
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>
    </main>
  );
}
