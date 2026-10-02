import type {
  AvailabilityBatch,
  AvailabilityOpportunity,
  AvailabilityResponsePerson,
  PublishedAvailabilityRow,
} from "../types";
import type { SortMode } from "./listControls";

export type ContractPublicationState = "not_published" | "published_open" | "published_assigned";
export type ContractPublicationFilter = "all" | "published" | "not_published";

export function toAvailabilityBatches(
  rows: PublishedAvailabilityRow[],
): AvailabilityBatch[] {
  const batches = new Map<string, AvailabilityBatch>();
  for (const row of rows) {
    const key = row.batch_id || "assigned-work";
    const batch = batches.get(key) || {
      id: row.batch_id,
      released_at: row.batch_released_at,
      opportunities: [],
    };
    batch.opportunities.push({
      id: row.release_item_id,
      batch_id: row.batch_id,
      batch_released_at: row.batch_released_at,
      status: row.item_status,
      shows: row.shows,
      response_status: row.response_status,
      responded_at: row.responded_at,
      available_at: row.available_at,
      assignees: row.assignees,
    });
    batches.set(key, batch);
  }
  return sortAvailabilityBatches([...batches.values()]);
}

export function sortAvailabilityBatches(
  batches: AvailabilityBatch[],
): AvailabilityBatch[] {
  return [...batches].sort((left, right) => {
    if (left.id === null) return right.id === null ? 0 : 1;
    if (right.id === null) return -1;
    return right.released_at.localeCompare(left.released_at) ||
      left.id.localeCompare(right.id);
  });
}

export function publicationStateForShow(
  showId: string,
  batches: AvailabilityBatch[],
): ContractPublicationState {
  const publishedContract = batches
    .flatMap((batch) => batch.opportunities)
    .find((contract) => contract.batch_id !== null && contract.shows.some((show) => show.id === showId));
  if (!publishedContract) return "not_published";
  return publishedContract.status === "assigned" ? "published_assigned" : "published_open";
}

export function matchesPublicationFilter(
  showId: string,
  batches: AvailabilityBatch[],
  filter: ContractPublicationFilter,
) {
  if (filter === "all") return true;
  const published = publicationStateForShow(showId, batches) !== "not_published";
  return filter === "published" ? published : !published;
}

export function publicationStateLabel(state: ContractPublicationState) {
  if (state === "published_open") return "Published — accepting responses";
  if (state === "published_assigned") return "Published — assigned";
  return "Not published";
}

export function availabilityOpportunityTitle(
  opportunity: AvailabilityOpportunity,
) {
  const signing = opportunity.shows.some((show) => show.event_type === "signing");
  return signing
    ? opportunity.shows.map((show) => show.artist || show.name).join(" & ")
    : opportunity.shows[0]?.name || "Untitled contract";
}

export function availabilityOpportunityDate(
  opportunity: AvailabilityOpportunity,
) {
  return opportunity.shows
    .map((show) => show.setup_at || show.signing_at || show.service_date || show.starts_on)
    .filter(Boolean)
    .sort()[0] || "";
}

export function filterOpportunities(
  opportunities: AvailabilityOpportunity[],
  query: string,
) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return opportunities;
  return opportunities.filter((opportunity) => [
    availabilityOpportunityTitle(opportunity),
    ...opportunity.shows.flatMap((show) => [
      show.name,
      show.artist,
      show.venue_name,
      show.city,
      show.state,
      show.address,
    ]),
  ].some((value) => value ? normalizeSearchText(value).includes(normalized) : false));
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}

export function sortOpportunities(
  opportunities: AvailabilityOpportunity[],
  mode: SortMode,
) {
  return [...opportunities].sort((left, right) => mode === "alpha"
    ? availabilityOpportunityTitle(left).localeCompare(availabilityOpportunityTitle(right)) ||
      availabilityOpportunityDate(left).localeCompare(availabilityOpportunityDate(right))
    : availabilityOpportunityDate(left).localeCompare(availabilityOpportunityDate(right)) ||
      availabilityOpportunityTitle(left).localeCompare(availabilityOpportunityTitle(right)));
}

export function rankAvailabilityResponses(
  people: AvailabilityResponsePerson[],
): AvailabilityResponsePerson[] {
  const sorted = [...people].sort((left, right) => {
    const priority = (status: AvailabilityResponsePerson["response_status"]) =>
      status === "available" ? 0 : status === "unavailable" ? 1 : 2;
    const statusDifference = priority(left.response_status) - priority(right.response_status);
    if (statusDifference) return statusDifference;
    if (left.response_status === "available" && right.response_status === "available") {
      return (left.available_at || "").localeCompare(right.available_at || "") ||
        left.profile_id.localeCompare(right.profile_id);
    }
    return left.full_name.localeCompare(right.full_name) ||
      left.profile_id.localeCompare(right.profile_id);
  });
  let rank = 0;
  return sorted.map((person) => ({
    ...person,
    response_rank: person.response_status === "available" ? ++rank : null,
  }));
}
