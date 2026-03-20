/* NaLinha — Sidebar (Desktop) — Injetada via JS, sem wrapper */
(function () {
  'use strict';

  var NAV = [
    { group: 'PRINCIPAL', open: true, items: [
      { icon: '📅', label: 'Agenda', href: 'dashboard.html' },
      { icon: '🗓', label: 'Agenda Semanal', href: 'agenda-semana.html' },
      { icon: '📊', label: 'Resumo', href: 'resumo.html' }
    ]},
    { group: 'GESTÃO', open: true, items: [
      { icon: '👥', label: 'Equipe', href: 'equipe.html' },
      { icon: '✂️', label: 'Serviços', href: 'servicos.html' },
      { icon: '🔀', label: 'Combos', href: 'combos.html' },
      { icon: '📋', label: 'Clientes', href: 'clientes.html' },
      { icon: '📦', label: 'Estoque', href: 'estoque.html' }
    ]},
    { group: 'FINANCEIRO', open: true, items: [
      { icon: '💰', label: 'Caixa', href: 'financeiro.html' },
      { icon: '📝', label: 'Comandas', href: 'comandas.html' },
      { icon: '💵', label: 'Comissões', href: 'comissoes.html' },
      { icon: '📄', label: 'Folha Pagamento', href: 'folha-pagamento.html' },
      { icon: '🎯', label: 'Metas', href: 'metas.html' }
    ]},
    { group: 'COMERCIAL', open: false, items: [
      { icon: '📦', label: 'Pacotes', href: 'pacotes.html' },
      { icon: '👑', label: 'Assinaturas', href: 'assinaturas.html' },
      { icon: '🎫', label: 'Cupons', href: 'cupons.html' },
      { icon: '📣', label: 'Promoções', href: 'promocoes.html' }
    ]},
    { group: 'CLIENTES', open: false, items: [
      { icon: '🔔', label: 'Lembretes', href: 'lembretes.html' },
      { icon: '🔄', label: 'Retenção', href: 'retencao.html' },
      { icon: '⭐', label: 'Satisfação', href: 'satisfacao.html' },
      { icon: '⏳', label: 'Lista de Espera', href: 'lista-espera.html' },
      { icon: '📥', label: 'Importar', href: 'importar-clientes.html' }
    ]},
    { group: 'ANÁLISE', open: false, items: [
      { icon: '📊', label: 'Relatório', href: 'relatorio.html' },
      { icon: '📉', label: 'Horários Ociosos', href: 'horarios-ociosos.html' },
      { icon: '📋', label: 'Atividades', href: 'atividades.html' }
    ]},
    { group: 'CONFIGURAR', open: false, items: [
      { icon: '⚙', label: 'Configurações', href: 'configuracoes.html' },
      { icon: '📱', label: 'QR Code', href: 'qrcode.html' },
      { icon: '📷', label: 'Galeria', href: 'galeria.html' },
      { icon: '📜', label: 'Políticas', href: 'politicas.html' },
      { icon: '💾', label: 'Backup', href: 'backup.html' },
      { icon: '💳', label: 'Meu Plano', href: 'planos.html' },
      { icon: '🔍', label: 'Busca', href: 'busca.html' },
      { icon: '🔔', label: 'Notificações', href: 'notificacoes.html' }
    ]}
  ];

  var currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  var STORAGE_KEY = 'nr_sidebar_state';
  var sidebar = null;

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function buildSidebar() {
    if (sidebar) return;
    var state = loadState();

    sidebar = document.createElement('aside');
    sidebar.className = 'nr-sidebar';
    var segLabels = { academia:'Gestão para academias', estetica:'Gestão para estética', sobrancelha:'Gestão para sobrancelhas', unha:'Gestão para nail designers', salao:'Gestão para salões' };
    var segKey = localStorage.getItem('nalinha_segment') || 'academia';
    sidebar.innerHTML = '<div class="nr-sidebar-brand"><div class="nr-logo">Na<span>Regua</span></div><div class="nr-logo-sub">' + (segLabels[segKey] || segLabels.academia) + '</div></div>';

    var nav = document.createElement('nav');
    nav.className = 'nr-sidebar-nav';

    NAV.forEach(function (group) {
      var g = document.createElement('div');
      g.className = 'nr-sidebar-group';
      var isFirstVisit = Object.keys(state).length === 0;
      var saved = state[group.group];
      if (saved !== undefined ? saved : (isFirstVisit ? false : !group.open)) g.classList.add('collapsed');

      var header = document.createElement('div');
      header.className = 'nr-sidebar-group-header';
      header.innerHTML = '<span class="nr-sidebar-group-label">' + group.group + '</span><span class="nr-sidebar-group-chevron">▼</span>';
      header.addEventListener('click', function () {
        g.classList.toggle('collapsed');
        var s = loadState(); s[group.group] = g.classList.contains('collapsed'); saveState(s);
      });
      g.appendChild(header);

      var items = document.createElement('div');
      items.className = 'nr-sidebar-group-items';
      group.items.forEach(function (item) {
        var a = document.createElement('a');
        a.className = 'nr-sidebar-link' + (item.href === currentPage ? ' active' : '');
        a.href = item.href;
        a.innerHTML = '<span class="nr-icon">' + item.icon + '</span><span class="nr-label">' + item.label + '</span>';
        items.appendChild(a);
      });
      g.appendChild(items);
      nav.appendChild(g);
    });

    sidebar.appendChild(nav);

    // Footer
    var footer = document.createElement('div');
    footer.className = 'nr-sidebar-footer';
    footer.innerHTML = '<div class="nr-sidebar-shop">Minha Academia</div><button class="nr-sidebar-logout" onclick="if(typeof logout===\'function\')logout();else{window.location.href=\'app.html\';}">Sair</button>';
    sidebar.appendChild(footer);

    // Inserir no body SEM mover nada
    document.body.insertBefore(sidebar, document.body.firstChild);
    document.body.classList.add('nr-has-sidebar');

    // Atualizar nome da academia quando carregar
    updateShopName();
  }

  function updateShopName() {
    if (!sidebar) return;
    var el = document.querySelector('#shop-name, .shop-name');
    var shopDiv = sidebar.querySelector('.nr-sidebar-shop');
    if (el && shopDiv && el.textContent.trim()) {
      shopDiv.textContent = el.textContent.trim();
    }
  }

  function removeSidebar() {
    if (!sidebar) return;
    sidebar.remove();
    sidebar = null;
    document.body.classList.remove('nr-has-sidebar');
  }

  function handleResize() {
    if (window.innerWidth >= 768) {
      if (!sidebar) buildSidebar();
    } else {
      if (sidebar) removeSidebar();
    }
  }

  function init() {
    handleResize();
    window.addEventListener('resize', handleResize);
    // Atualizar nome da academia após 2s (tempo pro async carregar)
    setTimeout(updateShopName, 2000);
    setTimeout(updateShopName, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
