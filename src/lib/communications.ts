import { supabase } from "./supabase";
import { release } from "./release";

export type ChatMember = {
  user_id: string;
  read_at: string | null;
  profile: { full_name: string; role: "driver" | "admin" } | null;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string } | null;
};

export type ChatThread = {
  id: string;
  subject: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ChatMember[];
  messages: ChatMessage[];
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
};

type NotificationWithContract = Notification & {
  contract: null | { show: null | { is_test: boolean } | { is_test: boolean }[] } | { show: null | { is_test: boolean } | { is_test: boolean }[] }[];
};

export async function getChatThreads() {
  const { data, error } = await supabase
    .from("chat_threads")
    .select(
      "id,subject,created_by,created_at,updated_at,members:chat_thread_members(user_id,read_at,profile:profiles(full_name,role)),messages:chat_messages(id,sender_id,body,created_at,sender:profiles(full_name))",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((thread) => ({
    ...thread,
    messages: [...(thread.messages || [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
  })) as unknown as ChatThread[];
}

export function isThreadUnread(thread: ChatThread, userId: string) {
  const membership = thread.members.find((member) => member.user_id === userId);
  const latest = thread.messages.at(-1);
  return Boolean(
    latest &&
      latest.sender_id !== userId &&
      (!membership?.read_at || latest.created_at > membership.read_at),
  );
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
    .select("id,title,body,link,kind,read_at,created_at,contract:contracts(show:shows(is_test))")
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
