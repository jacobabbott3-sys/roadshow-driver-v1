import { MessageCircle, Plus, Send, UsersRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageState } from "../components/PageState";
import { BackButton } from "../components/BackButton";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import {
  createChat,
  getChatThreads,
  isThreadUnread,
  markChatRead,
  sendChatMessage,
} from "../lib/communications";
import { getDirectory } from "../lib/driverData";
import { supabase } from "../lib/supabase";

export function ChatPage() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const threads = useAsync(getChatThreads, [user?.id]);
  const refreshThreads = threads.refresh;
  const directory = useAsync(getDirectory, []);
  const [composing, setComposing] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedId = params.get("thread");
  const selected = threads.data?.find((thread) => thread.id === selectedId);
  const availablePeople =
    directory.data?.filter((person) => person.id !== user!.id) || [];

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`chat-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => void refreshThreads(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refreshThreads]);

  const selectedUnread = selected ? isThreadUnread(selected, user!.id) : false;
  useEffect(() => {
    if (!selectedId || !selectedUnread) return;
    void markChatRead(selectedId).then(() => {
      void refreshThreads();
      window.dispatchEvent(new Event("roadshow:chat-changed"));
    });
  }, [selectedId, selectedUnread, refreshThreads]);

  const participants = selected?.members
    .filter((member) => member.user_id !== user!.id)
    .map((member) => member.profile?.full_name || "Team member") || [];

  async function startChat(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const id = await createChat(recipients, subject, firstMessage);
      setRecipients([]);
      setSubject("");
      setFirstMessage("");
      setComposing(false);
      await threads.refresh();
      setParams({ thread: id });
      window.dispatchEvent(new Event("roadshow:chat-changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start chat.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await sendChatMessage(selected.id, reply);
      setReply("");
      await threads.refresh();
      window.dispatchEvent(new Event("roadshow:chat-changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page chat-page">
      {profile?.role === "admin" && <BackButton to="/admin" label="Back to Admin" />}
      <header className="page-header">
        <div>
          <p className="eyebrow">TEAM COMMUNICATION</p>
          <h1>Chat</h1>
          <p>Start individual or group conversations with anyone on the team.</p>
        </div>
        <button className="button primary compact" onClick={() => setComposing(true)}>
          <Plus /> New chat
        </button>
      </header>
      {message && <p className="notice">{message}</p>}
      {composing && (
        <form className="admin-form chat-composer" onSubmit={startChat}>
          <div className="section-row">
            <div><p className="eyebrow">NEW CHAT</p><h2>Choose participants</h2></div>
            <button type="button" className="icon-text-button" onClick={() => setComposing(false)}><X /> Close</button>
          </div>
          <fieldset className="driver-selector">
            <legend>Team members</legend>
            <div>
              {availablePeople.map((person) => (
                <label key={person.id}>
                  <input
                    type="checkbox"
                    checked={recipients.includes(person.id)}
                    onChange={(event) =>
                      setRecipients(event.target.checked
                        ? [...recipients, person.id]
                        : recipients.filter((id) => id !== person.id))
                    }
                  />
                  <span>{person.full_name || "Unnamed team member"}</span>
                  <small>{person.role === "admin" ? "Admin" : "Driver"}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <label>Conversation name<input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Training crew, Denver signing…" /></label>
          <label>Message<textarea required value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} /></label>
          <button className="button primary compact" disabled={busy || !recipients.length}><Send /> {busy ? "Sending…" : "Start chat"}</button>
        </form>
      )}
      <div className={`chat-layout ${selected ? "thread-open" : ""}`}>
        <section className="chat-thread-list">
          <PageState loading={threads.loading} error={threads.error} empty={!threads.data?.length}>
            {threads.data?.map((thread) => {
              const unread = isThreadUnread(thread, user!.id);
              const names = thread.members
                .filter((member) => member.user_id !== user!.id)
                .map((member) => member.profile?.full_name || "Team member")
                .join(", ");
              const latest = thread.messages.at(-1);
              return (
                <button
                  key={thread.id}
                  className={`chat-thread-row ${unread ? "unread" : ""} ${selectedId === thread.id ? "active" : ""}`}
                  onClick={() => setParams({ thread: thread.id })}
                >
                  <span className="chat-avatar"><UsersRound /></span>
                  <span><strong>{thread.subject}</strong><small>{names}</small><p>{latest?.body || "No messages yet"}</p></span>
                  {unread && <i />}
                </button>
              );
            })}
          </PageState>
        </section>
        <section className="chat-conversation">
          {selected ? (
            <>
              <header>
                <BackButton className="chat-back" label="All chats" onClick={() => setParams({})} />
                <div><h2>{selected.subject}</h2><p>{participants.join(", ")}</p></div>
              </header>
              <div className="chat-messages">
                {selected.messages.map((item) => {
                  const mine = item.sender_id === user!.id;
                  return (
                    <article className={mine ? "chat-bubble mine" : "chat-bubble"} key={item.id}>
                      {!mine && <strong>{item.sender?.full_name || "Team member"}</strong>}
                      <p>{item.body}</p>
                      <small>{new Date(item.created_at).toLocaleString()}</small>
                    </article>
                  );
                })}
              </div>
              <form className="chat-reply" onSubmit={sendReply}>
                <textarea aria-label="Reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" />
                <button className="button primary" disabled={busy || !reply.trim()}><Send /></button>
              </form>
            </>
          ) : (
            <div className="chat-empty"><MessageCircle /><h2>Select a conversation</h2><p>Or start a new chat with your team.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
