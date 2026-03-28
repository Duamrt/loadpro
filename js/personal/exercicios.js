// LoadPro — Biblioteca de Exercícios

let todosExercicios = [];

document.addEventListener('auth-ready', async () => {
  // Popular selects
  const grupoSelect = document.getElementById('exGrupo');
  const filtroGrupo = document.getElementById('filtroGrupo');
  GRUPOS_MUSCULARES.forEach(g => {
    grupoSelect.innerHTML += `<option value="${g}">${g}</option>`;
    filtroGrupo.innerHTML += `<option value="${g}">${g}</option>`;
  });

  const equipSelect = document.getElementById('exEquip');
  const filtroEquip = document.getElementById('filtroEquip');
  EQUIPAMENTOS.forEach(e => {
    equipSelect.innerHTML += `<option value="${e}">${e}</option>`;
    filtroEquip.innerHTML += `<option value="${e}">${e}</option>`;
  });

  // Listeners
  document.getElementById('busca').addEventListener('input', debounce(renderExercicios));
  document.getElementById('filtroGrupo').addEventListener('change', renderExercicios);
  document.getElementById('filtroEquip').addEventListener('change', renderExercicios);

  await carregarExercicios();
});

async function carregarExercicios() {
  const { data } = await supabase
    .from('exercicios')
    .select('*')
    .or(`global.eq.true,personal_id.eq.${window.currentPersonal.id}`)
    .order('nome');

  todosExercicios = data || [];
  document.getElementById('subtitulo').textContent = `${todosExercicios.length} exercícios disponíveis`;
  renderExercicios();
}

function renderExercicios() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const grupo = document.getElementById('filtroGrupo').value;
  const equip = document.getElementById('filtroEquip').value;

  const filtrados = todosExercicios.filter(e =>
    (!busca || e.nome.toLowerCase().includes(busca)) &&
    (!grupo || e.grupo_muscular === grupo) &&
    (!equip || e.equipamento === equip)
  );

  const grid = document.getElementById('exerciciosGrid');
  const empty = document.getElementById('emptyState');

  if (!filtrados.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = filtrados.map(e => `
    <div class="card card-clickable" onclick="verDetalhe('${e.id}')">
      ${e.gif_url ? `<div style="height:120px;border-radius:8px;overflow:hidden;margin-bottom:12px;background:var(--bg-card-hover)"><img src="${esc(e.gif_url)}" alt="${esc(e.nome)}" style="width:100%;height:100%;object-fit:cover"></div>` : `<div style="height:120px;border-radius:8px;background:var(--bg-card-hover);display:flex;align-items:center;justify-content:center;margin-bottom:12px"><i data-lucide="dumbbell" style="width:32px;height:32px;color:var(--text-muted)"></i></div>`}
      <div style="font-weight:600;margin-bottom:4px">${esc(e.nome)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge badge-primary">${esc(e.grupo_muscular)}</span>
        ${e.equipamento ? `<span class="badge" style="background:var(--bg-card-hover);color:var(--text-muted)">${esc(e.equipamento)}</span>` : ''}
        ${!e.global ? '<span class="badge badge-warning">Custom</span>' : ''}
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

function verDetalhe(id) {
  const e = todosExercicios.find(x => x.id === id);
  if (!e) return;

  document.getElementById('detalheNome').textContent = e.nome;
  document.getElementById('detalheBody').innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      ${e.gif_url ? `<div style="flex:1;min-width:200px;text-align:center"><img src="${esc(e.gif_url)}" alt="${esc(e.nome)}" style="max-width:100%;border-radius:8px;max-height:250px"></div>` : ''}
      <div id="muscleMapDetalhe" style="flex:1;min-width:180px;max-width:280px"></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <span class="badge badge-primary">${esc(e.grupo_muscular)}</span>
      ${(e.grupos_secundarios || []).map(g => `<span class="badge" style="background:var(--bg-card-hover);color:var(--text-secondary)">${esc(g)}</span>`).join('')}
      ${e.equipamento ? `<span class="badge badge-warning">${esc(e.equipamento)}</span>` : ''}
    </div>
    ${e.descricao ? `<div style="font-size:.9rem;color:var(--text-secondary);line-height:1.6">${esc(e.descricao)}</div>` : '<p style="color:var(--text-muted)">Sem descrição cadastrada.</p>'}
  `;
  // Renderizar mapa muscular
  if (typeof renderMuscleMap === 'function') {
    renderMuscleMap('muscleMapDetalhe', e.grupo_muscular, e.grupos_secundarios || []);
  }
  openModal('modalDetalhe');
}

async function salvarExercicio() {
  const nome = document.getElementById('exNome').value.trim();
  const grupo = document.getElementById('exGrupo').value;
  if (!nome || !grupo) { showToast('Nome e grupo são obrigatórios', 'error'); return; }

  const secundarios = document.getElementById('exSecundarios').value
    .split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await supabase.from('exercicios').insert({
    personal_id: window.currentPersonal.id,
    nome,
    grupo_muscular: grupo,
    grupos_secundarios: secundarios.length ? secundarios : null,
    descricao: document.getElementById('exDescricao').value.trim() || null,
    gif_url: document.getElementById('exGif').value.trim() || null,
    equipamento: document.getElementById('exEquip').value || null,
    global: false
  });

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  closeModal('modalExercicio');
  document.getElementById('formExercicio').reset();
  showToast('Exercício criado!');
  await carregarExercicios();
}
