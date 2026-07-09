// Payops Service Worker v13 — network-first para HTML, cache-first para assets
const CACHE_NAME = 'payops-v24';

// Pre-cachear solo assets estáticos inmutables (imágenes, manifest)
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/logo-payops.png',
  '/logo-payops-dark.png',
  '/icon-app.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca interceptar llamadas API
  if (url.pathname.startsWith('/api/')) return;

  // Para HTML / navegación SPA: siempre red primero
  // Esto garantiza que el usuario siempre reciba el index.html más reciente
  // con las referencias correctas a los JS bundles
  const esNavegacion = request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || (!url.pathname.includes('.') && !url.pathname.startsWith('/assets/'));

  if (esNavegacion) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then(
            (cached) => cached || new Response('', { status: 503 }),
          ),
        ),
    );
    return;
  }

  // Para assets con hash en nombre (JS, CSS): cache primero (son inmutables)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
