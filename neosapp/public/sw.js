const CACHE_VERSION = "neos-belleza-pwa-v3";
const PRODUCT_IMAGE_CACHE = "neos-catalog-images-v1";
const MAX_CACHED_PRODUCT_IMAGES = 120;
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.ico", "/neos-icon-192.png", "/neos-icon-512.png"];

self.addEventListener("message", (event) => {
  if (event.data?.type !== "NEOS_CATALOG_CACHE_CONSENT") return;
  event.waitUntil(event.data.enabled
    ? caches.open(PRODUCT_IMAGE_CACHE).then(() => undefined)
    : caches.delete(PRODUCT_IMAGE_CACHE).then(() => undefined));
});

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
  if (request.method !== "GET") return;

  // Las fotos públicas del catálogo son externas (Supabase Storage). Se cachean
  // solo después de que el usuario acepte, y únicamente a medida que las consulta.
  if (request.destination === "image" && url.pathname.includes("/storage/v1/object/public/")) {
    event.respondWith((async () => {
      if (!(await caches.has(PRODUCT_IMAGE_CACHE))) return fetch(request);
      const cache = await caches.open(PRODUCT_IMAGE_CACHE);
      const cached = await cache.match(request);
      if (cached) {
        // Mover al final conserva las imágenes usadas recientemente al limitar la caché.
        await cache.delete(request);
        await cache.put(request, cached.clone());
        return cached;
      }

      const response = await fetch(request);
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_CACHED_PRODUCT_IMAGES)).map((key) => cache.delete(key)));
      }
      return response;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

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
