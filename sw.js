const CACHE = 'vtrade-shell-v2';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './icons/vtrade-192.svg',
  './icons/vtrade-512.svg',
  './pwa.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache live market/API traffic. XAUUSD quotes, candles and AI confirmation must stay fresh.
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (req.method !== 'GET') return;

  // HTML navigations: network first, then cached page, then offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        return response;
      }).catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match('./index.html') || caches.match('./offline.html');
      })
    );
    return;
  }

  // Static assets: stale-while-revalidate for speed without freezing live API data.
  event.respondWith(
    caches.match(req).then(cached => {
      const refresh = fetch(req).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(req, response.clone())).catch(() => {});
        return response;
      }).catch(() => cached);
      return cached || refresh;
    })
  );
});
