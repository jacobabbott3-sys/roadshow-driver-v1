import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type WebhookPayload = {
  table: "messages" | "notifications";
  type: "INSERT";
  record: {
    id: string;
    recipient_id: string;
    subject?: string;
    title?: string;
    body: string;
    link?: string | null;
    kind?: string;
  };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret || request.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey || !subject) {
    return new Response("Missing server configuration", { status: 500 });
  }

  const payload = (await request.json()) as WebhookPayload;
  const record = payload.record;
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("device_notifications,assignment_alerts,work_day_alerts,message_alerts")
    .eq("user_id", record.recipient_id)
    .maybeSingle();

  const categoryEnabled =
    payload.table === "messages"
      ? preferences?.message_alerts
      : record.kind === "assignment"
        ? preferences?.assignment_alerts
        : record.kind === "work_day"
          ? preferences?.work_day_alerts
          : true;
  if (!preferences?.device_notifications || !categoryEnabled) {
    return Response.json({ sent: 0, skipped: true });
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", record.recipient_id);
  if (error) return new Response(error.message, { status: 500 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  let sent = 0;
  await Promise.all(
    (subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title:
              payload.table === "messages"
                ? record.subject || "New message"
                : record.title || "Roadshow Driver",
            body: record.body,
            link: payload.table === "messages" ? "/messages" : record.link,
            tag: `${payload.table}-${record.id}`,
          }),
        );
        sent += 1;
      } catch (pushError) {
        const statusCode =
          typeof pushError === "object" && pushError && "statusCode" in pushError
            ? Number(pushError.statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
        } else {
          console.error(pushError);
        }
      }
    }),
  );
  return Response.json({ sent });
});
