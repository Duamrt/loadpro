// NaLinha — Service Worker (network-first para HTML/JS/CSS, cache-first para imagens)
// DEPLOY_VERSION é atualizado automaticamente pelo deploy.sh
const CACHE_NAME = 'nalinha-v20260320112817';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/dashboard.html',
  '/admin.html',
  '/agenda-semana.html',
  '/agendar.html',
  '/assinaturas.html',
  '/atividades.html',
  '/backup.html',
  '/academia.html',
  '/personal-cadastro.html',
  '/personal.html',
  '/busca.html',
  '/cliente.html',
  '/clientes.html',
  '/comandas.html',
  '/combos.html',
  '/comissoes.html',
  '/configuracoes.html',
  '/cupons.html',
  '/equipe.html',
  '/estoque.html',
  '/financeiro.html',
  '/folha-pagamento.html',
  '/galeria.html',
  '/historico-cliente.html',
  '/horarios-ociosos.html',
  '/importar-clientes.html',
  '/lembretes.html',
  '/lista-espera.html',
  '/metas.html',
  '/minha-conta.html',
  '/notificacoes.html',
  '/onboarding.html',
  '/pacotes.html',
  '/planos.html',
  '/politicas.html',
  '/promocoes.html',
  '/qrcode.html',
  '/recibo-personal.html',
  '/relatorio.html',
  '/resumo.html',
  '/retencao.html',
  '/satisfacao.html',
  '/servicos.html',
  '/css/style.css',
  '/css/layout.css',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/utils.js',
  '/js/theme.js',
  '/js/sidebar.js',
  '/js/ajuda.js',
  '/js/plan-guard.js',
  '/js/push.js',
  '/js/tour.js',
  '/js/sw-update.js',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/manifest.json',
  '/offline.html'
];

// Instala e pré-cacheia assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first para Supabase, cache-first para o resto
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Supabase e APIs sempre vão pra rede
  if (url.includes('supabase.co') || url.includes('/rest/') || url.includes('/auth/')) {
    return;
  }

  // Google Fonts — cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }

  // HTMLs, JS e CSS — network-first (sempre pega atualizado, cache como fallback)
  if (url.endsWith('.html') || url.endsWith('.js') || url.endsWith('.css') || e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') return caches.match('/offline.html');
      }))
    );
    return;
  }

  // Imagens e outros assets — cache-first, fallback rede
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp.ok && e.request.method === 'GET') {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return resp;
    })).catch(() => {})
  );
});

// ── Push Notifications ──────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'NaLinha', body: 'Novo agendamento!' };
  try {
    if (e.data) data = e.data.json();
  } catch (err) {
    if (e.data) data.body = e.data.text();
  }

  const options = {
    body: data.body,
    icon: '/img/icon-192.png',
    badge: '/img/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'nalinha-' + (data.tag || Date.now()),
    renotify: true,
    data: { url: data.url || '/dashboard.html' }
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// Ao clicar na notificacao, abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/dashboard.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Se ja tem aba aberta, foca nela
      for (const client of list) {
        if (client.url.includes('nalinha') || client.url.includes('usenalinha')) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Senao abre nova aba
      return clients.openWindow(url);
    })
  );
});
