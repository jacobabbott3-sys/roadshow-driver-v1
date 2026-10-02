import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/202610010001_beta_5a_photo_resource_uploads.sql";

test("Beta 5A includes the photo and PDF resource migration", () => {
  assert.equal(existsSync(migrationPath), true);
});

test("the migration permits assigned contract users to read stored photos", () => {
  if (!existsSync(migrationPath)) return;
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /assigned users read roadshow photos/i);
  assert.match(sql, /storage\.foldername\(name\).*\[2\]/s);
  assert.match(sql, /public\.is_contract_driver/s);
});

test("the migration permits assigned users and admins to create photo records", () => {
  if (!existsSync(migrationPath)) return;
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /photos assigned insert/s);
  assert.match(sql, /public\.is_admin\(\)/s);
  assert.match(sql, /uploaded_by\s*=\s*auth\.uid\(\)/s);
});
