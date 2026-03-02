// sw.js (v4)
// Basic offline shell caching for GitHub Pages PWA

const CACHE_NAME = "meal-planner-shell-v4";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

// Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch (network first for API calls, cache first for UI)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // If it's an API call (MealDB or USDA), don't cache it
  if (
    url.hostname.includes("themealdb.com") ||
    url.hostname.includes("nal.usda.gov")
  ) {
    return; // let network handle it normally
  }

  // For app shell files
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
