const CACHE_NAME = 'paleo-heritage-v11';
const TILES_CACHE = 'map-tiles-v1';

const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/map.js',
    './js/ui.js',
    './js/store.js',
    './js/export.js',
    './public/logo paleo heritage.png',
    './public/manifest.json'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets...');
                // Cache local assets first
                return cache.addAll(ASSETS)
                    .then(() => {
                        // Try to cache external assets (may fail if offline)
                        return Promise.allSettled(
                            EXTERNAL_ASSETS.map(url =>
                                fetch(url).then(response => {
                                    if (response.ok) {
                                        return cache.put(url, response);
                                    }
                                }).catch(() => console.log(`Could not cache ${url}`))
                            )
                        );
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old app caches but keep tiles cache
                    if (cacheName !== CACHE_NAME && cacheName !== TILES_CACHE) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - smart caching strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategy for map tiles (Esri satellite imagery)
    if (url.hostname.includes('arcgisonline.com') ||
        url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(handleTileRequest(event.request));
        return;
    }

    // Strategy for external CDN resources (Leaflet)
    if (url.hostname === 'unpkg.com' ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com')) {
        event.respondWith(handleCDNRequest(event.request));
        return;
    }

    // Strategy for local app resources - Network first, then cache
    if (url.origin === location.origin) {
        event.respondWith(handleAppRequest(event.request));
        return;
    }

    // Default - just fetch
    event.respondWith(fetch(event.request));
});

// Handle map tile requests - Cache first, then network
async function handleTileRequest(request) {
    const cache = await caches.open(TILES_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Return cached tile immediately
        // Also try to update cache in background (stale-while-revalidate)
        fetchAndCacheTile(request, cache);
        return cachedResponse;
    }

    // Not in cache, fetch from network
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Cache the tile for future use
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Network failed, return a placeholder or error
        console.log('Tile not available offline:', request.url);
        return new Response('', { status: 404 });
    }
}

// Background update for tiles
async function fetchAndCacheTile(request, cache) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse);
        }
    } catch (error) {
        // Silently fail for background updates
    }
}

// Handle CDN requests - Cache first with network fallback
async function handleCDNRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('CDN resource not available:', request.url);
        return new Response('', { status: 404 });
    }
}

// Handle app requests - Network first with cache fallback
async function handleAppRequest(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        // Try network first for fresh content
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Update cache with new version
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Network failed, use cached version
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If requesting a page, return index.html (SPA behavior)
        if (request.mode === 'navigate') {
            const indexResponse = await cache.match('./index.html');
            if (indexResponse) {
                return indexResponse;
            }
        }

        return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Message handling for cache management
self.addEventListener('message', (event) => {
    if (event.data.action === 'clearTilesCache') {
        caches.delete(TILES_CACHE).then(() => {
            console.log('Tiles cache cleared');
            event.ports[0].postMessage({ success: true });
        });
    }

    if (event.data.action === 'getCacheSize') {
        getCacheSize().then(size => {
            event.ports[0].postMessage({ size });
        });
    }
});

// Calculate cache size
async function getCacheSize() {
    let totalSize = 0;
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.clone().blob();
                totalSize += blob.size;
            }
        }
    }

    return totalSize;
}
