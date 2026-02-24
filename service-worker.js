const CACHE_NAME = 'lista-cache-v5';

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network First for HTML, Stale-While-Revalidate for others
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests like Google APIs or Firebase for basic caching
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests (POST, PUT, etc.) — Cache API only supports GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API proxy paths — these have their own app-level cache and proxied
  // responses cannot be reliably cloned/cached by the service worker.
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/price-api/') || url.pathname.startsWith('/gov-data-api/')) {
    return;
  }

  // HTML / Navigation requests: Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Other assets (JS, CSS, etc.): Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Silently ignore cache errors — the network response is still returned.
          cache.put(event.request, networkResponse.clone()).catch(() => {});
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      });
    })
  );
});