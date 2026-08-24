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

  const data = payload.data || {};
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

// Clicking the OS notification focuses an already-open KeepUp tab if one exists, or opens a new
// one — same "take me to the app" behavior MainActivity.kt's handleIntent() gives a tapped
// Android push, just without per-type deep-linking (every notification type routes to the same
// dashboard URL here; see this file's own top comment on why the web side keeps this simpler).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    }),
  );
});

// No install-time caching — this page has no offline mode, so there's nothing to precache. Just
// take over immediately rather than waiting for the next full page load, so a freshly-registered
// worker is ready to receive a push right away.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
