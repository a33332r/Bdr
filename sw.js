// ═══════════════════════════════════════════════════════════════
// 📡 SERVICE WORKER - Badr Archive PWA
// Offline First - يعمل بدون إنترنت
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'badr-archive-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './bdr.html',
  './manifest.json'
];

// Install - Cache static assets
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(function(err) {
        console.log('[SW] Cache failed:', err);
      })
  );

  self.skipWaiting();
});

// Activate - Clean old caches
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) {
            return name !== CACHE_NAME;
          })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  self.clients.claim();
});

// Fetch - Serve from cache or network
self.addEventListener('fetch', function(event) {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external resources
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(function(cachedResponse) {
        // Return cached version immediately
        if (cachedResponse) {
          // Update cache in background
          fetch(request)
            .then(function(networkResponse) {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(function(cache) {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(function() {
              // Network failed, but we have cached version
            });

          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then(function(networkResponse) {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Cache the new response
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, networkResponse.clone());
            });

            return networkResponse;
          })
          .catch(function() {
            // Network failed and not in cache
            // Return offline fallback for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('./bdr.html');
            }

            // Return simple error for other resources
            return new Response('Offline - Resource not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Background sync for data synchronization
self.addEventListener('sync', function(event) {
  if (event.tag === 'badr-sync') {
    event.waitUntil(
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({
            type: 'SYNC_REQUIRED',
            message: 'Data needs to be synchronized'
          });
        });
      })
    );
  }
});

// Push notification for sync completion (optional)
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
