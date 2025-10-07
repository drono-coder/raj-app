    // sw.js
    const CACHE_NAME = "raj-enterprise-cache-v1";
    const BASE_PATH = "/raj-enterprises-app";
    
    const urlsToCache = [
      `${BASE_PATH}/`,
      `${BASE_PATH}/index.html`,
      `${BASE_PATH}/manifest.json`,
      `${BASE_PATH}/icons/icons-192x192.png`,
      `${BASE_PATH}/icons/icons-512x512.png`
    ];

    // Install event: cache all listed assets
    self.addEventListener('install', event => {
      event.waitUntil(
        caches.open(CACHE_NAME)
          .then(cache => {
            console.log('Service Worker: Caching app shell');
            return cache.addAll(urlsToCache);
          })
      );
    });

    // Fetch event: serve from cache first, then fall back to network
    self.addEventListener('fetch', event => {
        if (event.request.url.includes("firestore.googleapis.com")) {
        return; // let Firestore handle this directly
      }
      event.respondWith(
        caches.match(event.request)
          .then(response => {
            // Cache hit - return response
            if (response) {
              return response;
            }
            // No cache hit - fetch from network
            return fetch(event.request).then(
              response => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                  return response;
                }
                // Clone the response. A response is a stream and can only be consumed once.
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
                return response;
              }
            ).catch(error => {
              // This catch is important for full offline support.
              // If the network request fails AND the item is not in cache,
              // you can return a fallback page/resource here.
              console.error('Service Worker: Fetch failed and no cache match for', event.request.url, error);
              // For example, return an offline page:
              // return caches.match('/offline.html');
            });
          })
      );
    });

    // Activate event: clean up old caches
    self.addEventListener('activate', event => {
      const cacheWhitelist = [CACHE_NAME];
      event.waitUntil(
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => {
              if (cacheWhitelist.indexOf(cacheName) === -1) {
                console.log('Service Worker: Deleting old cache', cacheName);
                return caches.delete(cacheName);
              }
            })
          );
        })
      );
    });
    