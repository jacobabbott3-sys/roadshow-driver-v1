import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/202609290002_beta_5a_reliability.sql", import.meta.url);

test("reliability migration enforces active accounts across operational policies", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
  assert.match(sql, /create or replace function public\.is_active_user\(\)/);
  assert.match(sql, /id=auth\.uid\(\) and is_active/);
  for (const policy of [
    "contracts assigned read", "responses assigned manage", "photos assigned read",
    "notifications own read", "chat members read messages", "assigned toolbag read",
  ]) {
    const start = sql.indexOf(`create policy "${policy}"`);
    assert.notEqual(start, -1, `missing ${policy}`);
    assert.match(sql.slice(start, start + 700), /is_active_user\(\)/);
  }
});

test("reliability migration serializes final-admin protection", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
  assert.match(sql, /where role='admin' and is_active for update/);
  assert.match(sql, /active_admin_count<=1/);
  assert.match(sql, /at least one active administrator is required/);
  assert.match(sql, /target_user=auth\.uid\(\) and not new_active/);
});
