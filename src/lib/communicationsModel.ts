export type ChatMember = {
  user_id: string;
  read_at: string | null;
  profile: { full_name: string; role: "driver" | "admin" } | null;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string } | null;
};

export type ChatThreadSummary = {
  id: string;
  subject: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ChatMember[];
  latest_message: ChatMessage | null;
  unread: boolean;
};

export function mergeChatMessages(...pages: ChatMessage[][]) {
  const byId = new Map<string, ChatMessage>();
  for (const page of pages) for (const message of page) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
}
