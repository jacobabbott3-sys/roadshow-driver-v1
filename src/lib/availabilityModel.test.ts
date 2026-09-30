import assert from "node:assert/strict";
import test from "node:test";
import {
  filterOpportunities,
  rankAvailabilityResponses,
  sortAvailabilityBatches,
  sortOpportunities,
  toAvailabilityBatches,
} from "./availabilityModel.ts";
import type {
  AvailabilityOpportunity,
  AvailabilityResponsePerson,
  PublishedAvailabilityRow,
} from "../types.ts";

function row(
  id: string,
  batch: string | null,
  releasedAt: string,
  title: string,
  artist: string | null = null,
): PublishedAvailabilityRow {
  return {
    batch_id: batch,
    batch_released_at: releasedAt,
    release_item_id: id,
    item_status: "open",
    shows: [{
      id: `${id}-show`,
      name: title,
      starts_on: "2026-11-10",
      ends_on: "2026-11-12",
      city: "Denver",
      state: "CO",
      address: "100 Convention Way",
      event_type: artist ? "signing" : "show",
      artist,
      venue_name: artist ? "Grand Hall" : null,
      signing_at: artist ? "2026-11-10T20:00:00Z" : null,
      setup_at: artist ? "2026-11-10T18:00:00Z" : null,
      is_test: false,
      contract_id: `${id}-contract`,
      contract_kind: "setup",
      service_date: "2026-11-09",
      service_time: "08:00:00",
      contract_pay: 500,
      bonus_pay: 100,
    }],
    response_status: null,
    responded_at: null,
    available_at: null,
    assignees: [],
  };
}

test("maps a linked signing row to one opportunity containing every signing", () => {
  const linked = row("linked", "batch-a", "2026-09-29T10:00:00Z", "Artist A", "Artist A");
  linked.shows.push({ ...linked.shows[0], id: "second-show", artist: "Artist B", name: "Artist B signing" });
  const batches = toAvailabilityBatches([linked]);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].opportunities.length, 1);
  assert.deepEqual(batches[0].opportunities[0].shows.map((show) => show.artist), ["Artist A", "Artist B"]);
});

test("filters opportunities across title artist venue city and state without case sensitivity", () => {
  const signing = toAvailabilityBatches([row("one", "batch-a", "2026-09-29T10:00:00Z", "Artist A signing", "The Artist")])[0].opportunities[0];
  assert.equal(filterOpportunities([signing], "artist").length, 1);
  assert.equal(filterOpportunities([signing], "GRAND").length, 1);
  assert.equal(filterOpportunities([signing], "denver").length, 1);
  assert.equal(filterOpportunities([signing], "co").length, 1);
  assert.equal(filterOpportunities([signing], "missing").length, 0);
});

test("sorts opportunities by date or title without mutating the source", () => {
  const early = toAvailabilityBatches([row("early", "b", "2026-09-29T10:00:00Z", "Zulu")])[0].opportunities[0];
  const alpha = toAvailabilityBatches([row("late", "b", "2026-09-29T10:00:00Z", "Alpha")])[0].opportunities[0];
  alpha.shows[0].service_date = "2026-11-15";
  const source: AvailabilityOpportunity[] = [alpha, early];
  assert.deepEqual(sortOpportunities(source, "date").map((item) => item.id), ["early", "late"]);
  assert.deepEqual(sortOpportunities(source, "alpha").map((item) => item.id), ["late", "early"]);
  assert.deepEqual(source.map((item) => item.id), ["late", "early"]);
});

test("sorts publication batches newest first and assigned work last", () => {
  const batches = toAvailabilityBatches([
    row("old", "old-batch", "2026-09-20T10:00:00Z", "Old"),
    row("assigned", null, "2026-09-30T10:00:00Z", "Assigned"),
    row("new", "new-batch", "2026-09-29T10:00:00Z", "New"),
  ]);
  assert.deepEqual(sortAvailabilityBatches(batches).map((batch) => batch.id), ["new-batch", "old-batch", null]);
});

test("ranks available responders by time and id before unavailable and nonresponders", () => {
  const people: AvailabilityResponsePerson[] = [
    { profile_id: "z", full_name: "No Reply", role: "driver", phone: null, response_status: null, responded_at: null, available_at: null, response_rank: null, assigned: false },
    { profile_id: "b", full_name: "Second Tie", role: "driver", phone: null, response_status: "available", responded_at: "2026-09-29T10:00:00Z", available_at: "2026-09-29T10:00:00Z", response_rank: null, assigned: false },
    { profile_id: "a", full_name: "First Tie", role: "admin", phone: null, response_status: "available", responded_at: "2026-09-29T10:00:00Z", available_at: "2026-09-29T10:00:00Z", response_rank: null, assigned: false },
    { profile_id: "u", full_name: "Unavailable", role: "driver", phone: null, response_status: "unavailable", responded_at: "2026-09-29T09:00:00Z", available_at: null, response_rank: null, assigned: false },
  ];
  const ranked = rankAvailabilityResponses(people);
  assert.deepEqual(ranked.map((person) => person.profile_id), ["a", "b", "u", "z"]);
  assert.deepEqual(ranked.map((person) => person.response_rank), [1, 2, null, null]);
});
