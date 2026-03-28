// LoadPro — Ficha completa do aluno

let alunoAtual = null;

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

document.addEventListener('auth-ready', async () => {
  const params = new URLSearchParams(location.search);
  const alunoId = params.get('id');
  if (!alunoId) { window.location.href = 'alunos.html'; return; }

  // Carregar aluno
  const { data: aluno } = await supabase.from('alunos').select('*').eq('id', alunoId).single();
  if (!aluno) { showToast('Aluno não encontrado', 'error'); return; }
  alunoAtual = aluno;

  // Header
  document.getElementById('alunoAvatar').textContent = getInitials(aluno.nome);
  document.getElementById('alunoNome').textContent = aluno.nome;
  document.getElementById('alunoObjetivo').textContent = aluno.objetivo || 'Sem objetivo';
  const nivelEl = document.getElementById('alunoNivel');
  nivelEl.textContent = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }[aluno.nivel] || '';
  nivelEl.className = 'badge ' + (aluno.nivel === 'avancado' ? 'badge-danger' : aluno.nivel === 'intermediario' ? 'badge-warning' : 'badge-success');

  if (aluno.data_nascimento) {
    document.getElementById('alunoIdade').textContent = `${calcIdade(aluno.data_nascimento)} anos · ${aluno.sexo === 'masculino' ? '♂' : '♀'}`;
  }

  // Último treino
  const { data: ultimoLog } = await supabase
    .from('treino_logs')
    .select('data')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false })
    .limit(1);

  if (ultimoLog?.length) {
    document.getElementById('ultimoTreino').textContent = timeAgo(ultimoLog[0].data);
  }

  // Preencher dados pessoais
  document.getElementById('dNome').value = aluno.nome;
  document.getElementById('dEmail').value = aluno.user_id ? '(vinculado)' : 'Convite pendente';
  document.getElementById('dTelefone').value = aluno.telefone || '';
  document.getElementById('dNascimento').value = aluno.data_nascimento || '';
  document.getElementById('dSexo').value = aluno.sexo || '';
  document.getElementById('dObjetivo').value = aluno.objetivo || '';
  document.getElementById('dNivel').value = aluno.nivel || '';
  document.getElementById('dStatus').value = aluno.status;
  maskPhone(document.getElementById('dTelefone'));

  // Chips de dias
  const diasContainer = document.getElementById('anDias');
  diasContainer.innerHTML = DIAS_SEMANA.map(d =>
    `<div class="chip" data-dia="${d.key}" onclick="this.classList.toggle('active')">${d.label}</div>`
  ).join('');

  // Carregar anamnese
  const { data: anamnese } = await supabase.from('anamnese').select('*').eq('aluno_id', alunoId).single();
  if (anamnese) {
    document.getElementById('anHistorico').value = anamnese.historico_saude || '';
    document.getElementById('anLesoes').value = anamnese.lesoes || '';
    document.getElementById('anMedicamentos').value = anamnese.medicamentos || '';
    document.getElementById('anRestricoes').value = anamnese.restricoes_alimentares || '';
    document.getElementById('anAlergias').value = anamnese.alergias || '';
    document.getElementById('anObs').value = anamnese.observacoes || '';
    (anamnese.dias_disponiveis || []).forEach(d => {
      const chip = diasContainer.querySelector(`[data-dia="${d}"]`);
      if (chip) chip.classList.add('active');
    });
  }

  // Carregar resumo de treinos
  const { data: rotinas } = await supabase.from('rotinas').select('*').eq('aluno_id', alunoId).order('criado_em', { ascending: false });
  if (rotinas?.length) {
    document.getElementById('resumoTreinos').innerHTML = rotinas.map(r => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:500">${r.nome}</div>
          <div style="font-size:.8rem;color:var(--text-muted)">${(r.dias_semana || []).join(', ')}</div>
        </div>
        <span class="badge ${r.ativa ? 'badge-success' : 'badge-danger'}">${r.ativa ? 'Ativa' : 'Inativa'}</span>
      </div>
    `).join('');
  } else {
    document.getElementById('resumoTreinos').innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">Nenhuma rotina criada</p>';
  }

  // Carregar resumo de medidas
  const { data: medidas } = await supabase.from('medidas').select('*').eq('aluno_id', alunoId).order('data', { ascending: false }).limit(3);
  if (medidas?.length) {
    document.getElementById('resumoMedidas').innerHTML = medidas.map(m => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:500">${formatDate(m.data)}</div>
          <div style="font-size:.8rem;color:var(--text-muted)">${m.peso_kg ? m.peso_kg + 'kg' : ''} ${m.gordura_pct ? '· ' + m.gordura_pct + '% gordura' : ''}</div>
        </div>
        ${m.imc ? `<span class="badge badge-primary">IMC ${m.imc}</span>` : ''}
      </div>
    `).join('');
  } else {
    document.getElementById('resumoMedidas').innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">Nenhuma avaliação registrada</p>';
  }

  // Chat — carregar e escutar realtime
  carregarChat(alunoId);

  // Enter pra enviar msg
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarMsg();
  });

  lucide.createIcons();
});

async function salvarDados() {
  const { error } = await supabase.from('alunos').update({
    nome: document.getElementById('dNome').value.trim(),
    telefone: document.getElementById('dTelefone').value.trim() || null,
    data_nascimento: document.getElementById('dNascimento').value || null,
    sexo: document.getElementById('dSexo').value || null,
    objetivo: document.getElementById('dObjetivo').value || null,
    nivel: document.getElementById('dNivel').value || null,
    status: document.getElementById('dStatus').value
  }).eq('id', alunoAtual.id);

  if (error) showToast('Erro ao salvar', 'error');
  else showToast('Dados atualizados!');
}

async function salvarAnamnese() {
  const dados = {
    aluno_id: alunoAtual.id,
    historico_saude: document.getElementById('anHistorico').value.trim(),
    lesoes: document.getElementById('anLesoes').value.trim(),
    medicamentos: document.getElementById('anMedicamentos').value.trim(),
    restricoes_alimentares: document.getElementById('anRestricoes').value.trim(),
    alergias: document.getElementById('anAlergias').value.trim(),
    dias_disponiveis: [...document.querySelectorAll('#anDias .chip.active')].map(c => c.dataset.dia),
    observacoes: document.getElementById('anObs').value.trim(),
    atualizado_em: new Date().toISOString()
  };

  // Upsert
  const { data: existing } = await supabase.from('anamnese').select('id').eq('aluno_id', alunoAtual.id).single();
  let error;
  if (existing) {
    ({ error } = await supabase.from('anamnese').update(dados).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('anamnese').insert(dados));
  }

  if (error) showToast('Erro ao salvar anamnese', 'error');
  else showToast('Anamnese salva!');
}

function copiarConvite() {
  if (!alunoAtual.convite_token) { showToast('Token de convite não gerado', 'error'); return; }
  const link = `${location.origin}/convite.html?token=${alunoAtual.convite_token}`;
  navigator.clipboard.writeText(link);
  showToast('Link de convite copiado!');
}

// ── Chat ──
async function carregarChat(alunoId) {
  const { data: msgs } = await supabase
    .from('mensagens')
    .select('*')
    .eq('aluno_id', alunoId)
    .order('criado_em', { ascending: true })
    .limit(100);

  renderChat(msgs || []);

  // Realtime
  supabase.channel('chat-' + alunoId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `aluno_id=eq.${alunoId}` }, (payload) => {
      appendMsg(payload.new);
    })
    .subscribe();
}

function renderChat(msgs) {
  const container = document.getElementById('chatMessages');
  const myUserId = window.currentUser.id;
  container.innerHTML = msgs.map(m => msgHTML(m, myUserId)).join('');
  container.scrollTop = container.scrollHeight;
}

function appendMsg(m) {
  const container = document.getElementById('chatMessages');
  container.insertAdjacentHTML('beforeend', msgHTML(m, window.currentUser.id));
  container.scrollTop = container.scrollHeight;
}

function msgHTML(m, myUserId) {
  const isMine = m.remetente_id === myUserId;
  return `
    <div style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'};margin-bottom:8px">
      <div style="max-width:70%;padding:10px 14px;border-radius:12px;font-size:.9rem;
        background:${isMine ? 'var(--primary)' : 'var(--bg-card-hover)'};
        color:${isMine ? '#fff' : 'var(--text)'}">
        ${m.texto}
        <div style="font-size:.7rem;margin-top:4px;opacity:.6">${new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  `;
}

async function enviarMsg() {
  const input = document.getElementById('chatInput');
  const texto = input.value.trim();
  if (!texto) return;
  input.value = '';

  await supabase.from('mensagens').insert({
    personal_id: window.currentPersonal.id,
    aluno_id: alunoAtual.id,
    remetente_id: window.currentUser.id,
    texto
  });
}
