import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

test("generated JavaScript does not shadow the Vite TypeScript config", () => {
  assert.equal(existsSync(resolve("vite.config.js")), false);
});
