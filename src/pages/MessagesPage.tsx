import { Mail, MailOpen } from "lucide-react";
import { useState } from "react";
import { PageState } from "../components/PageState";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { getMessages, markMessageRead } from "../lib/communications";

export function MessagesPage() {
  const { user } = useAuth();
  const messages = useAsync(() => getMessages(user!.id), [user?.id]);
  const [selected, setSelected] = useState<string | null>(null);

  async function openMessage(id: string, recipientId: string, unread: boolean) {
    setSelected((current) => (current === id ? null : id));
    if (recipientId === user!.id && unread) {
      await markMessageRead(id, user!.id);
      await messages.refresh();
      window.dispatchEvent(new Event("roadshow:messages-changed"));
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">INBOX</p>
          <h1>Messages</h1>
          <p>Direct updates shared with your roadshow team.</p>
        </div>
      </header>
      <PageState
        loading={messages.loading}
        error={messages.error}
        empty={!messages.data?.length}
      >
        <div className="message-list">
          {messages.data?.map((message) => {
            const received = message.recipient_id === user!.id;
            const unread = received && !message.read_at;
            const open = selected === message.id;
            return (
              <article
                className={unread ? "message-card unread" : "message-card"}
                key={message.id}
              >
                <button
                  className="message-open"
                  aria-expanded={open}
                  onClick={() =>
                    void openMessage(message.id, message.recipient_id, unread)
                  }
                >
                  {unread ? <Mail /> : <MailOpen />}
                  <span>
                    <strong>{message.subject}</strong>
                    <small>
                      {received
                        ? "From " +
                          (message.sender?.full_name || "Roadshow Admin")
                        : "To " +
                          (message.recipient?.full_name || "Team member")}{" "}
                      · {new Date(message.created_at).toLocaleString()}
                    </small>
                  </span>
                </button>
                {open && <p>{message.body}</p>}
              </article>
            );
          })}
        </div>
      </PageState>
    </main>
  );
}
