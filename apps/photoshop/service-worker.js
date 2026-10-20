/**
 * Aksh Photoshop - Dedicated Application Service Worker
 * Scope: /apps/photoshop/
 * Cache-First Strategy for complete offline photo editing
 */

const CACHE_NAME = 'aksh-photoshop-v1.3.0';

// Relative assets belonging strictly to Aksh Photoshop and its verified logos
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './lib/ag-psd.js',
    './lib/ag-psd.LICENSE',
    './js/icons.js',
    './js/utils.js',
    './js/storage.js',
    './js/history.js',
    './js/selection.js',
    './js/layers.js',
    './js/adjustments.js',
    './js/tools.js',
    './js/psd-handler.js',
    './js/project-handler.js',
    './js/app.js',
    '/assets/photoshop-logo.png',
    '/assets/aksh-logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn('[SW] Some assets failed to precache during install:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key.startsWith('aksh-photoshop-') && key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Only intercept requests for our own origin
    if (url.origin !== self.location.origin) return;

    // Strictly restrict interception to the Photoshop application scope and verified root logos:
    const isAppScope = url.pathname.includes('/apps/photoshop/');
    const isRootLogo = url.pathname.endsWith('/photoshop-logo.png') || url.pathname.endsWith('/aksh-logo.png');

    if (!isAppScope && !isRootLogo) {
        return; // Pass through to browser / root sw for unrelated apps, dashboard, etc.
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Cache newly fetched application assets
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // If network fails and requesting an HTML document, fallback to index.html
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('./index.html');
                }
                return new Response('Network offline and resource not cached.', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({ 'Content-Type': 'text/plain' })
                });
            });
        })
    );
});
