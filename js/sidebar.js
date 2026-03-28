// LoadPro — Sidebar (Personal)
// Gera sidebar + mobile header automaticamente

function initSidebar() {
  const user = window.currentUser;
  const personal = window.currentPersonal;
  if (!user) return;

  // ── Barra laranja de admin acessando como personal ──
  if (window.adminViewingPersonal) {
    const adminBar = document.createElement('div');
    adminBar.id = 'adminBar';
    adminBar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#ea580c;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:.9rem;font-weight:600;';
    const nome = window.adminViewingName || 'Personal';
    adminBar.innerHTML = `
      <span>Acessando: ${esc(nome)}</span>
      <button onclick="voltarAdmin()" style="background:#fff;color:#ea580c;border:none;padding:6px 16px;border-radius:6px;font-weight:700;cursor:pointer;font-size:.8rem">Voltar ao Admin</button>
    `;
    document.body.insertBefore(adminBar, document.body.firstChild);

    // Ajustar layout pra caber a barra
    const barH = '44px';
    document.querySelectorAll('.sidebar').forEach(s => s.style.top = barH);
    document.querySelectorAll('.main-content').forEach(m => m.style.paddingTop = 'calc(32px + ' + barH + ')');
    document.querySelectorAll('.mobile-header').forEach(h => h.style.top = barH);
  }

  const currentPage = location.pathname.split('/').pop();

  const menuItems = [
    { href: 'dashboard.html', icon: 'layout-dashboard', label: 'Dashboard' },
    { href: 'alunos.html', icon: 'users', label: 'Alunos' },
    { href: 'exercicios.html', icon: 'dumbbell', label: 'Exercícios' },
    { href: 'treinos.html', icon: 'clipboard-list', label: 'Treinos' },
    { href: 'dieta.html', icon: 'utensils', label: 'Dieta' },
    { href: 'medidas.html', icon: 'ruler', label: 'Medidas' },
    { href: 'agenda.html', icon: 'calendar', label: 'Agenda' },
    { section: 'Comunicação' },
    { href: 'chat.html', icon: 'message-circle', label: 'Chat' },
    { section: 'Conta' },
    { href: 'configuracoes.html', icon: 'settings', label: 'Configurações' },
  ];

  const navHTML = menuItems.map(item => {
    if (item.section) return `<div class="sidebar-section">${item.section}</div>`;
    const active = currentPage === item.href ? 'active' : '';
    return `<a href="${item.href}" class="${active}"><i data-lucide="${item.icon}"></i><span>${item.label}</span></a>`;
  }).join('');

  const initials = (user.nome || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const planBadge = personal?.plano === 'pro'
    ? '<span class="badge badge-primary" style="font-size:.65rem">PRO</span>'
    : '<span class="badge badge-warning" style="font-size:.65rem">STARTER</span>';

  // Sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-brand" style="padding:20px 20px 16px">
      <h1 style="font-size:24px;font-weight:900;letter-spacing:-1px"><span style="color:var(--primary)">LOAD</span><span style="color:#fff">PRO</span></h1>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="avatar">${user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : initials}</div>
        <div class="sidebar-user-info">
          <div class="name">${esc(user.nome)} ${planBadge}</div>
          <div class="role">Personal Trainer</div>
        </div>
        <button onclick="logout()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px" title="Sair">
          <i data-lucide="log-out" style="width:18px;height:18px"></i>
        </button>
      </div>
    </div>
  `;

  // Mobile header
  const mobileHeader = document.createElement('header');
  mobileHeader.className = 'mobile-header';
  mobileHeader.innerHTML = `
    <button class="menu-toggle" onclick="toggleSidebar()"><i data-lucide="menu"></i></button>
    <div style="display:flex;align-items:center;gap:8px;font-weight:700">
      <span style="font-weight:900;letter-spacing:-1px"><span style="color:var(--primary)">LOAD</span><span>PRO</span></span>
    </div>
    <div style="width:40px"></div>
  `;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.id = 'sidebarBackdrop';
  backdrop.onclick = () => toggleSidebar(false);

  // Inserir no DOM (apenas novos elementos)
  document.body.insertBefore(mobileHeader, document.body.firstChild);
  document.body.insertBefore(sidebar, document.body.firstChild);
  document.body.insertBefore(backdrop, document.body.firstChild);

  lucide.createIcons();
}

function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isOpen = force !== undefined ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', isOpen);
  backdrop.classList.toggle('active', isOpen);
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = '../login.html';
}

// Voltar ao painel admin (remove modo "acessando como")
function voltarAdmin() {
  localStorage.removeItem('admin_viewing_personal');
  localStorage.removeItem('admin_viewing_name');
  window.location.href = 'admin.html';
}

// Init quando auth estiver pronto
document.addEventListener('auth-ready', () => initSidebar());
