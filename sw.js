const CACHE_NAME = 'loadpro-v20260328150712';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/utils.js',
  '/js/sidebar.js',
  '/js/admin.js',
  '/img/icon-192.svg',
  '/img/logo.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls e CDNs: network only
  if (url.hostname.includes('supabase') || url.hostname.includes('unpkg') || url.hostname.includes('cdn.jsdelivr') || url.hostname.includes('fonts.g')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTML pages: network first (sempre pega versão nova)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets (CSS/JS/img): stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
