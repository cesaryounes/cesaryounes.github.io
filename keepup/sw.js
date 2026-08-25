// KeepUp web dashboard — Service Worker (user request 08-24: "all notifications, can they get
// them outside the web notification?" → "yes build it"). Its only job is receiving Web Push
// messages and turning them into real OS-level notifications — everything else on this page
// (tabs, data loading, the in-page bell panel) runs on the main thread and doesn't touch this file
// at all. Must be served from web/photo-upload/ (the same directory as index.html) — a Service
// Worker's default scope is the directory it's served from, and registration in index.html doesn't
// override that, so this can't live in a subfolder and still control the page.

// Every push payload is the JSON string send-notifications' sendWebPush() builds:
// { title, body, data: { type, ...extra } } — see supabase/functions/send-notifications/index.ts.
// Same KeepUp mark as index.html's favicon/apple-touch-icon, rasterized to PNG (see the FIX
// comment on the `push` handler below for why this needs to be PNG and not the SVG those use).
const KEEPUP_ICON_PNG =
  "data:image/png;base64,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";

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
      // FIX (user report 08-24: "notification shows chrome logo...can it be keepup logo") — this
      // page's only icon asset used to be an inline SVG data URI, and SVG notification icons render
      // unreliably across browsers (several fall back to a generic browser icon instead), which is
      // exactly what was reported. Notification icons need a raster format, so this is the same
      // launcher mark (ic_launcher_foreground.xml) rasterized to a 192x192 PNG data URI — no extra
      // network request, no separate file to keep in sync with the source SVG's colors.
      icon: KEEPUP_ICON_PNG,
      badge: KEEPUP_ICON_PNG,
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
        // FIX (user report 08-25: received nudges play no mascot animation on web) — the
        // already-open-tab path above forwards the whole `data` object as-is (preset_id included),
        // but this fresh-tab fallback used to only carry type/title/body, so a nudge opened this
        // way fell back to the plain bell even though the sender did pick a preset.
        if (data.preset_id) params.set("notifPreset", data.preset_id);
        // FIX (user report 08-25: nudge now shows a full-screen overlay with "<sender> nudged
        // you!" — needs the real sender name, same reasoning as preset_id above).
        if (data.sender_name) params.set("notifSender", data.sender_name);
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
