// LoadPro — Dashboard do Personal

document.addEventListener('auth-ready', async () => {
  const personal = window.currentPersonal;
  if (!personal) return;

  // Greeting
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('greeting').textContent = `${saudacao}, ${window.currentUser.nome.split(' ')[0]}!`;

  // Trial alert
  if (personal.status_assinatura === 'trial' && personal.data_vencimento) {
    const dias = Math.ceil((new Date(personal.data_vencimento) - new Date()) / 86400000);
    if (dias >= 0) {
      document.getElementById('trialAlert').style.display = 'flex';
      document.getElementById('trialMsg').textContent = `Seu período de teste termina em ${dias} dia${dias !== 1 ? 's' : ''}. Assine para continuar usando.`;
    }
  }
  if (personal.status_assinatura === 'vencido') {
    document.getElementById('trialAlert').style.display = 'flex';
    document.getElementById('trialAlert').className = 'alert alert-danger';
    document.getElementById('trialMsg').innerHTML = 'Sua assinatura venceu. <a href="assinatura.html" style="color:#fff;text-decoration:underline">Renovar agora</a>';
  }

  // Buscar dados em paralelo
  const hoje = new Date().toISOString().split('T')[0];
  const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [alunosRes, logsHojeRes, logsRecentes, prsRes] = await Promise.all([
    supabase.from('alunos').select('id, nome, user_id, objetivo, status').eq('personal_id', personal.id).eq('status', 'ativo'),
    supabase.from('treino_logs').select('aluno_id, rotina_id, rotinas(nome)').eq('data', hoje),
    supabase.from('treino_logs').select('aluno_id, data').gte('data', semanaAtras),
    supabase.from('treino_series').select('id, exercicio_id, carga, reps, treino_log_id, pr, treino_logs(aluno_id, data)').eq('pr', true).gte('treino_logs.data', semanaAtras)
  ]);

  const alunos = alunosRes.data || [];
  const logsHoje = logsHojeRes.data || [];
  const prs = (prsRes.data || []).filter(p => p.treino_logs);

  // Stats
  document.getElementById('totalAlunos').textContent = alunos.length;
  document.getElementById('limiteLabel').textContent = `de ${window.limiteAlunos} do plano`;
  document.getElementById('treinosHoje').textContent = logsHoje.length;
  document.getElementById('prsRecentes').textContent = prs.length;

  // Quem está sem treinar (+5 dias)
  const alunoMap = {};
  alunos.forEach(a => alunoMap[a.id] = a);

  const ultimoTreino = {};
  (logsRecentes.data || []).forEach(l => {
    if (!ultimoTreino[l.aluno_id] || l.data > ultimoTreino[l.aluno_id]) {
      ultimoTreino[l.aluno_id] = l.data;
    }
  });

  // Buscar todos os treino_logs pra calcular último treino de cada aluno
  const { data: todosLogs } = await supabase
    .from('treino_logs')
    .select('aluno_id, data')
    .in('aluno_id', alunos.map(a => a.id))
    .order('data', { ascending: false });

  const ultimoTreinoGeral = {};
  (todosLogs || []).forEach(l => {
    if (!ultimoTreinoGeral[l.aluno_id]) ultimoTreinoGeral[l.aluno_id] = l.data;
  });

  const semTreinar = alunos.filter(a => {
    const ultimo = ultimoTreinoGeral[a.id];
    if (!ultimo) return true;
    const dias = Math.floor((new Date() - new Date(ultimo)) / 86400000);
    return dias >= 5;
  });

  document.getElementById('semTreinar').textContent = semTreinar.length;

  // Renderizar lista de quem treinou hoje
  if (logsHoje.length > 0) {
    const alunoIds = [...new Set(logsHoje.map(l => l.aluno_id))];
    const { data: alunosTreino } = await supabase.from('alunos').select('id, nome').in('id', alunoIds);
    const nomeMap = {};
    (alunosTreino || []).forEach(a => nomeMap[a.id] = a.nome);

    document.getElementById('listaTreinouHoje').innerHTML = logsHoje.map(l => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="avatar" style="width:32px;height:32px;font-size:.7rem">${getInitials(nomeMap[l.aluno_id] || '?')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.9rem;font-weight:500">${esc(nomeMap[l.aluno_id] || 'Aluno')}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${esc(l.rotinas?.nome || 'Treino livre')}</div>
        </div>
        <span class="badge badge-success">Treinou</span>
      </div>
    `).join('');
  }

  // Renderizar sem treinar
  if (semTreinar.length > 0) {
    document.getElementById('listaSemTreinar').innerHTML = semTreinar.map(a => {
      const ultimo = ultimoTreinoGeral[a.id];
      const dias = ultimo ? Math.floor((new Date() - new Date(ultimo)) / 86400000) : null;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div class="avatar" style="width:32px;height:32px;font-size:.7rem">${getInitials(a.nome)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.9rem;font-weight:500">${esc(a.nome)}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${dias ? `${dias} dias sem treinar` : 'Nunca treinou'}</div>
          </div>
          <span class="badge badge-warning">${dias ? `${dias}d` : 'Novo'}</span>
        </div>
      `;
    }).join('');
  }

  // Renderizar PRs
  if (prs.length > 0) {
    const exIds = [...new Set(prs.map(p => p.exercicio_id).filter(Boolean))];
    const alunoIds = [...new Set(prs.map(p => p.treino_logs?.aluno_id).filter(Boolean))];
    const [exRes, alRes] = await Promise.all([
      supabase.from('exercicios').select('id, nome').in('id', exIds),
      supabase.from('alunos').select('id, nome').in('id', alunoIds)
    ]);
    const exMap = {};
    (exRes.data || []).forEach(e => exMap[e.id] = e.nome);
    const alMap = {};
    (alRes.data || []).forEach(a => alMap[a.id] = a.nome);

    document.getElementById('listaPRs').innerHTML = prs.slice(0, 10).map(p => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center">
          <i data-lucide="trophy" style="width:16px;height:16px;color:var(--primary)"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:.9rem;font-weight:500">${esc(alMap[p.treino_logs?.aluno_id] || 'Aluno')}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${esc(exMap[p.exercicio_id] || 'Exercício')} — ${p.carga}kg × ${p.reps}</div>
        </div>
        <span class="badge badge-primary">PR!</span>
      </div>
    `).join('');
    lucide.createIcons();
  }

  // Gráfico de volume semanal (1 query única em vez de 7)
  const diasSemana = [];
  const volumeData = [];
  const { data: seriesSemana } = await supabase
    .from('treino_series')
    .select('carga, reps, treino_logs!inner(data)')
    .gte('treino_logs.data', semanaAtras)
    .lte('treino_logs.data', hoje)
    .eq('concluida', true);

  const volumePorDia = {};
  (seriesSemana || []).forEach(s => {
    const d = s.treino_logs?.data;
    if (d) volumePorDia[d] = (volumePorDia[d] || 0) + (s.carga || 0) * (s.reps || 0);
  });

  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dStr = d.toISOString().split('T')[0];
    diasSemana.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
    volumeData.push(volumePorDia[dStr] || 0);
  }

  new Chart(document.getElementById('chartVolume'), {
    type: 'bar',
    data: {
      labels: diasSemana,
      datasets: [{
        label: 'Volume (kg×reps)',
        data: volumeData,
        backgroundColor: 'rgba(249,115,22,0.3)',
        borderColor: '#f97316',
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#71717a' }, grid: { display: false } },
        y: { ticks: { color: '#71717a' }, grid: { color: '#2a2a2a' } }
      }
    }
  });

  lucide.createIcons();
});
