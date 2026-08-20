const CACHE = 'vtrade-shell-v3';
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

  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (req.method !== 'GET') return;

  // Never serve an old cached auth/RBAC/connection script. These scripts control
  // mobile role routing and session state, so they must always be revalidated.
  const liveScripts = /\/(vtrade-rbac-guard|vtrade-connection|terminal-pre-market)\.js$/i.test(url.pathname);
  if (liveScripts) {
    event.respondWith(fetch(new Request(req, {cache:'no-store'})).catch(() => caches.match(req)));
    return;
  }

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

  // Other static assets: stale-while-revalidate.
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
