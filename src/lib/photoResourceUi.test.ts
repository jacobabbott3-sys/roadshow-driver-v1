import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contractPage = readFileSync("src/pages/ContractDetailPage.tsx", "utf8");
const adminPage = readFileSync("src/pages/AdminOperationsPage.tsx", "utf8");
const redFolderPage = readFileSync("src/pages/RedFolderPage.tsx", "utf8");
const adminData = readFileSync("src/lib/adminData.ts", "utf8");
const driverData = readFileSync("src/lib/driverData.ts", "utf8");

test("contract photo selection works from a desktop file picker", () => {
  assert.doesNotMatch(contractPage, /capture="environment"/);
  assert.match(contractPage, /Choose or take photo/);
});

test("admin resources accept PDF attachments and persist their type", () => {
  assert.match(adminPage, /application\/pdf/);
  assert.match(adminPage, /normalizeResourceFile/);
  assert.match(adminData, /file_type/);
  assert.match(driverData, /file_type/);
});

test("Red Folder renders PDFs as documents instead of images", () => {
  assert.match(redFolderPage, /file_type\s*===\s*"pdf"/);
  assert.match(redFolderPage, /View PDF/);
  assert.match(redFolderPage, /Download PDF/);
  assert.match(redFolderPage, /createSignedUrl\(item\.file_path!,\s*3600,\s*\{\s*download:/s);
  assert.match(redFolderPage, /Promise\.allSettled/);
});
