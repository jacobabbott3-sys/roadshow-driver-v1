import { saveConfirmedAgreementChange } from "./agreementData";
import type {
  AvailabilityBatch,
  AvailabilityResponsePerson,
  PublishableOpportunity,
  PublishedAvailabilityRow,
} from "../types";
import { supabase } from "./supabase";
import { rankAvailabilityResponses, toAvailabilityBatches } from "./availabilityModel";

export async function getPublishableOpportunities() {
  const { data, error } = await supabase.rpc("admin_get_publishable_opportunities");
  if (error) throw error;
  return (data || []) as PublishableOpportunity[];
}

export async function publishContractBatch(showIds: string[]) {
  const { data, error } = await supabase.rpc("admin_publish_availability_batch", {
    target_show_ids: [...new Set(showIds)],
  });
  if (error) throw error;
  return data as string;
}

export async function getPublishedAvailability(): Promise<AvailabilityBatch[]> {
  const { data, error } = await supabase.rpc("get_my_published_availability");
  if (error) throw error;
  return toAvailabilityBatches((data || []) as PublishedAvailabilityRow[]);
}

export async function setReleaseResponse(
  itemId: string,
  status: "available" | "unavailable",
) {
  const { data, error } = await supabase.rpc("set_my_release_response", {
    target_release_item: itemId,
    target_status: status,
  });
  if (error) throw error;
  return data as string;
}

export async function getReleaseResponses(itemId: string) {
  const { data, error } = await supabase.rpc("admin_get_release_responses", {
    target_release_item: itemId,
  });
  if (error) throw error;
  return rankAvailabilityResponses((data || []) as AvailabilityResponsePerson[]);
}

export async function replaceOpportunityAssignments(input: {
  releaseItemId: string | null;
  showIds: string[];
  driverIds: string[];
  externalNames: string[];
}) {
  await saveConfirmedAgreementChange('assign',{
    release_item_id: input.releaseItemId,show_ids: [...new Set(input.showIds)],
    driver_ids: [...new Set(input.driverIds)],external_names:input.externalNames,
  });
}

export async function withdrawReleaseItem(itemId: string) {
  const { error } = await supabase.rpc("admin_withdraw_release_item", {
    target_release_item: itemId,
  });
  if (error) throw error;
}
