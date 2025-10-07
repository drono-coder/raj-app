// Service Worker for Raj App - Enhanced Version
// Provides caching, offline functionality, and Firebase sync support

const CACHE_NAME = 'raj-app-v2';
const BASE_PATH = '/raj-app';

// Resources to cache
const urlsToCache = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/icons/icons-192x192.jpg`,
    `${BASE_PATH}/icons/icons-512x512.jpg`,
    // Firebase SDK URLs
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
    console.log('Service Worker: Installing v2...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Service Worker: Caching app shell and Firebase SDK');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.error('Service Worker: Cache failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('Service Worker: Activating v2...');
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
    const requestUrl = new URL(event.request.url);
    
    // Skip Firebase and Google APIs - let them handle their own networking
    if (requestUrl.hostname.includes('firebase.googleapis.com') ||
        requestUrl.hostname.includes('firestore.googleapis.com') ||
        requestUrl.hostname.includes('identitytoolkit.googleapis.com') ||
        requestUrl.hostname.includes('securetoken.googleapis.com') ||
        requestUrl.hostname.includes('googleapis.com') ||
        requestUrl.hostname.includes('gstatic.com')) {
        
        // For Firebase SDK files from gstatic.com, try cache first then network
        if (requestUrl.hostname.includes('gstatic.com') && requestUrl.pathname.includes('firebase')) {
            event.respondWith(
                caches.match(event.request)
                    .then(function(cachedResponse) {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        return fetch(event.request);
                    })
            );
        } else {
            // For Firebase APIs, always go to network
            return;
        }
        return;
    }
    
    // Handle app requests with cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Cache hit - return cached version
                if (response) {
                    console.log('Service Worker: Serving from cache:', event.request.url);
                    return response;
                }
                
                // No cache hit - fetch from network
                console.log('Service Worker: Fetching from network:', event.request.url);
                return fetch(event.request).then(
                    function(response) {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response for caching
                        const responseToCache = response.clone();
                        
                        // Cache the fetched resource
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            })
                            .catch(function(error) {
                                console.warn('Service Worker: Failed to cache resource:', error);
                            });
                        
                        return response;
                    }
                );
            })
            .catch(function(error) {
                console.error('Service Worker: Fetch failed for', event.request.url, error);
                
                // For navigation requests, return the main page from cache
                if (event.request.mode === 'navigate') {
                    return caches.match(`${BASE_PATH}/index.html`) || 
                           caches.match(`${BASE_PATH}/`);
                }
                
                // For other requests, you could return a fallback response
                return new Response('Offline - resource not available', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});

// Background sync for offline actions
self.addEventListener('sync', function(event) {
    console.log('Service Worker: Background sync triggered:', event.tag);
    
    if (event.tag === 'firebase-sync') {
        event.waitUntil(
            // Notify the app that network is available for Firebase sync
            self.clients.matchAll().then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({
                        type: 'SYNC_AVAILABLE',
                        timestamp: Date.now()
                    });
                });
            })
        );
    }
});

// Push notification handling (for future use)
self.addEventListener('push', function(event) {
    console.log('Service Worker: Push notification received');
    
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'You have a new notification',
            icon: `${BASE_PATH}/icons/icons-192x192.jpg`,
            badge: `${BASE_PATH}/icons/icons-192x192.jpg`,
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: data.primaryKey || 'default'
            },
            actions: [
                {
                    action: 'explore',
                    title: 'View App',
                    icon: `${BASE_PATH}/icons/icons-192x192.jpg`
                },
                {
                    action: 'close',
                    title: 'Close notification',
                    icon: `${BASE_PATH}/icons/icons-192x192.jpg`
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'Raj Enterprise', options)
        );
    }
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    console.log('Service Worker: Notification click received.');
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Open the app
        event.waitUntil(
            clients.openWindow(`${self.location.origin}${BASE_PATH}/`)
        );
    }
});

// Handle message from main app
self.addEventListener('message', function(event) {
    console.log('Service Worker: Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME,
            timestamp: Date.now()
        });
    }
});

// Cleanup old caches periodically
self.addEventListener('activate', function(event) {
    event.waitUntil(
        // Delete old caches
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName.startsWith('raj-app-') && cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

console.log('Service Worker: Script loaded and ready');
