import { supabase } from "./supabase";
import { release } from "./release";

export type Show = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  city: string;
  state: string | null;
  address: string | null;
  bin_count: number | null;
  meals_included: boolean;
  lodging_included: boolean;
  details_unlock_at: string | null;
  event_type: "show" | "signing";
  artist: string | null;
  venue_name: string | null;
  signing_at: string | null;
  setup_at: string | null;
  per_diem: number | null;
  lodging_name: string | null;
  lodging_address: string | null;
  lodging_phone: string | null;
  lodging_confirmation: string | null;
  lodging_check_in: string | null;
  lodging_check_out: string | null;
  lodging_notes: string | null;
  is_test: boolean;
  test_owner: string | null;
};
export type Contract = {
  id: string;
  kind: "setup" | "teardown";
  service_date: string;
  service_time: string | null;
  status: string;
  contract_pay: number | null;
  bonus_pay: number | null;
  document_path: string | null;
  terms: string | null;
  signed_at: string | null;
  signature_name: string | null;
  admin_signed_at: string | null;
  admin_signature_name: string | null;
  admin_note: string | null;
  show: Show;
};
export type AvailabilityRow = {
  id?: string;
  show_id: string;
  driver_id: string;
  status: "available" | "unavailable" | "pending" | "assigned";
  show: Show;
  assignees: { id: string; full_name: string; role: "driver" | "admin" }[];
  contract_pay: number | null;
  bonus_pay: number | null;
  contract_kind: "setup" | "teardown" | null;
  service_date: string | null;
  service_time: string | null;
  linked_show_ids: string[];
};
export type ShowLink = { show_id: string; linked_show_id: string };
export type Resource = {
  id: string;
  kind: "handbook" | "faq" | "link";
  title: string;
  content: string | null;
  file_path: string | null;
};
export type ChecklistItem = {
  id: string;
  title: string;
  instructions: string | null;
  required: boolean;
  photo_required: boolean;
  position: number;
  response?: {
    id: string;
    completed: boolean;
    note: string | null;
    review_status: string | null;
    review_note: string | null;
    reviewed_at: string | null;
    reviewer: { full_name: string } | null;
  } | null;
};
export type ChecklistSection = {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
};
export type ContractPhoto = {
  id: string;
  slot_name: string | null;
  storage_path: string;
  created_at: string;
  signed_url: string;
};

export async function getContracts() {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id,kind,service_date,service_time,status,contract_pay,bonus_pay,document_path,terms,signed_at,signature_name,admin_signed_at,admin_signature_name,admin_note,show:shows(*)",
    )
    .order("service_date");
  if (error) throw error;
  const contracts = (data || []) as unknown as Contract[];
  return release.channel === "beta" ? contracts : contracts.filter((contract) => !contract.show.is_test);
}
export async function getContract(id: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id,kind,service_date,service_time,status,contract_pay,bonus_pay,document_path,terms,signed_at,signature_name,admin_signed_at,admin_signature_name,admin_note,show:shows(*)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  const contract = data as unknown as Contract;
  if (release.channel !== "beta" && contract.show.is_test) throw new Error("This test contract is only available in beta.");
  return contract;
}
export async function getChecklist(contractId: string) {
  const { data: cc, error } = await supabase
    .from("contract_checklists")
    .select("id,template_id")
    .eq("contract_id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!cc) return { id: null, sections: [] as ChecklistSection[] };
  const { data: sections, error: sectionError } = await supabase
    .from("checklist_sections")
    .select(
      "id,title,position,items:checklist_items(id,title,instructions,required,photo_required,position)",
    )
    .eq("template_id", cc.template_id)
    .order("position");
  if (sectionError) throw sectionError;
  const { data: responses, error: responseError } = await supabase
    .from("checklist_responses")
    .select(
      "id,item_id,completed,note,review_status,review_note,reviewed_at,reviewer:profiles!checklist_responses_reviewed_by_fkey(full_name)",
    )
    .eq("contract_checklist_id", cc.id);
  if (responseError) throw responseError;
  const byItem = new Map((responses || []).map((r) => [r.item_id, r]));
  return {
    id: cc.id,
    sections: (sections || []).map((s) => ({
      ...s,
      items: (s.items || [])
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ ...i, response: byItem.get(i.id) || null })),
    })) as ChecklistSection[],
  };
}
export async function getContractPhotos(contractId: string) {
  const { data, error } = await supabase
    .from("photos")
    .select("id,slot_name,storage_path,created_at")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const photos = await Promise.all((data || []).map(async (photo) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from("roadshow-photos")
      .createSignedUrl(photo.storage_path, 3600);
    if (signedError) throw signedError;
    return { ...photo, signed_url: signed.signedUrl };
  }));
  return photos as ContractPhoto[];
}
export async function setChecklistItem(
  checklistId: string,
  itemId: string,
  completed: boolean,
) {
  const { error } = await supabase.rpc("set_my_checklist_item", {
    target_checklist: checklistId,
    target_item: itemId,
    new_completed: completed,
  });
  if (error) throw error;
}
export async function submitChecklist(contractId: string) {
  const { error } = await supabase.rpc("submit_my_checklist", {
    target_contract_id: contractId,
  });
  if (error) throw error;
}
export async function getAvailability(userId: string) {
  const [{ data: shows, error }, { data: assignmentRows, error: assignmentError }, { data: showLinks, error: linkError }] = await Promise.all([
    supabase
    .from("shows")
    .select("*")
    .gte("ends_on", new Date().toISOString().slice(0, 10))
    .order("starts_on"),
    supabase.rpc("get_public_show_availability"),
    supabase.from("show_links").select("show_id,linked_show_id"),
  ]);
  if (error) throw error;
  if (assignmentError) throw assignmentError;
  if (linkError) throw linkError;
  const { data: rows, error: rowError } = await supabase
    .from("availability")
    .select("id,show_id,driver_id,status")
    .eq("driver_id", userId);
  if (rowError) throw rowError;
  const byShow = new Map((rows || []).map((r) => [r.show_id, r]));
  const typedAssignments = (assignmentRows || []) as {
    show_id: string;
    assignees: AvailabilityRow["assignees"];
    contract_pay: number | null;
    bonus_pay: number | null;
    contract_kind: "setup" | "teardown" | null;
    service_date: string | null;
    service_time: string | null;
  }[];
  const assignmentDetails = new Map(typedAssignments.map((row) => [row.show_id, row]));
  const visibleShows = release.channel === "beta" ? (shows || []) : (shows || []).filter((show) => !show.is_test);
  return visibleShows.map((show) => ({
    ...byShow.get(show.id),
    show_id: show.id,
    driver_id: userId,
    status: assignmentDetails.get(show.id)?.assignees?.length
      ? "assigned"
      : byShow.get(show.id)?.status || "pending",
    show,
    assignees: assignmentDetails.get(show.id)?.assignees || [],
    contract_pay: assignmentDetails.get(show.id)?.contract_pay ?? null,
    bonus_pay: assignmentDetails.get(show.id)?.bonus_pay ?? null,
    contract_kind: assignmentDetails.get(show.id)?.contract_kind ?? null,
    service_date: assignmentDetails.get(show.id)?.service_date ?? null,
    service_time: assignmentDetails.get(show.id)?.service_time ?? null,
    linked_show_ids: (showLinks || []).flatMap((link) => link.show_id === show.id ? [link.linked_show_id] : link.linked_show_id === show.id ? [link.show_id] : []),
  })) as AvailabilityRow[];
}
export async function setAvailability(
  showId: string,
  userId: string,
  status: "available" | "unavailable",
) {
  const { error } = await supabase
    .from("availability")
    .upsert(
      {
        show_id: showId,
        driver_id: userId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "show_id,driver_id" },
    );
  if (error) throw error;
}
export async function setAvailabilityMany(showIds: string[], userId: string, status: "available" | "unavailable") {
  const { error } = await supabase.from("availability").upsert(showIds.map((show_id) => ({
    show_id, driver_id: userId, status, updated_at: new Date().toISOString(),
  })), { onConflict: "show_id,driver_id" });
  if (error) throw error;
}
export async function getShowLinks() {
  const { data, error } = await supabase.from("show_links").select("show_id,linked_show_id");
  if (error) throw error;
  return (data || []) as ShowLink[];
}
export async function getResources() {
  const { data, error } = await supabase
    .from("resources")
    .select("id,kind,title,content,file_path")
    .eq("published", true)
    .order("position");
  if (error) throw error;
  return (data || []) as Resource[];
}
export async function getMyToolbag(userId: string) {
  const { data, error } = await supabase
    .from("toolbags")
    .select("id,number,notes,items:toolbag_items(id,name,quantity,position)")
    .eq("assigned_to", userId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    number: string;
    notes: string | null;
    items: { id: string; name: string; quantity: number; position: number }[];
  } | null;
}
export async function getDirectory() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url,phone,role,is_active")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return data as {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
    role: "driver" | "admin";
    is_active: boolean;
  }[];
}

export async function getLinkedSignings(showId: string) {
  const { data: links, error } = await supabase
    .from("show_links")
    .select("show_id,linked_show_id")
    .or(`show_id.eq.${showId},linked_show_id.eq.${showId}`);
  if (error) throw error;
  const ids = (links || []).map((link) =>
    link.show_id === showId ? link.linked_show_id : link.show_id,
  );
  if (!ids.length) return [] as Show[];
  const { data, error: showError } = await supabase
    .from("shows")
    .select("*")
    .in("id", ids)
    .order("signing_at");
  if (showError) throw showError;
  const linked = data as Show[];
  return release.channel === "beta" ? linked : linked.filter((show) => !show.is_test);
}
export function dateRange(show: Show) {
  const start = new Date(`${show.starts_on}T12:00:00`),
    end = new Date(`${show.ends_on}T12:00:00`);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
export function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
