import { supabase } from "./supabase";

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
};
export type Contract = {
  id: string;
  kind: "setup" | "teardown";
  service_date: string;
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
};
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

export async function getContracts() {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id,kind,service_date,status,contract_pay,bonus_pay,document_path,terms,signed_at,signature_name,admin_signed_at,admin_signature_name,admin_note,show:shows(id,name,starts_on,ends_on,city,state,address,bin_count,meals_included,lodging_included,details_unlock_at)",
    )
    .order("service_date");
  if (error) throw error;
  return (data || []) as unknown as Contract[];
}
export async function getContract(id: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id,kind,service_date,status,contract_pay,bonus_pay,document_path,terms,signed_at,signature_name,admin_signed_at,admin_signature_name,admin_note,show:shows(id,name,starts_on,ends_on,city,state,address,bin_count,meals_included,lodging_included,details_unlock_at)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as Contract;
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
  const { data: shows, error } = await supabase
    .from("shows")
    .select("*")
    .gte("ends_on", new Date().toISOString().slice(0, 10))
    .order("starts_on");
  if (error) throw error;
  const { data: rows, error: rowError } = await supabase
    .from("availability")
    .select("id,show_id,driver_id,status")
    .eq("driver_id", userId);
  if (rowError) throw rowError;
  const byShow = new Map((rows || []).map((r) => [r.show_id, r]));
  return (shows || []).map((show) => ({
    ...byShow.get(show.id),
    show_id: show.id,
    driver_id: userId,
    status: byShow.get(show.id)?.status || "pending",
    show,
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
export function dateRange(show: Show) {
  const start = new Date(`${show.starts_on}T12:00:00`),
    end = new Date(`${show.ends_on}T12:00:00`);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
export function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
