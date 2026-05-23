self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("jyotish-arogya-v1").then((cache) => cache.addAll(["/", "/styles.css", "/app.js", "/manifest.webmanifest"]))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
