import { supabase } from "./supabase";
import { getChecklist, type Contract, type Show } from "./driverData";
import type { Profile } from "../types";
import { release } from "./release";
export type DashboardStats = {
  shows: number;
  unsigned: number;
  reviews: number;
  drivers: number;
  feedback: number;
  signings: number;
};
export type AdminToolbag = {
  id: string;
  number: string;
  notes: string | null;
  assigned_to: string | null;
  driver: { full_name: string; role: "driver" | "admin" } | null;
  items: { id: string; name: string; quantity: number; position: number }[];
};
export type ToolbagTemplate = {
  id: string;
  name: string;
  items: { id: string; name: string; quantity: number; position: number }[];
};
export type ContractTemplate = {
  id: string;
  name: string;
  kind: "setup" | "teardown";
  terms: string | null;
  active: boolean;
};
export type AdminResource = {
  id: string;
  kind: "handbook" | "faq" | "link";
  title: string;
  content: string | null;
  file_path: string | null;
  position: number;
  published: boolean;
};
export type ShowInput = Pick<
  Show,
  "name" | "starts_on" | "ends_on" | "city"
> &
  Partial<Omit<Show, "id" | "name" | "starts_on" | "ends_on" | "city">>;
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
  let showsQuery = supabase
      .from("shows")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "show")
      .gte("ends_on", today);
  let signingsQuery = supabase
      .from("shows")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "signing")
      .gte("ends_on", today);
  let unsignedQuery = supabase
      .from("contracts")
      .select("*,show:shows!inner(event_type,is_test)", { count: "exact", head: true })
      .eq("show.event_type", "show")
      .is("signed_at", null);
  let reviewsQuery = supabase
      .from("contracts")
      .select("*,show:shows!inner(is_test)", { count: "exact", head: true })
      .in("status", ["submitted", "under_review"]);
  if (release.channel !== "beta") {
    showsQuery = showsQuery.eq("is_test", false);
    signingsQuery = signingsQuery.eq("is_test", false);
    unsignedQuery = unsignedQuery.eq("show.is_test", false);
    reviewsQuery = reviewsQuery.eq("show.is_test", false);
  }
  const [shows, signings, unsigned, reviews, drivers, feedback] = await Promise.all([
    showsQuery,
    signingsQuery,
    unsignedQuery,
    reviewsQuery,
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
    signings: signings.count || 0,
  } as DashboardStats;
}
export type AdminContract = {
  id: string;
  kind: "setup" | "teardown";
  service_date: string;
  service_time: string | null;
  status: string;
  driver_id: string | null;
  contract_pay: number | null;
  bonus_pay: number | null;
  terms: string | null;
  admin_signed_at: string | null;
  admin_signature_name: string | null;
  contract_drivers: {
    driver_id: string;
    is_trainee: boolean;
    driver: { full_name: string; role: "driver" | "admin" } | null;
  }[];
  contract_checklists: { template_id: string }[];
};
export type AdminShow = Show & {
  contracts: AdminContract[];
  show_checklist_templates: {
    kind: "setup" | "teardown";
    template_id: string;
  }[];
};
export async function getShowsAdmin() {
  const { data, error } = await supabase
    .from("shows")
    .select(
      "*,show_checklist_templates(kind,template_id),contracts(id,kind,service_date,service_time,status,driver_id,contract_pay,bonus_pay,terms,admin_signed_at,admin_signature_name,contract_drivers(driver_id,is_trainee,driver:profiles(full_name,role)),contract_checklists(template_id))",
    )
    .order("starts_on", { ascending: true });
  if (error) throw error;
  const shows = data as AdminShow[];
  return release.channel === "beta" ? shows : shows.filter((show) => !show.is_test);
}
export async function createShow(
  input: ShowInput,
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
export async function getTeamMembers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url,phone,role,is_active")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return data as Profile[];
}
export async function getUsers() {
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
  service_time?: string | null;
  contract_pay: number | null;
  bonus_pay: number | null;
  terms: string | null;
  template_id?: string;
}) {
  let contractId = input.id;
  const values = {
    show_id: input.show_id,
    driver_id: input.driver_ids[0] || null,
    kind: input.kind,
    service_date: input.service_date,
    service_time: input.service_time || null,
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
  const { data: currentAssignments, error: currentError } = await supabase
    .from("contract_drivers")
    .select("driver_id")
    .eq("contract_id", contractId);
  if (currentError) throw currentError;
  const removedIds = (currentAssignments || [])
    .map((assignment) => assignment.driver_id)
    .filter((driverId) => !input.driver_ids.includes(driverId));
  if (removedIds.length) {
    const { error } = await supabase
      .from("contract_drivers")
      .delete()
      .eq("contract_id", contractId)
      .in("driver_id", removedIds);
    if (error) throw error;
  }
  if (input.driver_ids.length) {
    const { error } = await supabase
      .from("contract_drivers")
      .upsert(
        input.driver_ids.map((driver_id, index) => ({
          contract_id: contractId,
          driver_id,
          is_trainee: index > 0,
        })),
        { onConflict: "contract_id,driver_id" },
      );
    if (error) throw error;
  }
  if (input.template_id) {
    await assignShowChecklist(input.show_id, input.kind, input.template_id);
    const { error: assignError } = await supabase.rpc("admin_assign_checklist", {
      target_contract: contractId,
      target_template: input.template_id,
    });
    if (assignError) throw assignError;
  } else {
    const [{ error: showChecklistError }, { error: contractChecklistError }] = await Promise.all([
      supabase
        .from("show_checklist_templates")
        .delete()
        .eq("show_id", input.show_id)
        .eq("kind", input.kind),
      supabase.from("contract_checklists").delete().eq("contract_id", contractId),
    ]);
    if (showChecklistError) throw showChecklistError;
    if (contractChecklistError) throw contractChecklistError;
  }
  return contractId;
}
export type AdminAvailabilityPerson = Profile & {
  availability_status: "available" | "unavailable" | "pending" | "assigned" | null;
  assigned: boolean;
};
export async function getShowAvailabilityAdmin(showId: string, contractId?: string) {
  const [members, availabilityResult, assignmentsResult] = await Promise.all([
    getTeamMembers(),
    supabase.from("availability").select("driver_id,status").eq("show_id", showId),
    contractId
      ? supabase.from("contract_drivers").select("driver_id").eq("contract_id", contractId)
      : Promise.resolve({ data: [] as { driver_id: string }[], error: null }),
  ]);
  if (availabilityResult.error) throw availabilityResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  const statuses = new Map((availabilityResult.data || []).map((row) => [row.driver_id, row.status]));
  const assigned = new Set((assignmentsResult.data || []).map((row) => row.driver_id));
  return members.map((member) => ({ ...member, availability_status: statuses.get(member.id) || null, assigned: assigned.has(member.id) })) as AdminAvailabilityPerson[];
}
export async function updateContractAssignments(contractId: string, driverIds: string[]) {
  const { error: contractError } = await supabase.from("contracts").update({ driver_id: driverIds[0] || null }).eq("id", contractId);
  if (contractError) throw contractError;
  const { error: deleteError } = await supabase.from("contract_drivers").delete().eq("contract_id", contractId);
  if (deleteError) throw deleteError;
  if (driverIds.length) {
    const { error } = await supabase.from("contract_drivers").insert(driverIds.map((driver_id, index) => ({ contract_id: contractId, driver_id, is_trainee: index > 0 })));
    if (error) throw error;
  }
}
export async function updateLinkedSigningAssignments(showIds: string[], driverIds: string[]) {
  if (!showIds.length) return;
  const { data: links, error: linkError } = await supabase.from("show_links").select("show_id,linked_show_id");
  if (linkError) throw linkError;
  const connected = new Set(showIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of links || []) {
      if (connected.has(link.show_id) && !connected.has(link.linked_show_id)) { connected.add(link.linked_show_id); changed = true; }
      if (connected.has(link.linked_show_id) && !connected.has(link.show_id)) { connected.add(link.show_id); changed = true; }
    }
  }
  const { data, error } = await supabase.from("contracts").select("id").in("show_id", [...connected]);
  if (error) throw error;
  for (const contract of data || []) await updateContractAssignments(contract.id, driverIds);
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
    .order("service_date");
  if (error) throw error;
  const reviews = data as unknown as (Contract & {
    submitted_at: string | null;
    driver: { id: string; full_name: string };
  })[];
  return release.channel === "beta" ? reviews : reviews.filter((review) => !review.show.is_test);
}
export type ReviewHistoryRow = Contract & {
  submitted_at: string | null;
  reviewed_at: string;
  driver: { id: string; full_name: string } | null;
  reviewer: { id: string; full_name: string } | null;
};
export async function getReviewHistory() {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id,kind,status,submitted_at,reviewed_at,admin_note,show:shows(*),driver:profiles!contracts_driver_id_fkey(id,full_name),reviewer:profiles!contracts_reviewed_by_fkey(id,full_name)",
    )
    .not("reviewed_at", "is", null)
    .order("service_date");
  if (error) throw error;
  return (data || []).filter(
    (review) => !["submitted", "under_review"].includes(review.status),
  ).filter((review) => release.channel === "beta" || !(review.show as unknown as Show).is_test) as unknown as ReviewHistoryRow[];
}
export async function getChecklistReview(contractId: string) {
  const [{ data, error }, checklist] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id,kind,status,service_date,contract_pay,bonus_pay,submitted_at,reviewed_at,admin_note,show:shows(*),driver:profiles!contracts_driver_id_fkey(id,full_name),reviewer:profiles!contracts_reviewed_by_fkey(id,full_name),contract_drivers(driver_id,is_trainee,driver:profiles(id,full_name))",
      )
      .eq("id", contractId)
      .single(),
    getChecklist(contractId),
  ]);
  if (error) throw error;
  if (release.channel !== "beta" && (data as unknown as { show: Show }).show.is_test) throw new Error("This test checklist is only available in beta.");
  return {
    contract: data as unknown as Contract & {
      submitted_at: string | null;
      reviewed_at: string | null;
      driver: { id: string; full_name: string } | null;
      reviewer: { id: string; full_name: string } | null;
      contract_drivers: {
        driver_id: string;
        is_trainee: boolean;
        driver: { id: string; full_name: string } | null;
      }[];
    },
    checklist,
  };
}
export async function reviewChecklistItem(
  contractId: string,
  itemId: string,
  status: "approved" | "denied",
  note: string,
) {
  const { error } = await supabase.rpc("admin_review_checklist_item", {
    target_contract: contractId,
    target_item: itemId,
    target_status: status,
    target_note: note || null,
  });
  if (error) throw error;
}
export async function finalizeChecklistReview(contractId: string) {
  const { data, error } = await supabase.rpc(
    "admin_finalize_checklist_review",
    { target_contract: contractId },
  );
  if (error) throw error;
  return data as "approved" | "in_progress";
}
export async function setContractBonusResult(contractId: string, earned: boolean) {
  const { error } = await supabase.rpc("admin_set_bonus_result", {
    target_contract: contractId,
    earned,
  });
  if (error) throw error;
}
export async function getTemplates() {
  const { data, error } = await supabase
    .from("checklist_templates")
    .select(
      "id,name,kind,version,active,sections:checklist_sections(id,title,position,items:checklist_items(id,title,photo_required,required,position))",
    )
    .eq("active", true)
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
export async function getAdminResources() {
  const { data, error } = await supabase
    .from("resources")
    .select("id,kind,title,content,file_path,position,published")
    .order("position")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as AdminResource[];
}
export async function saveResource(resource: Omit<AdminResource, "id"> & { id?: string }) {
  const values = {
    kind: resource.kind,
    title: resource.title.trim(),
    content: resource.content?.trim() || null,
    file_path: resource.file_path,
    position: resource.position,
    published: resource.published,
  };
  const query = resource.id
    ? supabase.from("resources").update(values).eq("id", resource.id)
    : supabase.from("resources").insert(values);
  const { error } = await query;
  if (error) throw error;
}
export async function deleteResource(id: string) {
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) throw error;
}
export async function reorderResources(ids: string[]) {
  const updates = await Promise.all(ids.map((id, position) =>
    supabase.from("resources").update({ position }).eq("id", id),
  ));
  const failed = updates.find((result) => result.error)?.error;
  if (failed) throw failed;
}
export async function getToolbags() {
  const { data, error } = await supabase
    .from("toolbags")
    .select(
      "id,number,notes,assigned_to,driver:profiles(full_name,role),items:toolbag_items(id,name,quantity,position)",
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
export async function updateToolbag(id: string, number: string, driver: string | null) {
  const { error } = await supabase
    .from("toolbags")
    .update({ number: number.trim(), assigned_to: driver || null })
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
export async function getContractTemplates() {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("id,name,kind,terms,active")
    .order("name");
  if (error) throw error;
  return (data || []) as ContractTemplate[];
}
export async function saveContractTemplate(template: Omit<ContractTemplate, "id"> & { id?: string }) {
  const values = {
    name: template.name.trim(),
    kind: template.kind,
    terms: template.terms,
    active: template.active,
    updated_at: new Date().toISOString(),
  };
  const query = template.id
    ? supabase.from("contract_templates").update(values).eq("id", template.id)
    : supabase.from("contract_templates").insert(values);
  const { error } = await query;
  if (error) throw error;
}
export async function getShowLinks() {
  const { data, error } = await supabase.from("show_links").select("show_id,linked_show_id");
  if (error) throw error;
  return data || [];
}
export async function saveShowLinks(showId: string, linkedIds: string[]) {
  const { error: deleteError } = await supabase
    .from("show_links")
    .delete()
    .or(`show_id.eq.${showId},linked_show_id.eq.${showId}`);
  if (deleteError) throw deleteError;
  if (!linkedIds.length) return;
  const rows = linkedIds
    .filter((id) => id !== showId)
    .map((id) => ({ show_id: [showId, id].sort()[0], linked_show_id: [showId, id].sort()[1] }));
  const { error } = await supabase.from("show_links").upsert(rows, { onConflict: "show_id,linked_show_id" });
  if (error) throw error;
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
export async function updateToolbagTemplate(
  id: string,
  name: string,
  items: { name: string; quantity: number }[],
) {
  const { error } = await supabase.rpc("admin_replace_toolbag_template", {
    target_template: id,
    target_name: name,
    target_items: items,
  });
  if (error) throw error;
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

export type BetaTestShow = {
  id: string;
  name: string;
  contract_id: string;
};

export async function getBetaTestShow(userId: string) {
  if (release.channel !== "beta") return null;
  const { data, error } = await supabase
    .from("shows")
    .select("id,name,contracts(id)")
    .eq("is_test", true)
    .eq("test_owner", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const contracts = (data.contracts || []) as { id: string }[];
  return { id: data.id, name: data.name, contract_id: contracts[0]?.id || "" } as BetaTestShow;
}

export async function resetBetaTestShow() {
  if (release.channel !== "beta") throw new Error("The Test Show is only available in beta.");
  const { data, error } = await supabase.rpc("reset_my_beta_test_show");
  if (error) throw error;
  const result = data as { show_id: string; contract_id: string; photo_paths: string[] };
  if (result.photo_paths?.length) {
    const { error: storageError } = await supabase.storage.from("roadshow-photos").remove(result.photo_paths);
    if (storageError) console.warn("Test photo cleanup was incomplete:", storageError.message);
  }
  return result;
}
