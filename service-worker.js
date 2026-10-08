const CACHE_NAME = 'paleo-tracker-v26';
const TILES_CACHE = 'map-tiles-v1';

const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/map.js',
    './js/ui.js',
    './js/store.js',
    './js/sync-manager.js',
    './js/export.js',
    './js/documentation.js',
    './js/partes-diarios.js',
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

    // Default: NO interceptar (API del backend en onrender.com y otros dominios).
    // Si el SW hace de intermediario y su fetch falla, la página recibe "Failed to fetch".
    // Dejando que el navegador lo maneje directo se elimina ese punto de falla.
    return;
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

// Baja todos los .js/.css locales que usa la página y recién después guarda la página
async function guardarPaginaCompleta(cache, request, response) {
    try {
        const html = await response.clone().text();
        const base = new URL(request.url);
        const urls = new Set();
        const re = /(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const u = new URL(m[1], base);
            if (u.origin === base.origin) urls.add(u.href);
        }
        for (const u of urls) {
            if (await cache.match(u)) continue;
            const r = await fetch(u, { cache: 'no-cache' });
            if (!r.ok) return false;
            await cache.put(u, r);
        }
        await cache.put(request, response);
        return true;
    } catch (e) {
        return false;
    }
}

// Archivos de la app: primero la copia guardada (abre al instante, con o sin señal)
// y en segundo plano se busca la versión nueva en GitHub para la próxima vez que se abra.
// Los .js llevan "?v=..." en index.html: cuando cambia la versión, se bajan como archivos nuevos.
async function handleAppRequest(request) {
    if (request.method !== 'GET') return fetch(request);

    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const esPagina = request.mode === 'navigate' || request.url.endsWith('.html') || request.url.endsWith('/');
    // cache: 'no-cache' → siempre pregunta a GitHub si hay versión nueva (si no cambió, la respuesta es mínima).
    // Sin esto, el celular podía devolver por hasta 10 minutos la página vieja que tenía guardada.
    const actualizar = fetch(esPagina ? request.url : request, { cache: 'no-cache', credentials: 'same-origin' })
        .then(async networkResponse => {
            if (networkResponse && networkResponse.ok) {
                if (esPagina) {
                    // La página nueva se guarda SOLO si se pudieron bajar todos sus archivos (.js, .css):
                    // así nunca queda una página nueva apuntando a archivos que no están en el celular.
                    const ok = await guardarPaginaCompleta(cache, request, networkResponse.clone());
                    if (!ok) console.log('[SW] Actualización incompleta, se mantiene la versión anterior');
                } else {
                    await cache.put(request, networkResponse.clone());
                }
            }
            return networkResponse;
        })
        .catch(() => null);

    if (cached) {
        // Responder ya con lo guardado; la actualización sigue sola en segundo plano
        return cached;
    }

    // No estaba guardado (primera vez o archivo nuevo): esperar a la red
    const networkResponse = await actualizar;
    if (networkResponse) return networkResponse;

    // Sin red y sin copia: para la página principal, devolver index.html guardado
    if (request.mode === 'navigate') {
        const indexResponse = await cache.match('./index.html') || await cache.match('./');
        if (indexResponse) return indexResponse;
    }

    return new Response('Offline - Resource not available', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

// Background Sync - se dispara automáticamente cuando recupera conexión
self.addEventListener('sync', (event) => {
    if (event.tag === 'paleo-sync') {
        event.waitUntil(backgroundSync());
    }
});

async function backgroundSync() {
    try {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });

        if (allClients.length > 0) {
            // Notificar al cliente que dispare la sync
            allClients.forEach(client => {
                client.postMessage({ action: 'background-sync-triggered' });
            });
        } else {
            console.log('[SW] Background sync: no hay clientes activos, el usuario debe abrir la app');
        }
    } catch (error) {
        console.error('[SW] Background sync failed:', error);
        throw error;
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

    // Cliente responde al background-sync-triggered — no necesita acción adicional del SW
    if (event.data.action === 'sync-complete') {
        console.log('[SW] Sync completado por el cliente');
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
