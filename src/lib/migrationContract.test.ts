import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../../supabase/migrations/202609290001_beta_5a_contract_publishing.sql",
  import.meta.url,
);

test("Beta 5A migration declares the publishing schema and RPC contract", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const required = [
    "create table public.availability_release_batches",
    "create table public.availability_release_items",
    "create table public.availability_release_item_shows",
    "create table public.availability_release_responses",
    "create table public.contract_external_assignees",
    "create or replace function public.admin_get_publishable_opportunities",
    "create or replace function public.admin_publish_availability_batch",
    "create or replace function public.get_my_published_availability",
    "create or replace function public.set_my_release_response",
    "create or replace function public.admin_get_release_responses",
    "create or replace function public.admin_replace_opportunity_assignments",
    "create or replace function public.admin_withdraw_release_item",
    "availability_release_alerts boolean not null default true",
    "availability_release",
  ];

  for (const fragment of required) {
    assert.match(sql.toLowerCase(), new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Beta 5A migration keeps release timestamps and external names server controlled", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
  assert.match(sql, /available_at\s*=\s*case[\s\S]*clock_timestamp\(\)/);
  assert.match(sql, /check\s*\(char_length\(display_name\) between 1 and 120\)/);
  assert.match(sql, /unique index[\s\S]*lower\(display_name\)/);
  assert.match(sql, /for update/);
});
