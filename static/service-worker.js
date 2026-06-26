const CACHE_VERSION = "fiber-locator-20260626143000";
const APP_SHELL = [
  "/",
  "/mobile",
  "/manifest.webmanifest",
  "/static/styles.css?v=20260626143000",
  "/static/app.js?v=20260626143000",
  "/static/assets/finallandscapelocator.png?v=20260606120000",
  "/static/finalapplocator.png?v=20260606120000",
  "/static/finallandscapelocator.png?v=20260606120000"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(request))
  );
});
