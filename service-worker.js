const CACHE_NAME = 'paleo-heritage-v1';
const ASSETS = [
    './',
    'index.html',
    'css/style.css',
    'js/app.js',
    'js/map.js',
    'js/ui.js',
    'js/store.js',
    'js/export.js',
    'public/logo paleo heritage.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
