// Service Worker for Raj App - CORRECTED VERSION
// This service worker provides basic caching and offline functionality

const CACHE_NAME = 'raj-app-v1';
const BASE_PATH = '/raj-app';

const urlsToCache = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/icons/icons-192x192.jpg`,
    `${BASE_PATH}/icons/icons-512x512.jpg`
];

// Install event - cache resources
self.addEventListener('install', function(event) {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.log('Service Worker: Cache failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', function(event) {
    // Skip Firebase requests
    if (event.request.url.includes("firestore.googleapis.com") || 
        event.request.url.includes("firebase.googleapis.com") ||
        event.request.url.includes("googleapis.com")) {
        return; // let Firebase handle this directly
    }

    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // No cache hit - fetch from network
                return fetch(event.request).then(
                    function(response) {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response. A response is a stream and can only be consumed once.
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                ).catch(function(error) {
                    // This catch is important for full offline support.
                    console.error('Service Worker: Fetch failed and no cache match for', event.request.url, error);
                    // For example, return an offline page:
                    // return caches.match('/offline.html');
                });
            })
    );
});
