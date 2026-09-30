import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mergeChatMessages, type ChatMessage } from "./communicationsModel.ts";

const migration = readFileSync(new URL("../../supabase/migrations/202609290003_beta_5a_chat_performance.sql", import.meta.url), "utf8");

test("chat performance migration exposes bounded summaries and unread count", () => {
  assert.match(migration, /get_chat_thread_summaries\s*\(/i);
  assert.match(migration, /least\s*\(\s*greatest[\s\S]*50/i);
  assert.match(migration, /get_my_unread_chat_count\s*\(/i);
  assert.match(migration, /mine\.user_id\s*=\s*auth\.uid\(\)/i);
  assert.doesNotMatch(migration, /latest\.body\s+ilike/i);
});

test("message pages and realtime inserts merge without duplicates in stable order", () => {
  const older = [message("1", "2026-09-29T10:00:00Z"), message("2", "2026-09-29T11:00:00Z")];
  const current = [message("2", "2026-09-29T11:00:00Z"), message("3", "2026-09-29T12:00:00Z")];
  const realtime = message("4", "2026-09-29T12:00:00Z");
  assert.deepEqual(mergeChatMessages(current, older, [realtime, realtime]).map((item) => item.id), ["1", "2", "3", "4"]);
});

test("messages with equal timestamps use their id as the stable tie breaker", () => {
  assert.deepEqual(mergeChatMessages([message("b", "2026-09-29T12:00:00Z")], [message("a", "2026-09-29T12:00:00Z")]).map((item) => item.id), ["a", "b"]);
});

function message(id: string, created_at: string): ChatMessage {
  return { id, thread_id: "thread-1", sender_id: "user-1", body: id, created_at, sender: { full_name: "Driver" } };
}
