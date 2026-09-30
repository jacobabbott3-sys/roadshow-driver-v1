import assert from "node:assert/strict";
import test from "node:test";
import { compareDateOnly, localDateKey, parseDateOnly } from "./calendarDate.ts";

test("localDateKey keeps an 8 PM Mountain evening on the local day", () => {
  assert.equal(localDateKey(new Date("2026-09-30T02:00:00Z")), "2026-09-29");
});

test("localDateKey changes at local midnight", () => {
  assert.equal(localDateKey(new Date("2026-09-30T05:59:59Z")), "2026-09-29");
  assert.equal(localDateKey(new Date("2026-09-30T06:00:00Z")), "2026-09-30");
});

test("date-only parsing survives daylight-saving boundaries and round trips", () => {
  for (const value of ["2026-03-08", "2026-11-01", "2026-12-31"]) {
    const parsed = parseDateOnly(value);
    assert.equal(localDateKey(parsed), value);
    assert.equal(parsed.getHours(), 12);
  }
});

test("compareDateOnly orders calendar keys without UTC conversion", () => {
  assert.equal(compareDateOnly("2026-09-29", "2026-09-30"), -1);
  assert.equal(compareDateOnly("2026-09-30", "2026-09-30"), 0);
  assert.equal(compareDateOnly("2026-10-01", "2026-09-30"), 1);
});
