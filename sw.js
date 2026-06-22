const CACHE_NAME = 'loadpro-20260622-alerts';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json?v=20260622-alerts',
  '/css/app.css?v=20260622-alerts',
  '/js/config.js?v=20260621-launch',
  '/js/auth.js?v=20260621-launch',
  '/js/hydration.js?v=20260621-launch',
  '/js/weight.js?v=20260621-launch',
  '/js/workout.js?v=20260621-launch',
  '/js/diet.js?v=20260621-launch',
  '/js/notifications.js?v=20260622-alerts',
  '/js/app.js?v=20260622-alerts',
  '/icons/loadpro-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/?screen=today');
      return null;
    })
  );
});
