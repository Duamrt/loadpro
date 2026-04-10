// LoadPro — Auth Guard
// Inclui em todas as páginas protegidas (personal/* e aluno/*)
(function(){const v=(document.currentScript?.src||'').match(/\?v=(\d+)/)?.[1]||'?';console.log('%c LoadPro %c v'+v+' ','background:#7c2d12;color:#fb923c;font-weight:700;padding:3px 7px;border-radius:3px 0 0 3px','background:#fb923c;color:#7c2d12;font-weight:700;padding:3px 7px;border-radius:0 3px 3px 0');})();

(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '../login.html';
    return;
  }

  // Buscar dados do usuário
  const { data: user } = await supabase
    .from('users')
    .select('*, personals(*), alunos(*)')
    .eq('auth_id', session.user.id)
    .single();

  if (!user) {
    await supabase.auth.signOut();
    window.location.href = '../login.html';
    return;
  }

  // Expor globalmente
  window.currentUser = user;
  window.currentSession = session;

  // ── Verificar se é admin da plataforma ──
  const isAdminPage = location.pathname.includes('admin.html');
  const { data: isAdmin } = await supabase.rpc('is_loadpro_admin');
  window.isLoadProAdmin = !!isAdmin;

  // Se é admin e NÃO está na página admin, e NÃO está acessando como personal → redirecionar
  if (isAdmin && !isAdminPage && !localStorage.getItem('admin_viewing_personal')) {
    window.location.href = 'admin.html';
    return;
  }

  // Se admin está "acessando como" um personal, sobrescrever currentPersonal
  if (isAdmin && localStorage.getItem('admin_viewing_personal')) {
    const viewingId = localStorage.getItem('admin_viewing_personal');
    const { data: resultado } = await supabase.rpc('admin_acessar_personal', { p_personal_id: viewingId });

    if (resultado && resultado.personal) {
      const fakePersonal = resultado.personal;
      window.currentPersonal = fakePersonal;
      window.currentUser = { ...user, tipo: 'personal', personals: fakePersonal };
      window.adminViewingPersonal = true;
      window.adminViewingName = localStorage.getItem('admin_viewing_name') || resultado.user?.nome || 'Personal';

      // Limite de alunos por plano
      const limites = { starter: 10, pro: 20 };
      window.limiteAlunos = limites[fakePersonal.plano] || 10;

      // Disparar auth-ready e sair — pular verificações normais
      document.dispatchEvent(new CustomEvent('auth-ready', { detail: { user: window.currentUser } }));
      return;
    } else {
      // Personal não encontrado, limpar
      localStorage.removeItem('admin_viewing_personal');
      localStorage.removeItem('admin_viewing_name');
    }
  }

  // Verificar tipo vs página
  const isPersonalPage = location.pathname.includes('/personal/');
  const isAlunoPage = location.pathname.includes('/aluno/');

  if (isPersonalPage && user.tipo !== 'personal' && !isAdmin) {
    window.location.href = '../aluno/dashboard.html';
    return;
  }
  if (isAlunoPage && user.tipo !== 'aluno') {
    window.location.href = '../personal/dashboard.html';
    return;
  }

  // Verificar assinatura do personal
  if (user.tipo === 'personal' && user.personals) {
    const p = Array.isArray(user.personals) ? user.personals[0] : user.personals;
    window.currentPersonal = p;

    if (['bloqueado', 'cancelado'].includes(p.status_assinatura)) {
      // Permitir apenas página de assinatura
      if (!location.pathname.includes('assinatura')) {
        window.location.href = 'assinatura.html';
        return;
      }
    }

    // Verificar vencimento
    if (p.data_vencimento && new Date(p.data_vencimento) < new Date()) {
      if (p.status_assinatura !== 'vencido') {
        await supabase.from('personals').update({ status_assinatura: 'vencido' }).eq('id', p.id);
        p.status_assinatura = 'vencido';
      }
    }

    // Limite de alunos por plano
    const limites = { starter: 10, pro: 20 };
    window.limiteAlunos = limites[p.plano] || 10;
  }

  if (user.tipo === 'aluno' && user.alunos) {
    const a = Array.isArray(user.alunos) ? user.alunos[0] : user.alunos;
    window.currentAluno = a;
  }

  // Disparar evento quando auth estiver pronto
  document.dispatchEvent(new CustomEvent('auth-ready', { detail: { user } }));
})();
