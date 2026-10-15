import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

test("generated JavaScript does not shadow the Vite TypeScript config", () => {
  assert.equal(existsSync(resolve("vite.config.js")), false);
});

test("release fallbacks label beta as 6A and public as 5", () => {
  const config = readFileSync(resolve("vite.config.ts"), "utf8");
  assert.match(config, /channel === 'beta' \? '6A' : '5'/);
  assert.match(config, /\|\| '5'/);
});

test("new contract batch push alerts default on and are saved from Profile", () => {
  const preferences = readFileSync(resolve("src/lib/pushNotifications.ts"), "utf8");
  const profile = readFileSync(resolve("src/pages/ProfilePage.tsx"), "utf8");
  assert.match(preferences, /availability_release_alerts:\s*true/);
  assert.match(preferences, /\.upsert\(\{ user_id: userId/);
  assert.match(profile, /availability_release_alerts:\s*preferences\.data\.availability_release_alerts/);
  assert.match(profile, /title="New contract batches"/);
});
