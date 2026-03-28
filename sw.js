const CACHE_NAME = 'loadpro-v20260328143908';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/utils.js',
  '/js/sidebar.js',
  '/aluno/dashboard.html',
  '/aluno/treino.html',
  '/aluno/dieta.html',
  '/aluno/medidas.html',
  '/aluno/perfil.html',
  '/personal/dashboard.html',
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

  // API calls (Supabase): network only, don't cache
  if (url.hostname.includes('supabase') || url.hostname.includes('unpkg') || url.hostname.includes('cdn.jsdelivr')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static assets: stale-while-revalidate
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
