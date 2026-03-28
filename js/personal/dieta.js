// LoadPro — Dieta e Nutrição

let planoAtivo = null;
let alunoSelecionado = null;
let calcResult = null;

document.addEventListener('auth-ready', async () => {
  const personal = window.currentPersonal;

  const { data: alunos } = await supabase
    .from('alunos').select('id, nome, sexo, data_nascimento, objetivo')
    .eq('personal_id', personal.id).in('status', ['ativo','pendente']).order('nome');

  const select = document.getElementById('seletorAluno');
  (alunos || []).forEach(a => {
    select.innerHTML += `<option value="${a.id}" data-sexo="${a.sexo}" data-nasc="${a.data_nascimento}" data-obj="${esc(a.objetivo)}">${esc(a.nome)}</option>`;
  });

  select.addEventListener('change', async () => {
    const opt = select.options[select.selectedIndex];
    alunoSelecionado = {
      id: select.value,
      sexo: opt.dataset.sexo,
      data_nascimento: opt.dataset.nasc,
      objetivo: opt.dataset.obj
    };
    if (select.value) {
      document.getElementById('calcCard').style.display = 'block';
      // Auto-selecionar objetivo
      const objMap = { 'Emagrecimento': 'deficit', 'Hipertrofia': 'superavit', 'Condicionamento': 'manutencao' };
      if (objMap[alunoSelecionado.objetivo]) document.getElementById('objDieta').value = objMap[alunoSelecionado.objetivo];
      await carregarPlano();
    }
  });

  const params = new URLSearchParams(location.search);
  if (params.get('aluno')) { select.value = params.get('aluno'); select.dispatchEvent(new Event('change')); }
});

async function carregarPlano() {
  if (!alunoSelecionado?.id) return;

  const { data: planos } = await supabase
    .from('planos_dieta')
    .select('*, refeicoes(*, refeicao_alimentos(*))')
    .eq('aluno_id', alunoSelecionado.id)
    .eq('ativo', true)
    .order('criado_em', { ascending: false })
    .limit(1);

  planoAtivo = planos?.[0] || null;
  renderPlano();
}

function renderPlano() {
  const container = document.getElementById('planoContainer');
  const empty = document.getElementById('emptyState');

  if (!planoAtivo) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  const refeicoes = (planoAtivo.refeicoes || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const totalKcal = refeicoes.reduce((s, r) => s + (r.calorias || 0), 0);

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <h3 class="card-title">${esc(planoAtivo.nome)}</h3>
        <div style="display:flex;gap:8px">
          <span class="badge badge-primary">${planoAtivo.meta_kcal || '—'} kcal/dia</span>
          <span class="badge badge-success">P: ${planoAtivo.proteina_g || '—'}g</span>
          <span class="badge badge-warning">C: ${planoAtivo.carboidrato_g || '—'}g</span>
          <span class="badge badge-danger">G: ${planoAtivo.gordura_g || '—'}g</span>
        </div>
      </div>

      ${refeicoes.map(r => `
        <div style="border-top:1px solid var(--border);padding:16px 0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div>
              <strong>${esc(r.nome)}</strong>
              ${r.horario ? `<span style="font-size:.8rem;color:var(--text-muted);margin-left:8px">${r.horario}</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${r.calorias ? `<span style="font-size:.85rem;color:var(--text-secondary)">${r.calorias} kcal</span>` : ''}
              <button class="btn btn-sm btn-secondary" style="padding:4px 8px" onclick="editarRefeicao('${r.id}')"><i data-lucide="edit-2" style="width:14px;height:14px"></i></button>
              <button class="btn btn-sm btn-danger" style="padding:4px 8px" onclick="deletarRefeicao('${r.id}')"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
            </div>
          </div>
          ${r.descricao ? `<div style="font-size:.9rem;color:var(--text-secondary);white-space:pre-line">${esc(r.descricao)}</div>` : ''}
        </div>
      `).join('')}

      <div style="border-top:1px solid var(--border);padding-top:16px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:.9rem;color:var(--text-muted)">Total: <strong style="color:var(--text)">${totalKcal} kcal</strong> de ${planoAtivo.meta_kcal || '—'}</div>
        <button class="btn btn-sm btn-secondary" onclick="addRefeicao()"><i data-lucide="plus"></i> Refeição</button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

async function calcularTMB() {
  if (!alunoSelecionado?.id) return;

  // Buscar última avaliação
  const { data: aval } = await supabase
    .from('avaliacoes')
    .select('peso, altura')
    .eq('aluno_id', alunoSelecionado.id)
    .order('data', { ascending: false })
    .limit(1)
    .single();

  if (!aval?.peso || !aval?.altura) {
    showToast('Registre peso e altura na avaliação física primeiro', 'warning');
    return;
  }

  const idade = calcIdade(alunoSelecionado.data_nascimento);
  if (!idade) { showToast('Data de nascimento não cadastrada', 'warning'); return; }

  const tmb = calcTMB(aval.peso, aval.altura, idade, alunoSelecionado.sexo);
  const fator = +document.getElementById('fatorAtividade').value;
  const get = tmb * fator;
  const obj = document.getElementById('objDieta').value;

  let meta;
  if (obj === 'deficit') meta = get - 400;
  else if (obj === 'superavit') meta = get + 300;
  else meta = get;

  const macros = calcMacros(meta, aval.peso);

  calcResult = { tmb: Math.round(tmb), get: Math.round(get), meta: Math.round(meta), fator, objetivo_dieta: obj, ...macros };

  document.getElementById('resTMB').textContent = calcResult.tmb;
  document.getElementById('resGET').textContent = calcResult.get;
  document.getElementById('resMeta').textContent = calcResult.meta;
  document.getElementById('resProt').textContent = macros.proteinaG;
  document.getElementById('resCarb').textContent = macros.carboG;
  document.getElementById('resGord').textContent = macros.gorduraG;
  document.getElementById('resultadoCalc').style.display = 'grid';
  document.getElementById('btnUsarCalc').style.display = 'inline-flex';
}

async function usarCalculoNoPlano() {
  if (!calcResult || !alunoSelecionado?.id) return;

  if (planoAtivo) {
    // Atualizar plano existente
    await supabase.from('planos_dieta').update({
      tmb: calcResult.tmb, get_kcal: calcResult.get, meta_kcal: calcResult.meta,
      proteina_g: calcResult.proteinaG, carboidrato_g: calcResult.carboG,
      gordura_g: calcResult.gorduraG, fator_atividade: calcResult.fator,
      objetivo_dieta: calcResult.objetivo_dieta, atualizado_em: new Date().toISOString()
    }).eq('id', planoAtivo.id);
  } else {
    // Criar novo plano
    await supabase.from('planos_dieta').insert({
      aluno_id: alunoSelecionado.id, personal_id: window.currentPersonal.id,
      tmb: calcResult.tmb, get_kcal: calcResult.get, meta_kcal: calcResult.meta,
      proteina_g: calcResult.proteinaG, carboidrato_g: calcResult.carboG,
      gordura_g: calcResult.gorduraG, fator_atividade: calcResult.fator,
      objetivo_dieta: calcResult.objetivo_dieta
    });
  }

  showToast('Valores aplicados ao plano!');
  await carregarPlano();
}

async function novoPlano() {
  if (!alunoSelecionado?.id) { showToast('Selecione um aluno', 'warning'); return; }

  // Desativar planos anteriores
  if (planoAtivo) {
    await supabase.from('planos_dieta').update({ ativo: false }).eq('aluno_id', alunoSelecionado.id);
  }

  await supabase.from('planos_dieta').insert({
    aluno_id: alunoSelecionado.id,
    personal_id: window.currentPersonal.id,
    nome: 'Plano Alimentar'
  });

  showToast('Novo plano criado!');
  await carregarPlano();
}

function addRefeicao() {
  if (!planoAtivo) return;
  document.getElementById('refId').value = '';
  document.getElementById('refPlanoId').value = planoAtivo.id;
  document.getElementById('refNome').value = '';
  document.getElementById('refHorario').value = '';
  document.getElementById('refDescricao').value = '';
  document.getElementById('refKcal').value = '';
  document.getElementById('refProt').value = '';
  document.getElementById('refCarb').value = '';
  document.getElementById('refGord').value = '';
  document.getElementById('refModalTitle').textContent = 'Nova Refeição';
  openModal('modalRefeicao');
}

function editarRefeicao(id) {
  const ref = planoAtivo?.refeicoes?.find(r => r.id === id);
  if (!ref) return;
  document.getElementById('refId').value = id;
  document.getElementById('refPlanoId').value = planoAtivo.id;
  document.getElementById('refNome').value = ref.nome;
  document.getElementById('refHorario').value = ref.horario || '';
  document.getElementById('refDescricao').value = ref.descricao || '';
  document.getElementById('refKcal').value = ref.calorias || '';
  document.getElementById('refProt').value = ref.proteina_g || '';
  document.getElementById('refCarb').value = ref.carboidrato_g || '';
  document.getElementById('refGord').value = ref.gordura_g || '';
  document.getElementById('refModalTitle').textContent = 'Editar Refeição';
  openModal('modalRefeicao');
}

async function salvarRefeicao() {
  const nome = document.getElementById('refNome').value.trim();
  if (!nome) { showToast('Nome é obrigatório', 'error'); return; }

  const dados = {
    plano_id: document.getElementById('refPlanoId').value,
    nome,
    horario: document.getElementById('refHorario').value || null,
    descricao: document.getElementById('refDescricao').value.trim() || null,
    calorias: +document.getElementById('refKcal').value || null,
    proteina_g: +document.getElementById('refProt').value || null,
    carboidrato_g: +document.getElementById('refCarb').value || null,
    gordura_g: +document.getElementById('refGord').value || null,
    ordem: (planoAtivo?.refeicoes?.length || 0) + 1
  };

  const id = document.getElementById('refId').value;
  if (id) {
    await supabase.from('refeicoes').update(dados).eq('id', id);
  } else {
    await supabase.from('refeicoes').insert(dados);
  }

  closeModal('modalRefeicao');
  showToast(id ? 'Refeição atualizada!' : 'Refeição adicionada!');
  await carregarPlano();
}

async function deletarRefeicao(id) {
  await supabase.from('refeicoes').delete().eq('id', id);
  showToast('Refeição removida');
  await carregarPlano();
}

// ── Template de Dieta ──
async function abrirTemplateDieta() {
  if (!alunoSelecionado?.id) { showToast('Selecione um aluno primeiro', 'error'); return; }

  // Puxar peso/altura da última avaliação
  const { data: aval } = await supabase
    .from('avaliacoes')
    .select('peso, altura')
    .eq('aluno_id', alunoSelecionado.id)
    .order('data', { ascending: false })
    .limit(1)
    .single();

  if (aval?.peso) document.getElementById('tplPeso').value = aval.peso;
  if (aval?.altura) document.getElementById('tplAltura').value = aval.altura;

  openModal('modalTemplateDieta');
}

async function aplicarTemplateDieta(objetivo) {
  if (!alunoSelecionado?.id) return;
  const peso = +(document.getElementById('tplPeso')?.value || 0);
  const altura = +(document.getElementById('tplAltura')?.value || 0);
  const fator = +(document.getElementById('tplFator')?.value || 1.55);

  if (!peso || !altura) { showToast('Preencha peso e altura', 'error'); return; }

  closeModal('modalTemplateDieta');
  showToast('Calculando e montando dieta...');

  const { data, error } = await supabase.rpc('aplicar_template_dieta', {
    p_aluno_id: alunoSelecionado.id,
    p_personal_id: window.currentPersonal.id,
    p_objetivo: objetivo,
    p_fator: fator,
    p_peso: peso,
    p_altura: altura
  });

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  if (data?.error) { showToast(data.error, 'warning'); return; }

  showToast('Dieta montada! ' + data.meta_kcal + ' kcal/dia');
  setTimeout(() => carregarPlano(), 300);
}
