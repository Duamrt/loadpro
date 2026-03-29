// LoadPro — Montagem de Treinos

let exerciciosDisponiveis = [];
let exerciciosAdicionados = [];
let rotinasAluno = [];
let todosAlunosTreino = [];

document.addEventListener('auth-ready', async () => {
  const personal = window.currentPersonal;

  // Carregar alunos no seletor
  const { data: alunos } = await supabase
    .from('alunos').select('id, nome')
    .eq('personal_id', personal.id)
    .in('status', ['ativo','pendente'])
    .order('nome');

  todosAlunosTreino = alunos || [];
  const select = document.getElementById('seletorAluno');
  todosAlunosTreino.forEach(a => {
    select.innerHTML += `<option value="${a.id}">${esc(a.nome)}</option>`;
  });

  // Pre-selecionar se veio da URL
  const params = new URLSearchParams(location.search);
  if (params.get('aluno')) select.value = params.get('aluno');

  let valorAnterior = select.value;
  select.addEventListener('change', () => {
    if (rotinasAluno.length > 0 && valorAnterior) {
      if (!confirm('Trocar de aluno? Os dados do aluno atual não serão perdidos.')) {
        select.value = valorAnterior;
        return;
      }
    }
    valorAnterior = select.value;
    carregarRotinas();
  });

  // Carregar exercícios disponíveis
  const { data: exs } = await supabase
    .from('exercicios')
    .select('*')
    .or(`global.eq.true,personal_id.eq.${personal.id}`)
    .order('nome');
  exerciciosDisponiveis = exs || [];

  const addSelect = document.getElementById('addExSelect');
  exerciciosDisponiveis.forEach(e => {
    addSelect.innerHTML += `<option value="${e.id}">${esc(e.nome)} (${esc(e.grupo_muscular)})</option>`;
  });

  // Chips dias
  document.getElementById('rotinaDias').innerHTML = DIAS_SEMANA.map(d =>
    `<div class="chip" data-dia="${d.key}" onclick="this.classList.toggle('active')">${d.label}</div>`
  ).join('');

  if (select.value) {
    carregarRotinas();
  } else {
    mostrarResumoAlunos();
  }
});

async function mostrarResumoAlunos() {
  const container = document.getElementById('rotinasContainer');
  const empty = document.getElementById('emptyState');
  empty.style.display = 'none';

  if (!todosAlunosTreino.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  // Buscar contagem de rotinas por aluno
  const { data: rotinas } = await supabase
    .from('rotinas')
    .select('aluno_id, ativa')
    .eq('personal_id', window.currentPersonal.id);

  const contagem = {};
  (rotinas || []).forEach(r => {
    if (!contagem[r.aluno_id]) contagem[r.aluno_id] = { total: 0, ativas: 0 };
    contagem[r.aluno_id].total++;
    if (r.ativa) contagem[r.aluno_id].ativas++;
  });

  container.innerHTML = `
    <div style="margin-bottom:16px;color:var(--text-secondary);font-size:.9rem">Selecione um aluno pra ver ou criar rotinas de treino:</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
      ${todosAlunosTreino.map(a => {
        const c = contagem[a.id];
        const temTreino = c && c.total > 0;
        return `
          <div class="card card-clickable" style="padding:16px;cursor:pointer" onclick="document.getElementById('seletorAluno').value='${a.id}';document.getElementById('seletorAluno').dispatchEvent(new Event('change'))">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="avatar">${getInitials(a.nome)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.nome)}</div>
                <div style="font-size:.8rem;margin-top:2px">
                  ${temTreino
                    ? `<span style="color:var(--success)">${c.ativas} rotina${c.ativas !== 1 ? 's' : ''} ativa${c.ativas !== 1 ? 's' : ''}</span>`
                    : '<span style="color:var(--text-muted)">Sem treino</span>'}
                </div>
              </div>
              ${temTreino ? '<i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success)"></i>' : '<i data-lucide="plus-circle" style="width:16px;height:16px;color:var(--text-muted)"></i>'}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  lucide.createIcons();
}

async function carregarRotinas() {
  const alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) { rotinasAluno = []; renderRotinas(); mostrarResumoAlunos(); return; }

  const { data } = await supabase
    .from('rotinas')
    .select('*, rotina_exercicios(*, exercicios(nome, grupo_muscular, gif_url))')
    .eq('aluno_id', alunoId)
    .order('criado_em', { ascending: false });

  rotinasAluno = data || [];
  renderRotinas();
}

function renderRotinas() {
  const container = document.getElementById('rotinasContainer');
  const empty = document.getElementById('emptyState');
  const btnLimpar = document.getElementById('btnLimpar');
  if (btnLimpar) btnLimpar.style.display = rotinasAluno.length ? 'inline-flex' : 'none';

  if (!rotinasAluno.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = rotinasAluno.map(r => {
    const totalSeries = (r.rotina_exercicios || []).reduce((a, e) => a + (e.series || 0), 0);
    const totalEx = (r.rotina_exercicios || []).length;
    return `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <h3>${esc(r.nome)}</h3>
              <span class="badge ${r.ativa ? 'badge-success' : 'badge-danger'}">${r.ativa ? 'Ativa' : 'Inativa'}</span>
            </div>
            <div style="display:flex;gap:16px;margin-top:8px;font-size:.85rem;color:var(--text-muted)">
              <span>${totalEx} exercícios</span>
              <span>${totalSeries} séries</span>
              ${r.dias_semana?.length ? `<span>${r.dias_semana.join(', ')}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-secondary" onclick="editarRotina('${r.id}')"><i data-lucide="edit-2"></i></button>
            <button class="btn btn-sm btn-secondary" onclick="duplicarRotina('${r.id}')"><i data-lucide="copy"></i></button>
            <button class="btn btn-sm ${r.ativa ? 'btn-danger' : 'btn-success'}" onclick="toggleRotina('${r.id}', ${!r.ativa})">
              <i data-lucide="${r.ativa ? 'pause' : 'play'}"></i>
            </button>
          </div>
        </div>
        ${totalEx ? `
          <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
            ${(r.rotina_exercicios || []).sort((a,b) => a.ordem - b.ordem).map((re, i) => `
              <div style="display:flex;align-items:center;gap:12px;padding:8px 0;${i > 0 ? 'border-top:1px solid var(--border)' : ''}">
                <span style="width:24px;height:24px;border-radius:50%;background:var(--bg-card-hover);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:var(--text-muted);flex-shrink:0">${i + 1}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:.9rem;font-weight:500">${esc(re.exercicios?.nome || 'Exercício removido')}</div>
                  <div style="font-size:.8rem;color:var(--text-muted)">${esc(re.exercicios?.grupo_muscular || '')}</div>
                </div>
                <div style="font-size:.8rem;color:var(--text-secondary);text-align:right">
                  <div>${re.series}×${re.reps_min}-${re.reps_max}</div>
                  ${re.carga_sugerida ? `<div>${re.carga_sugerida}kg</div>` : ''}
                  <div style="color:var(--text-muted);font-size:.7rem">⏱️ ${re.descanso_seg >= 60 ? Math.floor(re.descanso_seg/60) + ':' + String(re.descanso_seg%60).padStart(2,'0') : re.descanso_seg + 's'}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function novaRotina() {
  if (!document.getElementById('seletorAluno').value) {
    showToast('Selecione um aluno primeiro', 'warning');
    return;
  }
  document.getElementById('rotinaId').value = '';
  document.getElementById('rotinaNome').value = '';
  document.querySelectorAll('#rotinaDias .chip').forEach(c => c.classList.remove('active'));
  exerciciosAdicionados = [];
  renderExerciciosModal();
  document.getElementById('rotinaModalTitle').textContent = 'Nova Rotina';
  openModal('modalRotina');
}

async function editarRotina(id) {
  const rotina = rotinasAluno.find(r => r.id === id);
  if (!rotina) return;

  document.getElementById('rotinaId').value = id;
  document.getElementById('rotinaNome').value = rotina.nome;
  document.getElementById('rotinaModalTitle').textContent = 'Editar Rotina';

  // Marcar dias
  document.querySelectorAll('#rotinaDias .chip').forEach(c => c.classList.remove('active'));
  (rotina.dias_semana || []).forEach(d => {
    const chip = document.querySelector(`#rotinaDias [data-dia="${d}"]`);
    if (chip) chip.classList.add('active');
  });

  // Carregar exercícios
  exerciciosAdicionados = (rotina.rotina_exercicios || []).sort((a, b) => a.ordem - b.ordem).map(re => ({
    exercicio_id: re.exercicio_id,
    nome: re.exercicios?.nome || '',
    grupo: re.exercicios?.grupo_muscular || '',
    series: re.series,
    reps_min: re.reps_min,
    reps_max: re.reps_max,
    carga_sugerida: re.carga_sugerida,
    descanso_seg: re.descanso_seg,
    observacoes: re.observacoes
  }));

  renderExerciciosModal();
  openModal('modalRotina');
}

function adicionarExercicio() {
  const select = document.getElementById('addExSelect');
  const id = select.value;
  if (!id) return;

  const ex = exerciciosDisponiveis.find(e => e.id === id);
  if (!ex) return;

  exerciciosAdicionados.push({
    exercicio_id: id,
    nome: ex.nome,
    grupo: ex.grupo_muscular,
    series: 3,
    reps_min: 8,
    reps_max: 12,
    carga_sugerida: null,
    descanso_seg: 60,
    observacoes: ''
  });

  select.value = '';
  renderExerciciosModal();
}

function removerExercicio(idx) {
  exerciciosAdicionados.splice(idx, 1);
  renderExerciciosModal();
}

function renderExerciciosModal() {
  const container = document.getElementById('listaExercicios');

  if (!exerciciosAdicionados.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">Nenhum exercício adicionado. Use o seletor abaixo.</p>';
    return;
  }

  container.innerHTML = exerciciosAdicionados.map((ex, i) => `
    <div class="card" style="padding:12px;margin-bottom:8px;background:var(--bg-card-hover)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:700;color:var(--primary);font-size:.85rem">${i + 1}.</span>
        <span style="font-weight:600;flex:1">${esc(ex.nome)}</span>
        <span class="badge badge-primary" style="font-size:.7rem">${esc(ex.grupo)}</span>
        <button class="btn btn-sm btn-danger" style="padding:4px 8px" onclick="removerExercicio(${i})"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:60px">
          <label style="font-size:.7rem;color:var(--text-muted)">Séries</label>
          <input type="number" class="form-control" value="${ex.series}" min="1" style="padding:6px 8px;font-size:.85rem" onchange="exerciciosAdicionados[${i}].series=+this.value">
        </div>
        <div style="flex:1;min-width:60px">
          <label style="font-size:.7rem;color:var(--text-muted)">Reps mín</label>
          <input type="number" class="form-control" value="${ex.reps_min}" min="1" style="padding:6px 8px;font-size:.85rem" onchange="exerciciosAdicionados[${i}].reps_min=+this.value">
        </div>
        <div style="flex:1;min-width:60px">
          <label style="font-size:.7rem;color:var(--text-muted)">Reps máx</label>
          <input type="number" class="form-control" value="${ex.reps_max}" min="1" style="padding:6px 8px;font-size:.85rem" onchange="exerciciosAdicionados[${i}].reps_max=+this.value">
        </div>
        <div style="flex:1;min-width:60px">
          <label style="font-size:.7rem;color:var(--text-muted)">Carga (kg)</label>
          <input type="number" class="form-control" value="${ex.carga_sugerida || ''}" style="padding:6px 8px;font-size:.85rem" onchange="exerciciosAdicionados[${i}].carga_sugerida=+this.value||null">
        </div>
        <div style="flex:1;min-width:80px">
          <label style="font-size:.7rem;color:var(--text-muted)">⏱️ Descanso</label>
          <select class="form-control" style="padding:6px 8px;font-size:.85rem" onchange="exerciciosAdicionados[${i}].descanso_seg=+this.value">
            <option value="30" ${ex.descanso_seg==30?'selected':''}>30s</option>
            <option value="45" ${ex.descanso_seg==45?'selected':''}>45s</option>
            <option value="60" ${ex.descanso_seg==60||!ex.descanso_seg?'selected':''}>1 min</option>
            <option value="90" ${ex.descanso_seg==90?'selected':''}>1:30</option>
            <option value="120" ${ex.descanso_seg==120?'selected':''}>2 min</option>
            <option value="180" ${ex.descanso_seg==180?'selected':''}>3 min</option>
          </select>
        </div>
      </div>
      <div style="margin-top:8px">
        <input type="text" class="form-control" value="${esc(ex.observacoes || '')}" placeholder="Obs técnica..." style="padding:6px 8px;font-size:.85rem" onchange="exerciciosAdicionados[${i}].observacoes=this.value">
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function salvarRotina() {
  const alunoId = document.getElementById('seletorAluno').value;
  const nome = document.getElementById('rotinaNome').value.trim();
  if (!nome) { showToast('Nome da rotina é obrigatório', 'error'); return; }
  if (!exerciciosAdicionados.length) { showToast('Adicione pelo menos um exercício', 'error'); return; }

  const dias = [...document.querySelectorAll('#rotinaDias .chip.active')].map(c => c.dataset.dia);
  const rotinaId = document.getElementById('rotinaId').value;

  let rotina_id;

  if (rotinaId) {
    // Update
    await supabase.from('rotinas').update({
      nome, dias_semana: dias, atualizado_em: new Date().toISOString()
    }).eq('id', rotinaId);
    rotina_id = rotinaId;

    // Deletar exercícios antigos e reinserir
    await supabase.from('rotina_exercicios').delete().eq('rotina_id', rotinaId);
  } else {
    // Insert
    const { data, error } = await supabase.from('rotinas').insert({
      aluno_id: alunoId,
      personal_id: window.currentPersonal.id,
      nome,
      dias_semana: dias,
      duracao_estimada: exerciciosAdicionados.reduce((a, e) => a + (e.series * (30 + e.descanso_seg)), 0) / 60
    }).select().single();
    if (error) { showToast('Erro: ' + error.message, 'error'); return; }
    rotina_id = data.id;
  }

  // Inserir exercícios
  const exs = exerciciosAdicionados.map((e, i) => ({
    rotina_id,
    exercicio_id: e.exercicio_id,
    ordem: i + 1,
    series: e.series,
    reps_min: e.reps_min,
    reps_max: e.reps_max,
    carga_sugerida: e.carga_sugerida,
    descanso_seg: e.descanso_seg,
    observacoes: e.observacoes || null
  }));

  const { error } = await supabase.from('rotina_exercicios').insert(exs);
  if (error) { showToast('Erro ao salvar exercícios: ' + error.message, 'error'); return; }

  closeModal('modalRotina');
  showToast(rotinaId ? 'Rotina atualizada!' : 'Rotina criada!');
  await carregarRotinas();
  await syncAgenda(alunoId);
}

async function toggleRotina(id, ativa) {
  await supabase.from('rotinas').update({ ativa }).eq('id', id);
  showToast(ativa ? 'Rotina ativada' : 'Rotina desativada');
  await carregarRotinas();
  const alunoId = document.getElementById('seletorAluno').value;
  if (alunoId) await syncAgenda(alunoId);
}

async function duplicarRotina(id) {
  const rotina = rotinasAluno.find(r => r.id === id);
  if (!rotina) return;

  const { data: nova } = await supabase.from('rotinas').insert({
    aluno_id: rotina.aluno_id,
    personal_id: rotina.personal_id,
    nome: rotina.nome + ' (cópia)',
    dias_semana: rotina.dias_semana,
    duracao_estimada: rotina.duracao_estimada,
    ativa: false
  }).select().single();

  if (nova && rotina.rotina_exercicios?.length) {
    const exs = rotina.rotina_exercicios.map(re => ({
      rotina_id: nova.id,
      exercicio_id: re.exercicio_id,
      ordem: re.ordem,
      series: re.series,
      reps_min: re.reps_min,
      reps_max: re.reps_max,
      carga_sugerida: re.carga_sugerida,
      descanso_seg: re.descanso_seg,
      observacoes: re.observacoes
    }));
    await supabase.from('rotina_exercicios').insert(exs);
  }

  showToast('Rotina duplicada!');
  await carregarRotinas();
}

// ── Templates de Treino ──
async function limparTreinos() {
  const alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) return;
  if (!confirm('Apagar todas as ' + rotinasAluno.length + ' rotinas desse aluno?')) return;
  await supabase.from('rotinas').delete().eq('aluno_id', alunoId);
  showToast('Treinos apagados');
  await carregarRotinas();
  await syncAgenda(alunoId);
}

async function abrirTemplates() {
  const alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) { showToast('Selecione um aluno primeiro', 'error'); return; }

  // Buscar dias disponíveis da anamnese
  const { data: anamnese } = await supabase.from('anamnese').select('dias_disponiveis').eq('aluno_id', alunoId).single();
  const dias = anamnese?.dias_disponiveis || [];
  const qtd = dias.length;

  const infoEl = document.getElementById('templateInfo');
  if (infoEl) {
    if (qtd > 0) {
      const diasLabel = dias.map(d => ({seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb',dom:'Dom'}[d] || d)).join(', ');
      let recomendacao = '';
      if (qtd <= 3) recomendacao = 'ABC ou Full Body';
      else if (qtd === 4) recomendacao = 'Upper/Lower';
      else recomendacao = 'PPL';
      infoEl.innerHTML = `<div style="background:var(--primary-light);border:1px solid var(--primary);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px;font-size:.85rem"><strong>${qtd} dias:</strong> ${diasLabel}<br><span style="color:var(--primary)">Sugestão: ${recomendacao}</span></div>`;
    } else {
      infoEl.innerHTML = '<p style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px">Aluno não informou dias disponíveis</p>';
    }
  }

  openModal('modalTemplates');
}

async function aplicarTemplate(template) {
  const alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) { showToast('Selecione um aluno primeiro', 'error'); return; }

  const nomes = { ppl: 'PPL', abc: 'ABC', upper_lower: 'Upper/Lower', full_body: 'Full Body' };

  // Se já tem rotinas, perguntar se quer substituir
  if (rotinasAluno.length > 0) {
    if (!confirm('Esse aluno já tem ' + rotinasAluno.length + ' rotina(s). Quer substituir tudo pelo template ' + nomes[template] + '?')) return;
    // Deletar rotinas existentes (cascadeia pra rotina_exercicios)
    await supabase.from('rotinas').delete().eq('aluno_id', alunoId);
  }

  closeModal('modalTemplates');
  showToast('Aplicando ' + nomes[template] + '...');

  const { data, error } = await supabase.rpc('aplicar_template_treino', {
    p_aluno_id: alunoId,
    p_personal_id: window.currentPersonal.id,
    p_template: template
  });

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  if (data?.error) { showToast(data.error, 'error'); return; }

  showToast(nomes[template] + ' aplicado!');
  await carregarRotinas();
  await syncAgenda(alunoId);

  // Banner: confere e vai pra dieta quando quiser
  const banner = document.createElement('div');
  banner.id = 'bannerDieta';
  banner.style.cssText = 'position:sticky;top:0;z-index:50;background:var(--primary);color:#fff;padding:14px 20px;border-radius:var(--radius);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
  banner.innerHTML = `
    <span style="font-weight:600">Treino aplicado! Confira abaixo e quando estiver ok:</span>
    <div style="display:flex;gap:8px">
      <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff" onclick="document.getElementById('bannerDieta').remove()">Ficar aqui</button>
      <button class="btn btn-sm" style="background:#fff;color:var(--primary);font-weight:700" onclick="window.location.href='dieta.html?aluno=${alunoId}'">Ir pra Dieta →</button>
    </div>`;
  const container = document.getElementById('rotinasContainer');
  container.parentNode.insertBefore(banner, container);
}

// ── Sync Agenda: rotinas ativas → agenda automática ──
async function syncAgenda(alunoId) {
  const personalId = window.currentPersonal.id;

  // 1. Buscar rotinas ativas deste aluno com dias definidos
  const { data: rotinas } = await supabase
    .from('rotinas')
    .select('id, dias_semana')
    .eq('aluno_id', alunoId)
    .eq('personal_id', personalId)
    .eq('ativa', true);

  // 2. Coletar todos os dias que devem ter agenda
  const diasAtivos = new Set();
  (rotinas || []).forEach(r => {
    (r.dias_semana || []).forEach(d => diasAtivos.add(d));
  });

  // 3. Buscar agenda existente deste aluno
  const { data: agendaExistente } = await supabase
    .from('agenda')
    .select('id, dia_semana, horario')
    .eq('personal_id', personalId)
    .eq('aluno_id', alunoId)
    .eq('ativo', true);

  const diasComAgenda = new Set((agendaExistente || []).map(a => a.dia_semana));

  // 4. Criar agenda pra dias novos (horário padrão do personal ou 07:00)
  const diasNovos = [...diasAtivos].filter(d => !diasComAgenda.has(d));
  if (diasNovos.length) {
    // Pegar horário mais comum do personal como referência
    const { data: todosHorarios } = await supabase
      .from('agenda')
      .select('horario')
      .eq('personal_id', personalId)
      .eq('ativo', true)
      .limit(10);

    let horarioPadrao = '07:00';
    if (todosHorarios?.length) {
      // Usar o horário mais frequente
      const freq = {};
      todosHorarios.forEach(h => { freq[h.horario] = (freq[h.horario] || 0) + 1; });
      horarioPadrao = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    }

    const novos = diasNovos.map(d => ({
      personal_id: personalId,
      aluno_id: alunoId,
      dia_semana: d,
      horario: horarioPadrao,
      ativo: true
    }));

    await supabase.from('agenda').insert(novos);
  }

  // 5. Remover dias que não tem mais rotina ativa
  const diasRemover = (agendaExistente || []).filter(a => !diasAtivos.has(a.dia_semana));
  if (diasRemover.length) {
    await supabase.from('agenda').delete().in('id', diasRemover.map(a => a.id));
  }
}
