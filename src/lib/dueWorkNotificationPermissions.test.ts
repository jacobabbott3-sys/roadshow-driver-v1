import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const migrations = new URL("../../supabase/migrations/", import.meta.url);

test("due-work permission migration revokes only browser access to the scheduled function", async () => {
  const candidates = (await readdir(migrations)).filter((name) =>
    name.endsWith("_restrict_due_work_notification_execution.sql"),
  );
  assert.equal(candidates.length, 1, "one additive due-work permission migration is required");
  const sql = (await readFile(new URL(candidates[0], migrations), "utf8"))
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Keep this migration narrowly scoped: no function-body changes, broad
  // default grants, scheduler changes, or service-role/owner revocations.
  assert.equal(
    sql,
    "revoke execute on function public.create_due_work_notifications() from public, anon, authenticated;",
  );
});

test("the app keeps the separate user-scoped due-notification RPC", async () => {
  const source = await readFile(new URL("./communications.ts", import.meta.url), "utf8");
  assert.match(source, /supabase\.rpc\("ensure_my_due_notifications"\)/);
  assert.doesNotMatch(source, /create_due_work_notifications/);
});
