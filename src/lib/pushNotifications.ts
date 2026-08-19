import { supabase } from "./supabase";

export type NotificationPreferences = {
  user_id: string;
  device_notifications: boolean;
  assignment_alerts: boolean;
  work_day_alerts: boolean;
  message_alerts: boolean;
  updated_at: string;
};

export const defaultNotificationPreferences: Omit<
  NotificationPreferences,
  "user_id" | "updated_at"
> = {
  device_notifications: false,
  assignment_alerts: true,
  work_day_alerts: true,
  message_alerts: true,
};

export function deviceNotificationsSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (
    data || {
      user_id: userId,
      ...defaultNotificationPreferences,
      updated_at: new Date().toISOString(),
    }
  ) as NotificationPreferences;
}

export async function saveNotificationPreferences(
  userId: string,
  values: Partial<NotificationPreferences>,
) {
  const { error } = await supabase
    .from("notification_preferences")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function enableDeviceNotifications(userId: string) {
  if (!deviceNotificationsSupported()) {
    throw new Error("Device notifications are not supported in this browser.");
  }
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Device notifications have not been configured yet.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked in this browser's site settings."
        : "Notification permission was not granted.",
    );
  }
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("The browser did not return a valid push subscription.");
  }
  const { error } = await supabase.rpc("save_my_push_subscription", {
    target_endpoint: json.endpoint,
    target_p256dh: json.keys.p256dh,
    target_auth: json.keys.auth,
    target_user_agent: navigator.userAgent,
  });
  if (error) throw error;
  await saveNotificationPreferences(userId, { device_notifications: true });
}

export async function disableDeviceNotifications(userId: string) {
  if (deviceNotificationsSupported()) {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const { error } = await supabase.rpc("remove_my_push_subscription", {
        target_endpoint: subscription.endpoint,
      });
      if (error) throw error;
      await subscription.unsubscribe();
    }
  }
  await saveNotificationPreferences(userId, { device_notifications: false });
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
