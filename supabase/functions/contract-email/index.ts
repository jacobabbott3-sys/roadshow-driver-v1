import { createClient } from "npm:@supabase/supabase-js@2";

type QueueWebhook = {
  type: "INSERT";
  table: "contract_email_queue";
  record: {
    id: string;
    contract_id: string;
    recipient_email: string;
    event_type: string;
  };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret || request.headers.get("x-webhook-secret") !== webhookSecret) return new Response("Unauthorized", { status: 401 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("CONTRACT_EMAIL_FROM");
  if (!supabaseUrl || !serviceKey || !resendKey || !fromAddress) return new Response("Missing server configuration", { status: 500 });

  const payload = await request.json() as QueueWebhook;
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id,status,kind,contract_pay,bonus_pay,signature_name,show:shows(name),driver:profiles!contracts_driver_id_fkey(full_name)")
    .eq("id", payload.record.contract_id)
    .single();
  if (error || !contract) {
    await supabase.from("contract_email_queue").update({ status: "failed", error_message: error?.message || "Contract not found" }).eq("id", payload.record.id);
    return new Response(error?.message || "Contract not found", { status: 500 });
  }

  const show = Array.isArray(contract.show) ? contract.show[0] : contract.show;
  const driver = Array.isArray(contract.driver) ? contract.driver[0] : contract.driver;
  const money = (value: number | null) => value == null ? "Not specified" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const bonusEarned = payload.record.event_type === "bonus_earned" || contract.status === "bonus_earned";
  const bonusLine = bonusEarned ? `<p><strong>Bonus earned:</strong> ${money(contract.bonus_pay)}</p>` : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress,
      to: [payload.record.recipient_email],
      subject: `${bonusEarned ? "Bonus earned" : "Signed contract"}: ${show?.name || "Roadshow assignment"}`,
      html: `<h2>${bonusEarned ? "Contract bonus earned" : "Contract signed"}</h2><p><strong>Show:</strong> ${escapeHtml(show?.name || "Roadshow assignment")}</p><p><strong>Driver:</strong> ${escapeHtml(driver?.full_name || contract.signature_name || "Assigned team member")}</p><p><strong>Assignment:</strong> ${contract.kind}</p><p><strong>Pay:</strong> ${money(contract.contract_pay)}</p>${bonusLine}`,
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    await supabase.from("contract_email_queue").update({ status: "failed", error_message: details.slice(0, 500) }).eq("id", payload.record.id);
    return new Response(details, { status: 500 });
  }
  await supabase.from("contract_email_queue").update({ status: "sent", sent_at: new Date().toISOString(), error_message: null }).eq("id", payload.record.id);
  return Response.json({ sent: true });
});

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
