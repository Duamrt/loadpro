const CACHE_NAME = 'loadpro-20260622-webpush';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json?v=20260622-webpush',
  '/css/app.css?v=20260622-webpush',
  '/js/config.js?v=20260621-launch',
  '/js/auth.js?v=20260621-launch',
  '/js/hydration.js?v=20260621-launch',
  '/js/weight.js?v=20260621-launch',
  '/js/workout.js?v=20260621-launch',
  '/js/diet.js?v=20260621-launch',
  '/js/notifications.js?v=20260622-webpush',
  '/js/app.js?v=20260622-webpush',
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

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (err) {
      payload = { body: event.data.text() };
    }
  }
  const title = payload.title || 'LoadPro';
  const options = {
    body: payload.body || 'Hora de registrar seu plano do dia.',
    icon: payload.icon || '/icons/loadpro-icon.svg',
    badge: payload.badge || '/icons/loadpro-icon.svg',
    tag: payload.tag || 'loadpro-push',
    renotify: true,
    data: {
      url: payload.url || '/?screen=today'
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/?screen=today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    })
  );
});
