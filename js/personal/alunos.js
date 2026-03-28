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
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.nome}</div>
            <div style="font-size:.8rem;color:var(--text-muted)">${a.objetivo || 'Sem objetivo'}</div>
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

  // Gerar token de convite
  const token = crypto.randomUUID();

  const dados = {
    personal_id: personal.id,
    nome,
    telefone: document.getElementById('alTelefone').value.trim() || null,
    data_nascimento: document.getElementById('alNascimento').value || null,
    sexo: document.getElementById('alSexo').value || null,
    objetivo: document.getElementById('alObjetivo').value || null,
    nivel: document.getElementById('alNivel').value || null,
    convite_token: token,
    status: 'pendente'
  };

  const alunoId = document.getElementById('alunoId').value;

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
  showToast(alunoId ? 'Aluno atualizado!' : 'Aluno cadastrado! Convite pendente.');
  btn.disabled = false;
  await carregarAlunos();
}
