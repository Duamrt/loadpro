// LoadPro — Gestão de Alunos

let todosAlunos = [];

document.addEventListener('auth-ready', async () => {
  const personal = window.currentPersonal;
  if (!personal) return;

  // Máscara telefone
  maskPhone(document.getElementById('alTelefone'));

  // Busca e filtro
  document.getElementById('busca').addEventListener('input', debounce(renderAlunos));
  document.getElementById('filtroStatus').addEventListener('change', carregarAlunos);

  await carregarAlunos();

  // Se veio com ?novo=1, abrir modal de cadastro
  if (new URLSearchParams(location.search).get('novo')) openModal('modalAluno');
});

async function carregarAlunos() {
  const personal = window.currentPersonal;
  const status = document.getElementById('filtroStatus').value;

  let query = supabase
    .from('alunos')
    .select('*')
    .eq('personal_id', personal.id)
    .order('nome');

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { showToast('Erro ao carregar alunos', 'error'); return; }

  todosAlunos = data || [];
  document.getElementById('subtitulo').textContent = `${todosAlunos.length} aluno${todosAlunos.length !== 1 ? 's' : ''}`;
  renderAlunos();
}

function renderAlunos() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const filtrados = todosAlunos.filter(a =>
    !busca || a.nome.toLowerCase().includes(busca)
  );

  const grid = document.getElementById('alunosGrid');
  const empty = document.getElementById('emptyState');

  if (filtrados.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = filtrados.map(a => {
    const statusBadge = {
      ativo: '<span class="badge badge-success">Ativo</span>',
      pendente: '<span class="badge badge-warning">Pendente</span>',
      arquivado: '<span class="badge badge-danger">Arquivado</span>'
    }[a.status] || '';

    const nivelLabel = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }[a.nivel] || '';

    return `
      <div class="card card-clickable" onclick="window.location.href='aluno-detalhe.html?id=${a.id}'">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <div class="avatar">${getInitials(a.nome)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.nome)}</div>
            <div style="font-size:.8rem;color:var(--text-muted)">${esc(a.objetivo || 'Sem objetivo')}</div>
          </div>
          ${statusBadge}
        </div>
        <div style="display:flex;gap:16px;font-size:.8rem;color:var(--text-secondary)">
          ${nivelLabel ? `<span><i data-lucide="signal" style="width:14px;height:14px;vertical-align:-2px"></i> ${nivelLabel}</span>` : ''}
          ${a.data_nascimento ? `<span><i data-lucide="calendar" style="width:14px;height:14px;vertical-align:-2px"></i> ${calcIdade(a.data_nascimento)} anos</span>` : ''}
          ${a.sexo ? `<span>${a.sexo === 'masculino' ? '♂' : '♀'}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function enviarFichaWhatsApp(nomeAluno, telefone, link) {
  const user = window.currentUser;
  const nomePersonal = (user?.nome || 'seu personal').split(' ')[0];
  const primeiroNome = (nomeAluno || '').split(' ')[0];

  const msg = [
    'Fala ' + primeiroNome + '! Aqui é o ' + nomePersonal + ', seu personal.',
    '',
    'Pra eu montar seu treino e dieta, preciso que você preencha uma ficha rápida com seus dados, saúde e medidas.',
    '',
    'Leva menos de 2 minutos:',
    link,
    '',
    'Assim que você preencher, eu já começo a montar tudo personalizado pra você!'
  ].join('\n');

  if (telefone) {
    const num = telefone.replace(/\D/g, '');
    const fone = num.startsWith('55') ? num : '55' + num;
    window.open('https://wa.me/' + fone + '?text=' + encodeURIComponent(msg), '_blank');
  } else {
    try { navigator.clipboard.writeText(msg); } catch(e) {}
    showToast('Link copiado! Cole no WhatsApp do aluno.');
  }
}

function enviarConviteWhatsApp(nomeAluno, telefone, link) {
  const personal = window.currentPersonal;
  const user = window.currentUser;
  const nomePersonal = (user?.nome || 'seu personal').split(' ')[0];
  const primeiroNome = (nomeAluno || '').split(' ')[0];

  const abertura = personal?.msg_convite_abertura || ('Fala ' + primeiroNome + '! Aqui é o ' + nomePersonal + ', seu personal.');
  const fechamento = personal?.msg_convite_fechamento || ('Qualquer dúvida me chama aqui. Bora! - ' + nomePersonal);

  const msg = [
    abertura,
    '',
    'Seu treino e dieta estão prontos! No app você vai ver tudo organizado: treino do dia, séries, carga, dieta com checklist e sua evolução.',
    '',
    'Cria sua senha aqui pra acessar (é rapidinho):',
    link,
    '',
    fechamento
  ].join('\n');

  if (telefone) {
    const num = telefone.replace(/\D/g, '');
    const fone = num.startsWith('55') ? num : '55' + num;
    window.open('https://wa.me/' + fone + '?text=' + encodeURIComponent(msg), '_blank');
  } else {
    // Sem telefone: copiar link e abrir WhatsApp genérico
    try { navigator.clipboard.writeText(msg); } catch(e) {}
    showToast('Link copiado! Cole no WhatsApp do aluno.');
  }
}

async function salvarAluno() {
  const personal = window.currentPersonal;
  const btn = document.getElementById('btnSalvar');

  const nome = document.getElementById('alNome').value.trim();
  const email = document.getElementById('alEmail').value.trim();

  if (!nome || !email) { showToast('Nome e email são obrigatórios', 'error'); return; }

  // Verificar limite do plano
  const { count } = await supabase
    .from('alunos')
    .select('id', { count: 'exact', head: true })
    .eq('personal_id', personal.id)
    .eq('status', 'ativo');

  if (count >= window.limiteAlunos) {
    showToast(`Limite de ${window.limiteAlunos} alunos atingido. Faça upgrade do plano.`, 'error');
    return;
  }

  btn.disabled = true;

  // Gerar token de convite (fallback pra HTTP onde crypto.randomUUID não existe)
  const token = (typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === 'x' ? r : (r&0x3|0x8)).toString(16); }) + '-' + Date.now().toString(36);

  const alunoId = document.getElementById('alunoId').value;

  const dados = {
    personal_id: personal.id,
    nome,
    email,
    telefone: document.getElementById('alTelefone').value.trim() || null,
    data_nascimento: document.getElementById('alNascimento').value || null,
    sexo: document.getElementById('alSexo').value || null,
    objetivo: document.getElementById('alObjetivo').value || null,
    nivel: document.getElementById('alNivel').value || null,
    status: 'pendente'
  };

  // Só gerar token no insert, não no update (senão invalida convite anterior)
  if (!alunoId) {
    dados.convite_token = token;
  }

  let error;
  if (alunoId) {
    ({ error } = await supabase.from('alunos').update(dados).eq('id', alunoId));
  } else {
    ({ error } = await supabase.from('alunos').insert(dados));
  }

  if (error) {
    showToast('Erro ao salvar: ' + error.message, 'error');
    btn.disabled = false;
    return;
  }

  // TODO: enviar email de convite via Supabase Edge Function
  // Por enquanto, o link de convite fica disponível na ficha do aluno

  closeModal('modalAluno');
  document.getElementById('formAluno').reset();
  document.getElementById('alunoId').value = '';
  btn.disabled = false;

  if (alunoId) {
    showToast('Aluno atualizado!');
  } else {
    // Novo aluno: enviar link da ficha por WhatsApp
    document.getElementById('filtroStatus').value = 'pendente';
    const telefone = dados.telefone;
    const link = window.location.origin + '/ficha.html?token=' + token;
    enviarFichaWhatsApp(nome, telefone, link);
    showToast('Aluno cadastrado!');
  }
  await carregarAlunos();
}
