// LoadPro — Admin Panel
// Só carrega para admin@loadpro.com.br (ou quem estiver em platform_admins)

let allPersonals = [];

(async () => {
  // Verificar sessão
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '../login.html'; return; }

  // Verificar se é admin
  const { data: isAdmin } = await supabase.rpc('is_loadpro_admin');
  if (!isAdmin) { window.location.href = 'dashboard.html'; return; }

  // Carregar dados
  await Promise.all([carregarStats(), carregarPersonals()]);
  lucide.createIcons();
})();

// ── Stats Dashboard ──
async function carregarStats() {
  const { data: stats } = await supabase.rpc('admin_stats');
  if (!stats) return;

  document.getElementById('kpiPersonals').textContent = stats.total_personals || 0;
  document.getElementById('kpiAlunos').textContent = stats.total_alunos || 0;
  document.getElementById('kpiAtivos').textContent = stats.personals_ativos || 0;
  document.getElementById('kpiMRR').textContent = 'R$ ' + (stats.mrr_estimado || 0).toLocaleString('pt-BR');

  // Gráfico por plano
  const porPlano = stats.por_plano || {};
  const ctx = document.getElementById('chartPlanos');
  if (ctx) {
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(porPlano).map(p => (p || 'starter').toUpperCase()),
        datasets: [{
          data: Object.values(porPlano),
          backgroundColor: ['#f97316', '#22c55e', '#eab308', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#a1a1aa', padding: 16 } }
        }
      }
    });
  }

  // Últimos cadastros (5 mais recentes)
  await carregarUltimosCadastros();

  // Trial vencendo
  await carregarTrialVencendo();
}

async function carregarUltimosCadastros() {
  const { data } = await supabase
    .from('personals')
    .select('*, users!personals_user_id_fkey(nome, email)')
    .order('criado_em', { ascending: false })
    .limit(5);

  const el = document.getElementById('ultimosCadastros');
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:20px"><p style="font-size:.9rem">Nenhum cadastro ainda</p></div>';
    return;
  }

  el.innerHTML = data.map(p => {
    const user = p.users || {};
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="avatar">${getInitials(user.nome)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.9rem">${esc(user.nome)}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${esc(user.email)}</div>
        </div>
        <div style="text-align:right">
          <span class="badge badge-${p.plano === 'pro' ? 'primary' : 'warning'}" style="font-size:.65rem">${(p.plano || 'starter').toUpperCase()}</span>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:4px">${timeAgo(p.criado_em)}</div>
        </div>
      </div>`;
  }).join('');
}

async function carregarTrialVencendo() {
  const hoje = new Date();
  const em3dias = new Date();
  em3dias.setDate(em3dias.getDate() + 3);

  const { data } = await supabase
    .from('personals')
    .select('*, users!personals_user_id_fkey(nome, email)')
    .eq('status_assinatura', 'trial')
    .lte('data_vencimento', em3dias.toISOString().split('T')[0])
    .gte('data_vencimento', hoje.toISOString().split('T')[0])
    .order('data_vencimento', { ascending: true });

  const el = document.getElementById('trialVencendo');
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:20px"><p style="font-size:.9rem">Nenhum trial vencendo em breve</p></div>';
    return;
  }

  el.innerHTML = data.map(p => {
    const user = p.users || {};
    const diasRestantes = Math.ceil((new Date(p.data_vencimento) - hoje) / 86400000);
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="avatar">${getInitials(user.nome)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.9rem">${esc(user.nome)}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${esc(user.email)}</div>
        </div>
        <span class="badge badge-danger" style="font-size:.65rem">
          ${diasRestantes <= 0 ? 'Vence hoje' : diasRestantes + ' dia' + (diasRestantes > 1 ? 's' : '')}
        </span>
      </div>`;
  }).join('');
}

// ── Lista de Personals ──
async function carregarPersonals() {
  const { data } = await supabase
    .from('personals')
    .select('*, users!personals_user_id_fkey(nome, email), alunos(count)')
    .order('criado_em', { ascending: false });

  allPersonals = (data || []).map(p => ({
    ...p,
    nome: p.users?.nome || '',
    email: p.users?.email || '',
    total_alunos: p.alunos?.[0]?.count || 0
  }));

  renderPersonals(allPersonals);
}

function renderPersonals(lista) {
  const tbody = document.getElementById('tabelaPersonals');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum personal encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const statusClass = p.status_assinatura || 'trial';
    const statusLabel = (p.status_assinatura || 'trial').charAt(0).toUpperCase() + (p.status_assinatura || 'trial').slice(1);
    const planoBadge = p.plano === 'pro'
      ? '<span class="badge badge-primary" style="font-size:.65rem">PRO</span>'
      : '<span class="badge badge-warning" style="font-size:.65rem">STARTER</span>';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar" style="width:32px;height:32px;font-size:.75rem">${getInitials(p.nome)}</div>
            <span style="font-weight:600">${esc(p.nome)}</span>
          </div>
        </td>
        <td style="color:var(--text-muted)">${esc(p.email)}</td>
        <td>${planoBadge}</td>
        <td><span class="status-dot status-${statusClass}"></span>${esc(statusLabel)}</td>
        <td style="font-weight:600">${p.total_alunos}</td>
        <td style="color:var(--text-muted);font-size:.8rem">${formatDate(p.criado_em?.split('T')[0])}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="acessarPersonal('${p.id}', '${esc(p.nome)}')">
            <i data-lucide="log-in" style="width:14px;height:14px"></i> Acessar
          </button>
        </td>
      </tr>`;
  }).join('');

  lucide.createIcons();
}

function filtrarPersonals() {
  const busca = (document.getElementById('buscaPersonal').value || '').toLowerCase();
  const plano = document.getElementById('filtroPlano').value;
  const status = document.getElementById('filtroStatus').value;

  const filtrados = allPersonals.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca) && !p.email.toLowerCase().includes(busca)) return false;
    if (plano && (p.plano || 'starter') !== plano) return false;
    if (status && (p.status_assinatura || 'trial') !== status) return false;
    return true;
  });

  renderPersonals(filtrados);
}

// ── Acessar como personal ──
function acessarPersonal(personalId, nome) {
  localStorage.setItem('admin_viewing_personal', personalId);
  localStorage.setItem('admin_viewing_name', nome);
  window.location.href = 'dashboard.html';
}

// ── Tabs ──
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelector(`.admin-nav a[data-tab="${tab}"]`)?.classList.add('active');
  // Fechar sidebar mobile
  toggleAdminSidebar(false);
}

// ── Sidebar mobile ──
function toggleAdminSidebar(force) {
  const sb = document.getElementById('adminSidebar');
  const bd = document.getElementById('adminBackdrop');
  const isOpen = force !== undefined ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', isOpen);
  bd.classList.toggle('active', isOpen);
}

// ── Logout ──
async function adminLogout() {
  localStorage.removeItem('admin_viewing_personal');
  localStorage.removeItem('admin_viewing_name');
  await supabase.auth.signOut();
  window.location.href = '../login.html';
}
