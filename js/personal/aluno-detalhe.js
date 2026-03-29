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

  // Carregar aluno (filtra por personal_id pra segurança)
  const { data: aluno } = await supabase.from('alunos').select('*').eq('id', alunoId).eq('personal_id', window.currentPersonal.id).single();
  if (!aluno) { showToast('Aluno não encontrado', 'error'); window.location.href = 'alunos.html'; return; }
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

  // Links com aluno pré-selecionado
  var linkTreinos = document.getElementById('linkTreinos');
  if (linkTreinos) linkTreinos.href = 'treinos.html?aluno=' + alunoId;
  var linkDieta = document.getElementById('linkDieta');
  if (linkDieta) linkDieta.href = 'dieta.html?aluno=' + alunoId;
  var linkAvaliacao = document.getElementById('linkAvaliacao');
  if (linkAvaliacao) linkAvaliacao.href = 'avaliacao.html?aluno=' + alunoId;

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
  document.getElementById('dEmail').value = aluno.email || '';
  document.getElementById('dTelefone').value = aluno.telefone || '';

  // Seção de acesso
  if (aluno.user_id) {
    document.getElementById('acessoAtivo').style.display = 'block';
    document.getElementById('acessoEmail').value = aluno.email || '';
  } else {
    document.getElementById('acessoPendente').style.display = 'block';
  }
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
          <div style="font-weight:500">${esc(r.nome)}</div>
          <div style="font-size:.8rem;color:var(--text-muted)">${(r.dias_semana || []).join(', ')}</div>
        </div>
        <span class="badge ${r.ativa ? 'badge-success' : 'badge-danger'}">${r.ativa ? 'Ativa' : 'Inativa'}</span>
      </div>
    `).join('');
  } else {
    document.getElementById('resumoTreinos').innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">Nenhuma rotina criada</p>';
  }

  // Carregar resumo de avaliações
  const { data: avaliacoes } = await supabase.from('avaliacoes').select('*').eq('aluno_id', alunoId).order('data', { ascending: false }).limit(3);
  if (avaliacoes?.length) {
    document.getElementById('resumoMedidas').innerHTML = avaliacoes.map(m => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:500">${formatDate(m.data)}</div>
          <div style="font-size:.8rem;color:var(--text-muted)">${m.peso ? m.peso + 'kg' : ''} ${m.bf_percent ? '· ' + m.bf_percent.toFixed(1) + '% gordura' : ''} ${m.altura ? '· ' + m.altura + 'cm' : ''}</div>
        </div>
        ${m.imc ? `<span class="badge badge-primary">IMC ${m.imc.toFixed(1)}</span>` : ''}
      </div>
    `).join('');
  } else {
    document.getElementById('resumoMedidas').innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">Nenhuma avaliação registrada</p>';
  }

  // Chat — carregar e escutar realtime
  carregarChat(alunoId);

  // Fotos de progresso
  carregarFotos(alunoId);

  // Enter pra enviar msg
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarMsg();
  });

  lucide.createIcons();
});

async function salvarDados() {
  const { error } = await supabase.from('alunos').update({
    nome: document.getElementById('dNome').value.trim(),
    email: document.getElementById('dEmail').value.trim() || null,
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

async function excluirAluno() {
  if (!alunoAtual) return;
  if (!confirm('Excluir ' + alunoAtual.nome + '? Todos os dados (treinos, dieta, chat, fotos) serão apagados permanentemente.')) return;
  const { error } = await supabase.from('alunos').delete().eq('id', alunoAtual.id);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  showToast('Aluno excluído');
  window.location.href = 'alunos.html';
}

function enviarConviteWhatsApp(nomeAluno, telefone, link) {
  const personal = window.currentPersonal;
  const user = window.currentUser;
  const nomePersonal = user?.nome?.split(' ')[0] || 'seu personal';
  const primeiroNome = (nomeAluno || '').split(' ')[0];
  const abertura = personal?.msg_convite_abertura || ('Fala ' + primeiroNome + '! Aqui é o ' + nomePersonal + ', seu personal.');
  const fechamento = personal?.msg_convite_fechamento || ('Qualquer dúvida me chama aqui. Bora! - ' + nomePersonal);
  const msg = [abertura, '', 'Seu treino e dieta estão prontos! No app você vai ver tudo organizado: treino do dia, séries, carga, dieta com checklist e sua evolução.', '', 'Cria sua senha aqui pra acessar (é rapidinho):', link, '', fechamento].join('\n');
  if (telefone) {
    const num = telefone.replace(/\D/g, '');
    const fone = num.startsWith('55') ? num : '55' + num;
    window.open('https://wa.me/' + fone + '?text=' + encodeURIComponent(msg), '_blank');
  } else {
    try { navigator.clipboard.writeText(msg); } catch(e) {}
    showToast('Link copiado! Cole no WhatsApp do aluno.');
  }
}

async function enviarConviteWA() {
  let token = alunoAtual.convite_token;
  if (!token) {
    token = (typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const { error } = await supabase.from('alunos').update({ convite_token: token }).eq('id', alunoAtual.id);
    if (error) { showToast('Erro ao gerar token', 'error'); return; }
    alunoAtual.convite_token = token;
  }
  const shortCode = token.split('-')[0];
  const link = `${location.origin}/c/${shortCode}`;
  enviarConviteWhatsApp(alunoAtual.nome, alunoAtual.telefone, link);
}

// ── Resetar senha do aluno ──
async function resetarSenhaAluno() {
  const senha = document.getElementById('acessoSenha').value.trim();
  if (!senha || senha.length < 6) { showToast('Senha precisa ter no mínimo 6 caracteres', 'error'); return; }

  const btn = document.getElementById('btnResetSenha');
  btn.disabled = true;

  const { data, error } = await supabase.rpc('resetar_senha_aluno', {
    p_aluno_id: alunoAtual.id,
    p_nova_senha: senha
  });

  if (error) {
    showToast('Erro: ' + error.message, 'error');
    btn.disabled = false;
    return;
  }

  if (data?.error) {
    showToast(data.error, 'error');
    btn.disabled = false;
    return;
  }

  showToast('Senha redefinida! Avise o aluno.');
  document.getElementById('acessoSenha').value = '';
  btn.disabled = false;
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
  const hora = new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  let conteudo = '';
  if (m.foto_url) {
    conteudo += `<img src="${esc(m.foto_url)}" style="max-width:100%;max-width:min(100%,200px);border-radius:8px;margin-bottom:4px;cursor:pointer" onclick="abrirFotoDetalhe('${esc(m.foto_url)}')" loading="lazy">`;
  }
  if (m.texto) conteudo += esc(m.texto);
  return `
    <div style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'};margin-bottom:8px">
      <div style="max-width:70%;padding:10px 14px;border-radius:12px;font-size:.9rem;
        background:${isMine ? 'var(--primary)' : 'var(--bg-card-hover)'};
        color:${isMine ? '#fff' : 'var(--text)'}">
        ${conteudo}
        <div style="font-size:.7rem;margin-top:4px;opacity:.6">${hora}</div>
      </div>
    </div>
  `;
}

function abrirFotoDetalhe(url) {
  const lb = document.getElementById('lightbox');
  if (lb) {
    document.getElementById('lightboxImg').src = url;
    lb.style.display = 'flex';
  }
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

// ── Galeria de Fotos de Progresso ──
async function carregarFotos(alunoId) {
  const { data: fotos } = await supabase
    .from('fotos_progresso')
    .select('*')
    .eq('aluno_id', alunoId)
    .order('criado_em', { ascending: false });

  const container = document.getElementById('galFotos');
  if (!fotos?.length) return;

  const tipoNomes = { frente: 'Frente', costas: 'Costas', lateral_d: 'Lado D', lateral_e: 'Lado E' };
  const tiposOrdem = ['frente', 'costas', 'lateral_d', 'lateral_e'];

  // Separar fotos com tipo (progresso) e sem tipo (avulsas)
  const porTipo = {};
  const avulsas = [];
  fotos.forEach(f => {
    if (f.tipo && tipoNomes[f.tipo]) {
      if (!porTipo[f.tipo]) porTipo[f.tipo] = [];
      porTipo[f.tipo].push(f);
    } else {
      avulsas.push(f);
    }
  });

  let html = '';

  // Grid comparativo por tipo (última foto de cada pose)
  const temTipo = tiposOrdem.some(t => porTipo[t]?.length);
  if (temTipo) {
    html += `<div style="margin-bottom:20px">
      <h4 style="margin-bottom:12px;font-size:.9rem;color:var(--text-secondary)">Últimas fotos de progresso</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">`;
    tiposOrdem.forEach(t => {
      const foto = porTipo[t]?.[0]; // já vem DESC, primeira é mais recente
      if (foto) {
        html += `<div style="text-align:center">
          <div style="position:relative;aspect-ratio:3/4;border-radius:8px;overflow:hidden;cursor:pointer" onclick="abrirFotoDetalhe('${esc(foto.url)}')">
            <img src="${esc(foto.url)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
          </div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${tipoNomes[t]}</div>
          <div style="font-size:.7rem;color:var(--text-muted)">${new Date(foto.criado_em).toLocaleDateString('pt-BR')}</div>
        </div>`;
      } else {
        html += `<div style="text-align:center">
          <div style="aspect-ratio:3/4;border-radius:8px;background:var(--bg-card-hover);display:flex;align-items:center;justify-content:center;border:2px dashed var(--border)">
            <span style="font-size:.75rem;color:var(--text-muted)">${tipoNomes[t]}</span>
          </div>
        </div>`;
      }
    });
    html += `</div></div>`;
  }

  // Histórico por mês (todas as fotos)
  const grupos = {};
  fotos.forEach(f => {
    const d = new Date(f.criado_em);
    const key = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(f);
  });

  for (const [mes, lista] of Object.entries(grupos)) {
    html += `<div style="margin-bottom:20px">
      <h4 style="margin-bottom:12px;text-transform:capitalize;font-size:.9rem;color:var(--text-secondary)">${esc(mes)}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">`;
    lista.forEach(f => {
      const tipo = f.tipo && tipoNomes[f.tipo] ? `<span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.7);color:#fff;font-size:.65rem;padding:2px 6px;border-radius:4px">${tipoNomes[f.tipo]}</span>` : '';
      html += `
        <div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer" onclick="abrirFotoDetalhe('${esc(f.url)}')">
          <img src="${esc(f.url)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
          ${tipo}
        </div>`;
    });
    html += `</div></div>`;
  }

  container.innerHTML = html;
}
