const CACHE_NAME = "photobuddy-v4";
const STATIC_CACHE = "photobuddy-static-v1";
const STATIC_LIMIT = 250;
const SHELL = ["/", "/offline", "/manifest.webmanifest", "/icons/icon-192.png"];
// App pages kept for offline starts — /camera matters most so photos can be
// queued without signal (see src/lib/upload-queue.ts).
const OFFLINE_PAGES = ["/camera", "/gallery", "/map", "/timeline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimStatic() {
  const cache = await caches.open(STATIC_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - STATIC_LIMIT;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

/** Hashed Next.js bundles never change — serve from cache, fill on first use. */
async function staticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.put(request, copy))
      .then(trimStatic);
  }
  return response;
}

/** Network first; remember app pages so they open offline later. */
async function navigate(request, url) {
  const offlinePage = OFFLINE_PAGES.includes(url.pathname);
  try {
    const response = await fetch(request);
    if (offlinePage && response.ok && !response.redirected) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
    }
    return response;
  } catch {
    if (offlinePage) {
      const cached = await caches.match(url.pathname);
      if (cached) return cached;
    }
    return caches.match("/offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response.ok && url.pathname.startsWith("/icons/")) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Photobuddy", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      data.body = event.data ? event.data.text() : "";
    } catch {
      /* empty payload */
    }
  }
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };
  // Same tag replaces the previous notification, so a burst of uploads
  // stays one entry instead of twenty.
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Photobuddy", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            if (client.url.includes(target)) return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
        return undefined;
      }),
  );
});
