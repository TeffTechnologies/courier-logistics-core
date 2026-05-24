const CACHE_NAME = 'courier-v1';
const ASSETS_TO_CACHE = [
  '/courier.html',
  '/css/global.css',
  '/css/courier.css',
  '/manifest.json'
];

// 1. Install Phase: Cache the core UI shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching UI App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate Phase: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache storage:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Phase: Serve assets from Cache first, fall back to Network
// This ensures the page opens instantly even with zero cell service.
self.addEventListener('fetch', (event) => {
  // Only handle standard GET requests for local static assets
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request);
    })
  );
});