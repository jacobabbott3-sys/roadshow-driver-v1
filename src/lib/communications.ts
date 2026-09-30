import { supabase } from "./supabase";
import { release } from "./release";
import {
  mergeChatMessages,
  type ChatMember,
  type ChatMessage,
  type ChatThreadSummary,
} from "./communicationsModel";

export { mergeChatMessages };
export type { ChatMember, ChatMessage, ChatThreadSummary };

export type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  kind: string;
  release_batch_id: string | null;
  read_at: string | null;
  created_at: string;
};

type NotificationWithContract = Notification & {
  contract: null | { show: null | { is_test: boolean } | { is_test: boolean }[] } | { show: null | { is_test: boolean } | { is_test: boolean }[] }[];
};

export async function getChatThreadSummaries({ search = "", before = null, limit = 50 }: { search?: string; before?: string | null; limit?: number } = {}) {
  const { data, error } = await supabase.rpc("get_chat_thread_summaries", {
    target_search: search.trim(),
    target_before: before,
    target_limit: limit,
  });
  if (error) throw error;
  return (data || []) as unknown as ChatThreadSummary[];
}

export async function getChatMessages({ threadId, before = null, limit = 50 }: { threadId: string; before?: string | null; limit?: number }) {
  let query = supabase
    .from("chat_messages")
    .select("id,thread_id,sender_id,body,created_at,sender:profiles(full_name)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return mergeChatMessages((data || []) as unknown as ChatMessage[]);
}

export async function getUnreadChatCount() {
  const { data, error } = await supabase.rpc("get_my_unread_chat_count");
  if (error) throw error;
  return Number(data || 0);
}

export function isThreadUnread(thread: ChatThreadSummary) {
  return thread.unread;
}

export async function createChat(
  recipientIds: string[],
  subject: string,
  body: string,
) {
  const { data, error } = await supabase.rpc("create_chat_thread", {
    target_recipients: recipientIds,
    target_subject: subject,
    target_body: body,
  });
  if (error) throw error;
  return data as string;
}

export async function sendChatMessage(threadId: string, body: string) {
  const { error } = await supabase.rpc("send_chat_message", {
    target_thread: threadId,
    target_body: body,
  });
  if (error) throw error;
}

export async function markChatRead(threadId: string) {
  const { error } = await supabase.rpc("mark_chat_thread_read", {
    target_thread: threadId,
  });
  if (error) throw error;
}

export async function getNotifications(userId: string) {
  await supabase.rpc("ensure_my_due_notifications");
  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,body,link,kind,release_batch_id,read_at,created_at,contract:contracts(show:shows(is_test))")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data || []) as unknown as NotificationWithContract[];
  return rows
    .filter((notification) => {
      if (release.channel === "beta") return true;
      const contract = Array.isArray(notification.contract) ? notification.contract[0] : notification.contract;
      const show = Array.isArray(contract?.show) ? contract.show[0] : contract?.show;
      return !show?.is_test;
    })
    .map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      kind: notification.kind,
      release_batch_id: notification.release_batch_id,
      read_at: notification.read_at,
      created_at: notification.created_at,
    })) as Notification[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
