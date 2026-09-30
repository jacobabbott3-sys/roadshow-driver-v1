import { MessageCircle, Plus, Send, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { ListSearch } from "../components/ListSearch";
import { PageState } from "../components/PageState";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import {
  createChat,
  getChatMessages,
  getChatThreadSummaries,
  isThreadUnread,
  markChatRead,
  mergeChatMessages,
  sendChatMessage,
  type ChatMessage,
  type ChatThreadSummary,
} from "../lib/communications";
import { getDirectory } from "../lib/driverData";
import { supabase } from "../lib/supabase";

const PAGE_SIZE = 50;

export function ChatPage() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const directory = useAsync(getDirectory, []);
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState("");
  const [hasMoreThreads, setHasMoreThreads] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasEarlierMessages, setHasEarlierMessages] = useState(false);
  const [composing, setComposing] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedId = params.get("thread");
  const selected = threads.find((thread) => thread.id === selectedId);
  const availablePeople = directory.data?.filter((person) => person.id !== user!.id) || [];

  const refreshThreads = useCallback(async () => {
    if (!user?.id) return;
    setThreadsLoading(true);
    setThreadsError("");
    try {
      const page = await getChatThreadSummaries({ search, limit: PAGE_SIZE });
      setThreads(page);
      setHasMoreThreads(page.length === PAGE_SIZE);
    } catch (error) {
      setThreadsError(error instanceof Error ? error.message : "Unable to load chats.");
    } finally {
      setThreadsLoading(false);
    }
  }, [search, user?.id]);

  useEffect(() => { void refreshThreads(); }, [refreshThreads]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); setHasEarlierMessages(false); return; }
    let active = true;
    setMessagesLoading(true);
    void getChatMessages({ threadId: selectedId, limit: PAGE_SIZE })
      .then((page) => {
        if (!active) return;
        setMessages(page);
        setHasEarlierMessages(page.length === PAGE_SIZE);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load messages."); })
      .finally(() => { if (active) setMessagesLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`chat-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const incoming = { ...(payload.new as Omit<ChatMessage, "sender">), sender: null };
          if (incoming.thread_id === selectedId) setMessages((current) => mergeChatMessages(current, [incoming]));
          void refreshThreads();
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, selectedId, refreshThreads]);

  useEffect(() => {
    if (!selectedId || !selected?.unread) return;
    void markChatRead(selectedId).then(() => {
      setThreads((current) => current.map((thread) => thread.id === selectedId ? { ...thread, unread: false } : thread));
      window.dispatchEvent(new Event("roadshow:chat-changed"));
    });
  }, [selectedId, selected?.unread]);

  const participants = selected?.members
    .filter((member) => member.user_id !== user!.id)
    .map((member) => member.profile?.full_name || "Team member") || [];

  async function loadMoreThreads() {
    const before = threads.at(-1)?.updated_at;
    if (!before) return;
    setThreadsLoading(true);
    try {
      const page = await getChatThreadSummaries({ search, before, limit: PAGE_SIZE });
      setThreads((current) => {
        const byId = new Map(current.map((thread) => [thread.id, thread]));
        for (const thread of page) byId.set(thread.id, thread);
        return [...byId.values()];
      });
      setHasMoreThreads(page.length === PAGE_SIZE);
    } catch (error) {
      setThreadsError(error instanceof Error ? error.message : "Unable to load more chats.");
    } finally { setThreadsLoading(false); }
  }

  async function loadEarlierMessages() {
    if (!selectedId || !messages.length) return;
    setMessagesLoading(true);
    try {
      const page = await getChatMessages({ threadId: selectedId, before: messages[0].created_at, limit: PAGE_SIZE });
      setMessages((current) => mergeChatMessages(current, page));
      setHasEarlierMessages(page.length === PAGE_SIZE);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load earlier messages.");
    } finally { setMessagesLoading(false); }
  }

  async function startChat(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const id = await createChat(recipients, subject, firstMessage);
      setRecipients([]); setSubject(""); setFirstMessage(""); setComposing(false); setSearch("");
      await refreshThreads();
      setParams({ thread: id });
      window.dispatchEvent(new Event("roadshow:chat-changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start chat.");
    } finally { setBusy(false); }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    try {
      await sendChatMessage(selectedId, reply);
      setReply("");
      const latest = await getChatMessages({ threadId: selectedId, limit: PAGE_SIZE });
      setMessages((current) => mergeChatMessages(current, latest));
      await refreshThreads();
      window.dispatchEvent(new Event("roadshow:chat-changed"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send message.");
    } finally { setBusy(false); }
  }

  return (
    <main className="page chat-page">
      {profile?.role === "admin" && <BackButton to="/admin" label="Back to Admin" />}
      <header className="page-header">
        <div><p className="eyebrow">TEAM COMMUNICATION</p><h1>Chat</h1><p>Start individual or group conversations with anyone on the team.</p></div>
        <button className="button primary compact" onClick={() => setComposing(true)}><Plus /> New chat</button>
      </header>
      {message && <p className="notice">{message}</p>}
      {composing && (
        <form className="admin-form chat-composer" onSubmit={startChat}>
          <div className="section-row"><div><p className="eyebrow">NEW CHAT</p><h2>Choose participants</h2></div><button type="button" className="icon-text-button" onClick={() => setComposing(false)}><X /> Close</button></div>
          <fieldset className="driver-selector"><legend>Team members</legend><div>{availablePeople.map((person) => (
            <label key={person.id}><input type="checkbox" checked={recipients.includes(person.id)} onChange={(event) => setRecipients(event.target.checked ? [...recipients, person.id] : recipients.filter((id) => id !== person.id))} /><span>{person.full_name || "Unnamed team member"}</span><small>{person.role === "admin" ? "Admin" : "Driver"}</small></label>
          ))}</div></fieldset>
          <label>Conversation name<input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Training crew, Denver signing…" /></label>
          <label>Message<textarea required value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} /></label>
          <button className="button primary compact" disabled={busy || !recipients.length}><Send /> {busy ? "Sending…" : "Start chat"}</button>
        </form>
      )}
      <ListSearch value={search} onChange={setSearch} placeholder="Search conversation names or participants" label="Search chats" resultCount={threads.length} />
      <div className={`chat-layout ${selected ? "thread-open" : ""}`}>
        <section className="chat-thread-list">
          <PageState loading={threadsLoading && !threads.length} error={threadsError}>
            {!threads.length ? <div className="inline-empty">No chats match “{search}”.</div> : threads.map((thread) => {
              const unread = isThreadUnread(thread);
              const names = thread.members.filter((member) => member.user_id !== user!.id).map((member) => member.profile?.full_name || "Team member").join(", ");
              return <button key={thread.id} className={`chat-thread-row ${unread ? "unread" : ""} ${selectedId === thread.id ? "active" : ""}`} onClick={() => setParams({ thread: thread.id })}>
                <span className="chat-avatar"><UsersRound /></span><span><strong>{thread.subject}</strong><small>{names}</small><p>{thread.latest_message?.body || "No messages yet"}</p></span>{unread && <i />}
              </button>;
            })}
            {hasMoreThreads && <button className="button secondary chat-load-more" type="button" disabled={threadsLoading} onClick={() => void loadMoreThreads()}>{threadsLoading ? "Loading…" : "Load more chats"}</button>}
          </PageState>
        </section>
        <section className="chat-conversation">
          {selected ? <>
            <header><BackButton className="chat-back" label="All chats" onClick={() => setParams({})} /><div><h2>{selected.subject}</h2><p>{participants.join(", ")}</p></div></header>
            <div className="chat-messages">
              {hasEarlierMessages && <button className="button secondary chat-load-earlier" type="button" disabled={messagesLoading} onClick={() => void loadEarlierMessages()}>{messagesLoading ? "Loading…" : "Load earlier messages"}</button>}
              {messagesLoading && !messages.length ? <p>Loading messages…</p> : messages.map((item) => {
                const mine = item.sender_id === user!.id;
                return <article className={mine ? "chat-bubble mine" : "chat-bubble"} key={item.id}>{!mine && <strong>{item.sender?.full_name || "Team member"}</strong>}<p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>;
              })}
            </div>
            <form className="chat-reply" onSubmit={sendReply}><textarea aria-label="Reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" /><button className="button primary" disabled={busy || !reply.trim()}><Send /></button></form>
          </> : <div className="chat-empty"><MessageCircle /><h2>Select a conversation</h2><p>Or start a new chat with your team.</p></div>}
        </section>
      </div>
    </main>
  );
}
