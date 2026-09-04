import assert from "node:assert/strict";
import test from "node:test";
import { matchesListSearch, sortList, type SortMode } from "./listControls.ts";

type Listing = { title: string; date: string; details: string[] };

const listings: Listing[] = [
  { title: "Zoo signing", date: "2026-09-01", details: ["Denver", "Ball Arena"] },
  { title: "Alpine show", date: "2026-09-02", details: ["Salt Lake City", "Expo Center"] },
  { title: "Museum signing", date: "2026-09-20", details: ["Boise", "Convention Hall"] },
];

test("search matches any supplied field without case sensitivity", () => {
  assert.equal(matchesListSearch(" salt LAKE ", listings[1].title, ...listings[1].details), true);
  assert.equal(matchesListSearch("arena", listings[0].title, ...listings[0].details), true);
  assert.equal(matchesListSearch("missing", listings[0].title, ...listings[0].details), false);
});

test("an empty search shows every listing", () => {
  assert.equal(matchesListSearch("   ", listings[0].title), true);
});

for (const [mode, expected] of [
  ["date", ["Zoo signing", "Alpine show", "Museum signing"]],
  ["alpha", ["Alpine show", "Museum signing", "Zoo signing"]],
] as [SortMode, string[]][]) {
  test(`sorts listings by ${mode} without mutating the source`, () => {
    const source = [...listings];
    const sorted = sortList(listings, mode, (item) => item.title, (item) => item.date);
    assert.deepEqual(sorted.map((item) => item.title), expected);
    assert.deepEqual(listings, source);
  });
}
