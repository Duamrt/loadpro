// LoadPro — Auth Guard
// Inclui em todas as páginas protegidas (personal/* e aluno/*)

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

  // Verificar tipo vs página
  const isPersonalPage = location.pathname.includes('/personal/');
  const isAlunoPage = location.pathname.includes('/aluno/');

  if (isPersonalPage && user.tipo !== 'personal') {
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
