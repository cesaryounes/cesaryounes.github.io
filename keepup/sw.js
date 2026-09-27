// KeepUp web dashboard — retired (user decision 2026-09-27: "make the web inaccessible").
// The old worker received web push and could keep serving the closed dashboard. This version
// takes over any existing registration, clears its caches, unregisters itself and reloads open
// tabs so they show the "KeepUp lives in the app" page.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: "window" });
    tabs.forEach((tab) => tab.navigate(tab.url));
  })());
});
