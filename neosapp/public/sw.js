const CACHE_VERSION = "neos-belleza-pwa-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.ico", "/neos-icon-192.png", "/neos-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch("/index.html")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo precargar la aplicación.");
        const html = await response.clone().text();
        const assets = [...new Set(html.match(/\/assets\/[^"'\s<>]+\.(?:js|css)(?:\?[^"'\s<>]*)?/g) || [])];
        const cache = await caches.open(CACHE_VERSION);
        await cache.put("/index.html", response);
        await cache.addAll([...APP_SHELL, ...assets]);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("neos-belleza-pwa-") && key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // No guardar respuestas de API ni sesiones: solo recursos públicos de la aplicación.
  const isAppAsset = ["script", "style", "image", "font", "worker"].includes(request.destination);
  const isNavigation = request.mode === "navigate";
  if (!isAppAsset && !isNavigation) return;

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/index.html")) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
