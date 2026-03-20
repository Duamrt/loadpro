// NaLinha — Helpers

// Silenciar console.log em produção (manter console.warn e console.error)
if (location.hostname === 'usenalinha.com.br') {
  console.log = function() {};
}

function formatMoney(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── Google Analytics 4 ──────────────────────────────────────
(function() {
  var GA_ID = 'G-XXXXXXXXXX'; // TODO: substituir pelo GA ID real do NaLinha
  if (GA_ID === 'G-XXXXXXXXXX') return; // Não carrega se não configurado
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: true });
})();
