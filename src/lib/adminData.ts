import { supabase } from "./supabase";
import type { Contract, Show } from "./driverData";
import type { Profile } from "../types";
export type DashboardStats = {
  shows: number;
  unsigned: number;
  reviews: number;
  drivers: number;
  feedback: number;
};
export type AdminToolbag = {
  id: string;
  number: string;
  notes: string | null;
  assigned_to: string | null;
  driver: { full_name: string } | null;
  items: { id: string; name: string; quantity: number; position: number }[];
};
export type ToolbagTemplate = {
  id: string;
  name: string;
  items: { id: string; name: string; quantity: number; position: number }[];
};
export type AdminFeedback = {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  profile: { full_name: string } | null;
};
export async function getDashboardStats() {
  const today = new Date().toISOString().slice(0, 10);
  const [shows, unsigned, reviews, drivers, feedback] = await Promise.all([
    supabase
      .from("shows")
      .select("*", { count: "exact", head: true })
      .gte("ends_on", today),
    supabase
      .from("contracts")
      .select("*", { count: "exact", head: true })
      .is("signed_at", null),
    supabase
      .from("contracts")
      .select("*", { count: "exact", head: true })
      .in("status", ["submitted", "under_review"]),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "driver")
      .eq("is_active", true),
    supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
  ]);
  return {
    shows: shows.count || 0,
    unsigned: unsigned.count || 0,
    reviews: reviews.count || 0,
    drivers: drivers.count || 0,
    feedback: feedback.count || 0,
  } as DashboardStats;
}
export type AdminContract = {
  id: string;
  kind: "setup" | "teardown";
  service_date: string;
  status: string;
  driver_id: string | null;
  contract_pay: number | null;
  bonus_pay: number | null;
  terms: string | null;
  admin_signed_at: string | null;
  admin_signature_name: string | null;
  contract_drivers: { driver_id: string; is_trainee: boolean }[];
  contract_checklists: { template_id: string }[];
};
export async function getShowsAdmin() {
  const { data, error } = await supabase
    .from("shows")
    .select(
      "*,contracts(id,kind,service_date,status,driver_id,contract_pay,bonus_pay,terms,admin_signed_at,admin_signature_name,contract_drivers(driver_id,is_trainee),contract_checklists(template_id))",
    )
    .order("starts_on", { ascending: false });
  if (error) throw error;
  return data as (Show & { contracts: AdminContract[] })[];
}
export async function createShow(
  input: Omit<Show, "id" | "details_unlock_at">,
) {
  const { data, error } = await supabase
    .from("shows")
    .insert({
      ...input,
      details_unlock_at: new Date(
        new Date(`${input.starts_on}T12:00:00`).getTime() - 3 * 864e5,
      ).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
export async function getDrivers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url,phone,role,is_active")
    .order("full_name");
  if (error) throw error;
  return data as Profile[];
}
export async function saveShowContract(input: {
  id?: string;
  show_id: string;
  driver_ids: string[];
  kind: "setup" | "teardown";
  service_date: string;
  contract_pay: number | null;
  bonus_pay: number | null;
  terms: string | null;
  template_id: string;
}) {
  let contractId = input.id;
  const values = {
    show_id: input.show_id,
    driver_id: input.driver_ids[0] || null,
    kind: input.kind,
    service_date: input.service_date,
    contract_pay: input.contract_pay,
    bonus_pay: input.bonus_pay,
    terms: input.terms,
  };
  if (contractId) {
    const { error } = await supabase
      .from("contracts")
      .update(values)
      .eq("id", contractId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("contracts")
      .insert({ ...values, status: "available" })
      .select("id")
      .single();
    if (error) throw error;
    contractId = data.id;
  }
  if (!contractId) throw new Error("Unable to save contract.");
  await supabase
    .from("contract_drivers")
    .delete()
    .eq("contract_id", contractId);
  if (input.driver_ids.length) {
    const { error } = await supabase
      .from("contract_drivers")
      .insert(
        input.driver_ids.map((driver_id, index) => ({
          contract_id: contractId,
          driver_id,
          is_trainee: index > 0,
        })),
      );
    if (error) throw error;
  }
  await assignShowChecklist(input.show_id, input.kind, input.template_id);
  const { error: assignError } = await supabase.rpc("admin_assign_checklist", {
    target_contract: contractId,
    target_template: input.template_id,
  });
  if (assignError) throw assignError;
  return contractId;
}
export async function adminSignContract(id: string, name: string) {
  const { error } = await supabase
    .from("contracts")
    .update({
      admin_signature_name: name,
      admin_signed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
export async function updateUser(
  id: string,
  role: "driver" | "admin",
  active: boolean,
) {
  const { error } = await supabase.rpc("admin_update_user", {
    target_user: id,
    new_role: role,
    new_active: active,
  });
  if (error) throw error;
}
export async function getReviews() {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id,kind,status,submitted_at,admin_note,show:shows(*),driver:profiles!contracts_driver_id_fkey(id,full_name)",
    )
    .in("status", ["submitted", "under_review"])
    .order("submitted_at");
  if (error) throw error;
  return data as unknown as (Contract & {
    submitted_at: string | null;
    driver: { id: string; full_name: string };
  })[];
}
export async function reviewContract(
  id: string,
  approved: boolean,
  note: string,
) {
  const { error } = await supabase
    .from("contracts")
    .update({
      status: approved ? "approved" : "in_progress",
      reviewed_at: new Date().toISOString(),
      admin_note: note,
    })
    .eq("id", id);
  if (error) throw error;
}
export async function getTemplates() {
  const { data, error } = await supabase
    .from("checklist_templates")
    .select(
      "id,name,kind,version,active,sections:checklist_sections(id,title,position,items:checklist_items(id,title,photo_required,required,position))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createTemplate(
  name: string,
  kind: "setup" | "teardown",
  sections: {
    title: string;
    items: { title: string; photo_required: boolean }[];
  }[],
) {
  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({ name, kind })
    .select("id")
    .single();
  if (error) throw error;
  for (let s = 0; s < sections.length; s++) {
    const { data: section, error: se } = await supabase
      .from("checklist_sections")
      .insert({ template_id: data.id, title: sections[s].title, position: s })
      .select("id")
      .single();
    if (se) throw se;
    if (sections[s].items.length) {
      const { error: ie } = await supabase
        .from("checklist_items")
        .insert(
          sections[s].items.map((i, p) => ({
            section_id: section.id,
            title: i.title,
            photo_required: i.photo_required,
            position: p,
          })),
        );
      if (ie) throw ie;
    }
  }
}
export async function getFeedback() {
  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id,category,message,status,created_at,profile:profiles!feedback_submitted_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AdminFeedback[];
}
export async function getToolbags() {
  const { data, error } = await supabase
    .from("toolbags")
    .select(
      "id,number,notes,assigned_to,driver:profiles(full_name),items:toolbag_items(id,name,quantity,position)",
    )
    .order("number");
  if (error) throw error;
  return (data || []) as unknown as AdminToolbag[];
}
export async function createToolbag(number: string, driver: string | null) {
  const { error } = await supabase
    .from("toolbags")
    .insert({ number, assigned_to: driver || null });
  if (error) throw error;
}
export async function updateToolbag(id: string, driver: string | null) {
  const { error } = await supabase
    .from("toolbags")
    .update({ assigned_to: driver || null })
    .eq("id", id);
  if (error) throw error;
}
export async function updateShow(id: string, input: Partial<Show>) {
  const { error } = await supabase.from("shows").update(input).eq("id", id);
  if (error) throw error;
}
export async function deleteShow(id: string) {
  const { error } = await supabase.from("shows").delete().eq("id", id);
  if (error) throw error;
}
export async function getShowChecklistAssignments() {
  const { data, error } = await supabase
    .from("show_checklist_templates")
    .select("show_id,kind,template_id");
  if (error) throw error;
  return data || [];
}
export async function assignShowChecklist(
  showId: string,
  kind: "setup" | "teardown",
  templateId: string,
) {
  const { error } = await supabase
    .from("show_checklist_templates")
    .upsert(
      { show_id: showId, kind, template_id: templateId },
      { onConflict: "show_id,kind" },
    );
  if (error) throw error;
  const { data: contracts, error: contractError } = await supabase
    .from("contracts")
    .select("id")
    .eq("show_id", showId)
    .eq("kind", kind);
  if (contractError) throw contractError;
  for (const contract of contracts || []) {
    const { error: assignError } = await supabase.rpc(
      "admin_assign_checklist",
      { target_contract: contract.id, target_template: templateId },
    );
    if (assignError) throw assignError;
  }
}
export async function updateTemplate(
  id: string,
  name: string,
  kind: "setup" | "teardown",
  sections: {
    title: string;
    items: { title: string; photo_required: boolean }[];
  }[],
) {
  const { error } = await supabase.rpc("admin_replace_checklist_template", {
    target_template: id,
    new_name: name,
    new_kind: kind,
    new_sections: sections,
  });
  if (error) throw error;
}
export async function addToolbagItem(
  toolbagId: string,
  name: string,
  quantity: number,
) {
  const { error } = await supabase
    .from("toolbag_items")
    .insert({ toolbag_id: toolbagId, name, quantity });
  if (error) throw error;
}
export async function updateToolbagItem(
  id: string,
  name: string,
  quantity: number,
) {
  const { error } = await supabase
    .from("toolbag_items")
    .update({ name, quantity })
    .eq("id", id);
  if (error) throw error;
}
export async function deleteToolbagItem(id: string) {
  const { error } = await supabase.from("toolbag_items").delete().eq("id", id);
  if (error) throw error;
}
export async function getToolbagTemplates() {
  const { data, error } = await supabase
    .from("toolbag_templates")
    .select("id,name,items:toolbag_template_items(id,name,quantity,position)")
    .order("name");
  if (error) throw error;
  return (data || []) as unknown as ToolbagTemplate[];
}
export async function createToolbagTemplate(
  name: string,
  items: { name: string; quantity: number }[],
) {
  const { data, error } = await supabase
    .from("toolbag_templates")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  if (items.length) {
    const { error: itemError } = await supabase
      .from("toolbag_template_items")
      .insert(
        items.map((item, position) => ({
          ...item,
          template_id: data.id,
          position,
        })),
      );
    if (itemError) throw itemError;
  }
}
export async function applyToolbagTemplate(
  toolbagId: string,
  templateId: string,
) {
  const { error } = await supabase.rpc("apply_toolbag_template", {
    target_toolbag: toolbagId,
    target_template: templateId,
  });
  if (error) throw error;
}
export async function updateContractTerms(id: string, terms: string) {
  const { error } = await supabase
    .from("contracts")
    .update({ terms })
    .eq("id", id);
  if (error) throw error;
}
