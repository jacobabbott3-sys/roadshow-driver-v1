self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Roadshow Driver", {
      body: payload.body || "You have a new update.",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: payload.tag || "roadshow-update",
      data: { url: payload.link || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const openWindow = windows.find((windowClient) => windowClient.url === target);
      return openWindow ? openWindow.focus() : clients.openWindow(target);
    }),
  );
});
