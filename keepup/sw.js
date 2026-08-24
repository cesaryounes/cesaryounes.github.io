// KeepUp web dashboard — Service Worker (user request 08-24: "all notifications, can they get
// them outside the web notification?" → "yes build it"). Its only job is receiving Web Push
// messages and turning them into real OS-level notifications — everything else on this page
// (tabs, data loading, the in-page bell panel) runs on the main thread and doesn't touch this file
// at all. Must be served from web/photo-upload/ (the same directory as index.html) — a Service
// Worker's default scope is the directory it's served from, and registration in index.html doesn't
// override that, so this can't live in a subfolder and still control the page.

// Every push payload is the JSON string send-notifications' sendWebPush() builds:
// { title, body, data: { type, ...extra } } — see supabase/functions/send-notifications/index.ts.
self.addEventListener("push", (event) => {
  let payload = { title: "KeepUp", body: "You have a new notification." };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    console.error("Push payload wasn't valid JSON:", e);
  }

  // title/body ride along INSIDE the notification's own `data` too (not just as the visible
  // title/body args below) — notificationclick only gets event.notification.data back, and the
  // tip-routing case (see index.html's handleNotificationRouting) needs the actual message text
  // to show, not just a bare `type`.
  const data = { ...(payload.data || {}), title: payload.title, body: payload.body };
  event.waitUntil(
    self.registration.showNotification(payload.title || "KeepUp", {
      body: payload.body || "",
      // No explicit icon/badge — this page's only icon asset is an inline SVG data URI (the PWA
      // manifest/apple-touch-icon use it), and SVG notification icons render unreliably across
      // browsers. Leaving these unset lets each browser fall back to its own default (usually the
      // site favicon) rather than risk a broken or blank icon.
      // Same event carrying the same tag twice (e.g. a retried push) collapses into one
      // notification instead of stacking duplicates — type+timestamp keeps genuinely different
      // events distinct.
      tag: `${data.type || "notification"}-${Date.now()}`,
      data,
    }),
  );
});

// Clicking the OS notification routes by type (user request 08-24: "clicking the notification
// should either open the Daily message in a banner or go to the leaderboard in case it is a
// leaderboard update") — same idea as MainActivity.kt's handleIntent() routing a tapped Android
// push, just reached differently here since there's no deep-link Intent system on the web:
//   - an already-open tab gets a postMessage the page's own listener acts on directly
//     (handleNotificationRouting in index.html).
//   - a freshly-opened tab has no page script running yet to receive that message, so the same
//     routing info goes as URL query params instead — index.html checks for them once on load.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ source: "keepup-notification-click", data });
          return;
        }
      }
      if (self.clients.openWindow) {
        const params = new URLSearchParams();
        if (data.type) params.set("notifType", data.type);
        if (data.title) params.set("notifTitle", data.title);
        if (data.body) params.set("notifBody", data.body);
        const qs = params.toString();
        return self.clients.openWindow(qs ? `./?${qs}` : "./");
      }
    }),
  );
});

// No install-time caching — this page has no offline mode, so there's nothing to precache. Just
// take over immediately rather than waiting for the next full page load, so a freshly-registered
// worker is ready to receive a push right away.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
