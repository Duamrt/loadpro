// ══════════════════════════════════════════
// NAREGUA — TOUR GUIADO INTERATIVO
// Tooltips passo-a-passo sem dependências
// ══════════════════════════════════════════

(function () {
  'use strict';

  // ── CSS ─────────────────────────────────
  const CSS = `
    #nr-tour-overlay {
      position: fixed; inset: 0; z-index: 10000;
      pointer-events: none; transition: opacity .3s;
    }
    #nr-tour-spotlight {
      position: absolute; border-radius: 8px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,.7);
      transition: top .35s, left .35s, width .35s, height .35s;
      pointer-events: none; z-index: 10001;
      animation: nrPulse 2s infinite;
    }
    @keyframes nrPulse {
      0%,100% { box-shadow: 0 0 0 9999px rgba(0,0,0,.7), 0 0 0 0 rgba(212,168,83,.4); }
      50%     { box-shadow: 0 0 0 9999px rgba(0,0,0,.7), 0 0 0 8px rgba(212,168,83,.15); }
    }
    #nr-tour-tooltip {
      position: absolute; z-index: 10002;
      background: #1a1a1a; border: 1px solid rgba(212,168,83,.35);
      border-radius: 12px; padding: 16px 18px 14px;
      max-width: 320px; width: max-content; min-width: 220px;
      color: #fff; font-family: 'Inter', sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,.5);
      transition: top .35s, left .35s, opacity .25s;
      pointer-events: auto;
    }
    #nr-tour-tooltip::before {
      content: ''; position: absolute; width: 10px; height: 10px;
      background: #1a1a1a; border: 1px solid rgba(212,168,83,.35);
      transform: rotate(45deg);
    }
    #nr-tour-tooltip.pos-bottom::before { top: -6px; left: 24px; border-right: none; border-bottom: none; }
    #nr-tour-tooltip.pos-top::before    { bottom: -6px; left: 24px; border-left: none; border-top: none; }
    #nr-tour-tooltip.pos-left::before   { right: -6px; top: 18px; border-left: none; border-top: none; }
    #nr-tour-tooltip.pos-right::before  { left: -6px; top: 18px; border-right: none; border-bottom: none; }
    .nr-tour-title {
      font-size: 14px; font-weight: 800; color: #d4a853;
      margin-bottom: 6px; line-height: 1.3;
    }
    .nr-tour-text {
      font-size: 12px; color: rgba(255,255,255,.8);
      line-height: 1.6; margin-bottom: 14px;
    }
    .nr-tour-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .nr-tour-counter {
      font-size: 11px; color: rgba(255,255,255,.4); white-space: nowrap;
    }
    .nr-tour-dots {
      display: flex; gap: 4px; flex: 1; justify-content: center;
    }
    .nr-tour-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: rgba(255,255,255,.15); transition: background .2s;
    }
    .nr-tour-dot.active { background: #d4a853; }
    .nr-tour-btns { display: flex; gap: 6px; }
    .nr-tour-btn {
      padding: 6px 14px; border-radius: 6px; border: none;
      font-size: 11px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: .15s;
    }
    .nr-tour-btn-skip {
      background: transparent; color: rgba(255,255,255,.45);
    }
    .nr-tour-btn-skip:hover { color: #fff; }
    .nr-tour-btn-next {
      background: #d4a853; color: #000;
    }
    .nr-tour-btn-next:hover { background: #e0ba6a; }
    @media (max-width: 480px) {
      #nr-tour-tooltip { max-width: calc(100vw - 32px); min-width: 0; }
    }
  `;

  let style = null;
  function injectCSS() {
    if (document.getElementById('nr-tour-css')) return;
    style = document.createElement('style');
    style.id = 'nr-tour-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ── STATE ───────────────────────────────
  let steps = [];
  let current = -1;
  let overlay, spotlight, tooltip;
  let onComplete = null;

  // ── START ───────────────────────────────
  function startTour(tourSteps, opts) {
    if (!tourSteps || !tourSteps.length) return;
    injectCSS();
    steps = tourSteps;
    current = -1;
    onComplete = (opts && opts.onComplete) || null;

    // overlay
    overlay = document.createElement('div');
    overlay.id = 'nr-tour-overlay';
    document.body.appendChild(overlay);

    // spotlight
    spotlight = document.createElement('div');
    spotlight.id = 'nr-tour-spotlight';
    document.body.appendChild(spotlight);

    // tooltip
    tooltip = document.createElement('div');
    tooltip.id = 'nr-tour-tooltip';
    document.body.appendChild(tooltip);

    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);

    next();
  }

  function endTour() {
    if (overlay) overlay.remove();
    if (spotlight) spotlight.remove();
    if (tooltip) tooltip.remove();
    overlay = spotlight = tooltip = null;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', reposition);
    if (onComplete) onComplete();
    steps = [];
    current = -1;
  }

  function next() {
    current++;
    if (current >= steps.length) { endTour(); return; }
    showStep(current);
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); next(); }
    if (e.key === 'Escape') { e.preventDefault(); endTour(); }
  }

  // ── SHOW STEP ──────────────────────────
  function showStep(i) {
    const step = steps[i];
    const el = step.target ? document.querySelector(step.target) : null;

    // scroll into view
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // small delay for scroll
    setTimeout(() => positionStep(i, el), el ? 120 : 0);
  }

  function positionStep(i, el) {
    const step = steps[i];
    const pad = 6;

    // spotlight
    if (el) {
      const r = el.getBoundingClientRect();
      spotlight.style.display = 'block';
      spotlight.style.top = (r.top + window.scrollY - pad) + 'px';
      spotlight.style.left = (r.left + window.scrollX - pad) + 'px';
      spotlight.style.width = (r.width + pad * 2) + 'px';
      spotlight.style.height = (r.height + pad * 2) + 'px';
    } else {
      spotlight.style.display = 'none';
    }

    // tooltip content
    const isLast = i === steps.length - 1;
    let dots = '';
    for (let d = 0; d < steps.length; d++) {
      dots += '<div class="nr-tour-dot' + (d === i ? ' active' : '') + '"></div>';
    }

    tooltip.innerHTML =
      '<div class="nr-tour-title">' + (step.title || '') + '</div>' +
      '<div class="nr-tour-text">' + (step.text || '') + '</div>' +
      '<div class="nr-tour-footer">' +
        '<span class="nr-tour-counter">' + (i + 1) + ' de ' + steps.length + '</span>' +
        '<div class="nr-tour-dots">' + dots + '</div>' +
        '<div class="nr-tour-btns">' +
          (isLast ? '' : '<button class="nr-tour-btn nr-tour-btn-skip" onclick="window.__nrTour.end()">PULAR</button>') +
          '<button class="nr-tour-btn nr-tour-btn-next" onclick="window.__nrTour.next()">' + (isLast ? 'FECHAR' : 'PRÓXIMO') + '</button>' +
        '</div>' +
      '</div>';

    // position tooltip
    const pos = step.position || 'bottom';
    tooltip.className = 'pos-' + pos;

    if (el) {
      const r = el.getBoundingClientRect();
      const gap = 14;
      let top, left;

      // first pass position
      switch (pos) {
        case 'bottom':
          top = r.bottom + window.scrollY + gap;
          left = r.left + window.scrollX;
          break;
        case 'top':
          top = r.top + window.scrollY - gap;
          left = r.left + window.scrollX;
          break;
        case 'left':
          top = r.top + window.scrollY;
          left = r.left + window.scrollX - gap;
          break;
        case 'right':
          top = r.top + window.scrollY;
          left = r.right + window.scrollX + gap;
          break;
      }

      // measure tooltip
      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';
      tooltip.style.opacity = '0';

      requestAnimationFrame(() => {
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        const vw = window.innerWidth;

        if (pos === 'top') top -= th;
        if (pos === 'left') left -= tw;

        // clamp horizontal
        if (left + tw > vw - 16) left = vw - tw - 16;
        if (left < 16) left = 16;

        // clamp vertical
        if (top < window.scrollY + 8) top = window.scrollY + 8;

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        tooltip.style.opacity = '1';
      });
    } else {
      // center on screen
      tooltip.style.opacity = '0';
      requestAnimationFrame(() => {
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        tooltip.style.top = (window.scrollY + (window.innerHeight - th) / 2) + 'px';
        tooltip.style.left = ((window.innerWidth - tw) / 2) + 'px';
        tooltip.style.opacity = '1';
      });
    }
  }

  function reposition() {
    if (current >= 0 && current < steps.length) {
      const el = steps[current].target ? document.querySelector(steps[current].target) : null;
      positionStep(current, el);
    }
  }

  // ── PUBLIC API ─────────────────────────
  window.__nrTour = { start: startTour, next: next, end: endTour };
  window.startTour = startTour;

  // ══════════════════════════════════════════
  // TOUR: DASHBOARD
  // ══════════════════════════════════════════
  const TOUR_DASHBOARD = [
    {
      target: '#shop-name',
      title: 'Bem-vindo ao NaLinha!',
      text: 'Este é o painel da sua academia. Aqui você controla tudo: agenda, equipe, financeiro e clientes.',
      position: 'bottom'
    },
    {
      target: '[onclick="abrirEncaixe()"]',
      title: 'Encaixe rápido',
      text: 'Chegou um cliente sem agendar? Use este botão pra encaixar no próximo horário disponível.',
      position: 'bottom'
    },
    {
      target: '#share-bar',
      title: 'Compartilhe seu link',
      text: 'Envie este link pros seus clientes agendarem online. Funciona no WhatsApp, Instagram, onde quiser.',
      position: 'bottom'
    },
    {
      target: '#dash-stats',
      title: 'Resumo do dia',
      text: 'Agendados, atendidos, faltas e faturamento. Tudo atualizado em tempo real.',
      position: 'bottom'
    },
    {
      target: '#dash-date-nav',
      title: 'Navegue entre os dias',
      text: 'Use as setas pra ver agendamentos de outros dias. Bom pra conferir o que vem pela frente.',
      position: 'bottom'
    },
    {
      target: '.barber-column',
      title: 'Colunas por barbeiro',
      text: 'Cada profissional tem sua coluna. Os agendamentos aparecem organizados por horário.',
      position: 'bottom'
    },
    {
      target: '#more-menu-trigger, [onclick*="more"]',
      title: 'Menu completo',
      text: 'No menu MAIS, acesse todos os módulos: equipe, serviços, estoque, relatórios, financeiro e muito mais.',
      position: 'top'
    },
    {
      target: null,
      title: 'Pronto pra começar!',
      text: 'Explore à vontade. Se precisar de ajuda, clique no botão ? no canto da tela pra ver este guia novamente.',
      position: 'bottom'
    }
  ];

  // ── AUTO-START ─────────────────────────
  function initDashboardTour() {
    const path = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    if (path !== 'dashboard') return;

    if (!localStorage.getItem('nalinha_tour_dashboard')) {
      setTimeout(() => {
        startTour(TOUR_DASHBOARD, {
          onComplete: function () {
            localStorage.setItem('nalinha_tour_dashboard', '1');
          }
        });
      }, 1000);
    }
  }

  // export for ajuda.js
  window.startDashboardTour = function () {
    startTour(TOUR_DASHBOARD, {
      onComplete: function () {
        localStorage.setItem('nalinha_tour_dashboard', '1');
      }
    });
  };

  document.addEventListener('DOMContentLoaded', initDashboardTour);
})();
