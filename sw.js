// ============================================================================
// Aksh Studio - Progressive Web App Service Worker (sw.js)
// ============================================================================

const CACHE_NAME = "aksh-studio-v1.3";

// Only include verified existing files (Aksh Chat removed)
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/privacy.html",
  "/style.css",
  "/global-mobile.css",
  "/auth.js",
  "/assets/aksh-logo.png",
  "/assets/cal-logo.png",
  "/assets/calc-logo.png",
  "/assets/office-logo.png",
  "/assets/photoshop-logo.png",
  "/assets/support-logo.png",
  "/assets/code-playground-logo.png",
  "/assets/chat-logo.png",
  "/assets/docs-logo.png",
  "/assets/sheets-logo.png",
  "/assets/slides-logo.png",
  "/apps/calculator/index.html",
  "/apps/calculator/style.css",
  "/apps/calculator/calc.js",
  "/apps/calendar/index.html",
  "/apps/calendar/style.css",
  "/apps/calendar/app.js",
  "/apps/help-us/index.html",
  "/apps/help-us/leaderboard.html",
  "/apps/help-us/style.css",
  "/apps/help-us/help.js",
  "/apps/help-us/leaderboard.js",
  "/apps/office/index.html",
  "/apps/office/office.js",
  "/apps/office/sub-apps/documents/index.html",
  "/apps/office/sub-apps/documents/app.js",
  "/apps/photoshop/index.html",
  "/apps/photoshop/css/styles.css",
  "/apps/photoshop/js/app.js",
  "/apps/photoshop/js/tools.js",
  "/apps/photoshop/js/layers.js",
  "/apps/photoshop/js/history.js",
  "/apps/photoshop/js/adjustments.js",
  "/apps/photoshop/js/utils.js"
];

// Install Event: Cache static assets resiliently
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use allSettled so one missing asset never aborts the entire Service Worker install
      await Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          fetch(url, { cache: "no-cache" }).then((response) => {
            if (response && response.ok) {
              return cache.put(url, response);
            }
          })
        )
      );
    })
  );
});

// Activate Event: Purge outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch Event: Bypass Firebase/Firestore real-time streams, Network-First for HTML/JS
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // CRITICAL: Never intercept Firebase Auth, Firestore listen streams, or Google APIs
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("google.com")
  ) {
    return;
  }

  // Network-first strategy for same-origin requests, falling back to cache when offline
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(req);
        if (cachedResponse) return cachedResponse;
        if (req.mode === "navigate") {
          return caches.match("/index.html");
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});
