// LoadPro — Dieta e Nutrição

let planoAtivo = null;
let alunoSelecionado = null;
let calcResult = null;
let todosAlunosDieta = [];

document.addEventListener('auth-ready', async () => {
  const personal = window.currentPersonal;

  const { data: alunos } = await supabase
    .from('alunos').select('id, nome, sexo, data_nascimento, objetivo')
    .eq('personal_id', personal.id).in('status', ['ativo','pendente']).order('nome');

  todosAlunosDieta = alunos || [];
  const select = document.getElementById('seletorAluno');
  todosAlunosDieta.forEach(a => {
    select.innerHTML += `<option value="${a.id}" data-sexo="${a.sexo}" data-nasc="${a.data_nascimento}" data-obj="${esc(a.objetivo)}">${esc(a.nome)}</option>`;
  });

  let valorAnterior = '';
  select.addEventListener('change', async () => {
    if (planoAtivo && valorAnterior) {
      if (!confirm('Trocar de aluno? Os dados do aluno atual não serão perdidos.')) {
        select.value = valorAnterior;
        return;
      }
    }
    valorAnterior = select.value;

    const opt = select.options[select.selectedIndex];
    alunoSelecionado = {
      id: select.value,
      sexo: opt.dataset.sexo,
      data_nascimento: opt.dataset.nasc,
      objetivo: opt.dataset.obj
    };
    if (select.value) {
      document.getElementById('calcCard').style.display = 'block';
      const objMap = { 'Emagrecimento': 'deficit', 'Hipertrofia': 'superavit', 'Condicionamento': 'manutencao' };
      if (objMap[alunoSelecionado.objetivo]) document.getElementById('objDieta').value = objMap[alunoSelecionado.objetivo];
      await carregarPlano();
    } else {
      planoAtivo = null;
      mostrarResumoDieta();
    }
  });

  const params = new URLSearchParams(location.search);
  if (params.get('aluno')) {
    select.value = params.get('aluno');
    valorAnterior = select.value;
    select.dispatchEvent(new Event('change'));
  } else {
    mostrarResumoDieta();
  }
});

async function mostrarResumoDieta() {
  const container = document.getElementById('planoContainer');
  const empty = document.getElementById('emptyState');
  empty.style.display = 'none';

  if (!todosAlunosDieta.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  // Buscar planos ativos
  const { data: planos } = await supabase
    .from('planos_dieta')
    .select('aluno_id, nome, meta_kcal, ativo')
    .eq('personal_id', window.currentPersonal.id)
    .eq('ativo', true);

  const planoMap = {};
  (planos || []).forEach(p => { planoMap[p.aluno_id] = p; });

  container.innerHTML = `
    <div style="margin-bottom:16px;color:var(--text-secondary);font-size:.9rem">Selecione um aluno pra ver ou criar o plano alimentar:</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
      ${todosAlunosDieta.map(a => {
        const p = planoMap[a.id];
        return `
          <div class="card card-clickable" style="padding:16px;cursor:pointer" onclick="document.getElementById('seletorAluno').value='${a.id}';document.getElementById('seletorAluno').dispatchEvent(new Event('change'))">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="avatar">${getInitials(a.nome)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.nome)}</div>
                <div style="font-size:.8rem;margin-top:2px">
                  ${p
                    ? `<span style="color:var(--success)">${p.meta_kcal || '—'} kcal/dia</span>`
                    : '<span style="color:var(--text-muted)">Sem dieta</span>'}
                </div>
              </div>
              ${p ? '<i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success)"></i>' : '<i data-lucide="plus-circle" style="width:16px;height:16px;color:var(--text-muted)"></i>'}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  lucide.createIcons();
}

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
  const btnLimpar = document.getElementById('btnLimparDieta');
  if (btnLimpar) btnLimpar.style.display = planoAtivo ? 'inline-flex' : 'none';

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
      <div class="card-header" style="flex-wrap:wrap;gap:8px">
        <div>
          <h3 class="card-title">${esc(planoAtivo.nome)}</h3>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:4px;display:flex;align-items:center;gap:8px">
            ${planoAtivo.data_inicio || planoAtivo.data_fim ? `
              <span>${planoAtivo.data_inicio ? formatDate(planoAtivo.data_inicio) : '—'} → ${planoAtivo.data_fim ? formatDate(planoAtivo.data_fim) : '—'}</span>
            ` : ''}
            <button class="btn btn-sm btn-secondary" style="padding:2px 8px;font-size:.75rem" onclick="editarPeriodoPlano()">
              ${planoAtivo.data_inicio ? 'Alterar período' : 'Definir período'}
            </button>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
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
              ${r.horario ? `<span style="font-size:.8rem;color:var(--text-muted);margin-left:8px">${r.horario.substring(0,5)}</span>` : ''}
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

async function editarPeriodoPlano() {
  if (!planoAtivo) return;
  const hoje = new Date().toISOString().split('T')[0];
  const inicio = planoAtivo.data_inicio || hoje;
  // Default: 4 semanas
  const fimDefault = planoAtivo.data_fim || new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0];

  // Criar modal dinâmico
  let overlay = document.getElementById('modalPeriodo');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'modalPeriodo';
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-header">
        <h3>Período do Plano</h3>
        <button class="modal-close" onclick="closeModal('modalPeriodo')"><i data-lucide="x" style="width:20px;height:20px"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Início</label>
          <input type="date" class="form-control" id="periodoInicio" value="${inicio}">
        </div>
        <div class="form-group">
          <label>Fim</label>
          <input type="date" class="form-control" id="periodoFim" value="${fimDefault}">
        </div>
        <div style="font-size:.8rem;color:var(--text-muted);margin-top:8px" id="periodoDuracao"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalPeriodo')">Cancelar</button>
        <button class="btn btn-primary" id="btnSalvarPeriodo">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  try { lucide.createIcons(); } catch(e) {}

  document.getElementById('btnSalvarPeriodo').onclick = async () => {
    const di = document.getElementById('periodoInicio').value;
    const df = document.getElementById('periodoFim').value;
    await supabase.from('planos_dieta').update({ data_inicio: di || null, data_fim: df || null }).eq('id', planoAtivo.id);
    showToast('Período salvo');
    closeModal('modalPeriodo');
    await carregarPlano();
  };

  // Calcular duração em tempo real
  const calcDuracao = () => {
    const di = document.getElementById('periodoInicio')?.value;
    const df = document.getElementById('periodoFim')?.value;
    const el = document.getElementById('periodoDuracao');
    if (di && df && el) {
      const dias = Math.round((new Date(df) - new Date(di)) / 86400000);
      const semanas = Math.floor(dias / 7);
      el.textContent = dias > 0 ? `${dias} dias (${semanas} semanas)` : 'Data fim deve ser após início';
    }
  };
  setTimeout(() => {
    document.getElementById('periodoInicio')?.addEventListener('change', calcDuracao);
    document.getElementById('periodoFim')?.addEventListener('change', calcDuracao);
    calcDuracao();
  }, 100);
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

let alimentosRefeicao = [];

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
  alimentosRefeicao = [];
  renderAlimentosRefeicao();
  document.getElementById('buscaAlimento').value = '';
  openModal('modalRefeicao');
}

// ── Busca FatSecret ──
const EDGE_URL = SUPABASE_URL + '/functions/v1/buscar-alimento';
let buscaTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('buscaAlimento');
  const resultados = document.getElementById('buscaResultados');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(buscaTimeout);
    const q = input.value.trim();
    if (q.length < 2) { resultados.style.display = 'none'; return; }

    buscaTimeout = setTimeout(async () => {
      resultados.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:.85rem">Buscando...</div>';
      resultados.style.display = 'block';

      try {
        const resp = await fetch(EDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ q })
        });
        const dados = await resp.json();

        if (!dados.length) {
          resultados.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:.85rem">Nenhum resultado</div>';
          return;
        }

        resultados.innerHTML = dados.map((a, i) => `
          <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s"
               onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''"
               onclick='selecionarAlimento(${JSON.stringify(a).replace(/'/g, "&#39;")})'>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:.9rem">${esc(a.nome)}</span>
              <span style="font-size:.8rem;color:var(--primary);font-weight:700">${a.kcal} kcal</span>
            </div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">
              ${a.porcao} · P: ${a.proteina}g · C: ${a.carbo}g · G: ${a.gordura}g
            </div>
          </div>
        `).join('');
      } catch (e) {
        resultados.innerHTML = '<div style="padding:12px;color:var(--danger);font-size:.85rem">Erro na busca</div>';
      }
    }, 400);
  });

  // Fechar resultados ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#buscaAlimento') && !e.target.closest('#buscaResultados')) {
      resultados.style.display = 'none';
    }
  });
});

function selecionarAlimento(alimento) {
  alimentosRefeicao.push({ ...alimento, qtd: 1 });
  renderAlimentosRefeicao();
  recalcularTotais();
  document.getElementById('buscaAlimento').value = '';
  document.getElementById('buscaResultados').style.display = 'none';
}

function removerAlimentoRef(idx) {
  alimentosRefeicao.splice(idx, 1);
  renderAlimentosRefeicao();
  recalcularTotais();
}

function atualizarQtdAlimento(idx, qtd) {
  alimentosRefeicao[idx].qtd = qtd;
  recalcularTotais();
}

function renderAlimentosRefeicao() {
  const container = document.getElementById('alimentosAdicionados');
  if (!alimentosRefeicao.length) { container.innerHTML = ''; return; }

  container.innerHTML = alimentosRefeicao.map((a, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-card-hover);border-radius:var(--radius-sm);margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:.85rem;font-weight:500">${esc(a.nome)}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${a.porcao} · ${a.kcal} kcal · P:${a.proteina}g C:${a.carbo}g G:${a.gordura}g</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <label style="font-size:.7rem;color:var(--text-muted)">×</label>
        <input type="number" value="${a.qtd}" min="0.5" step="0.5" style="width:50px;padding:4px 6px;font-size:.8rem;text-align:center;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);color:var(--text)"
               onchange="atualizarQtdAlimento(${i}, +this.value)">
      </div>
      <button onclick="removerAlimentoRef(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px">
        <i data-lucide="x" style="width:14px;height:14px"></i>
      </button>
    </div>
  `).join('');
  lucide.createIcons();
}

function recalcularTotais() {
  let kcal = 0, prot = 0, carb = 0, gord = 0;
  alimentosRefeicao.forEach(a => {
    kcal += a.kcal * a.qtd;
    prot += a.proteina * a.qtd;
    carb += a.carbo * a.qtd;
    gord += a.gordura * a.qtd;
  });
  document.getElementById('refKcal').value = Math.round(kcal);
  document.getElementById('refProt').value = Math.round(prot);
  document.getElementById('refCarb').value = Math.round(carb);
  document.getElementById('refGord').value = Math.round(gord);
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

async function limparDieta() {
  if (!alunoSelecionado?.id) return;
  if (!confirm('Apagar o plano alimentar desse aluno?')) return;
  await supabase.from('planos_dieta').delete().eq('aluno_id', alunoSelecionado.id);
  planoAtivo = null;
  showToast('Dieta apagada');
  await carregarPlano();
}

async function enviarConviteAluno() {
  if (!alunoSelecionado?.id) return;
  const { data: al } = await supabase.from('alunos').select('nome, telefone, convite_token').eq('id', alunoSelecionado.id).single();
  if (!al?.convite_token) { showToast('Token não encontrado', 'error'); return; }

  const shortCode = al.convite_token.split('-')[0];
  const link = window.location.origin + '/c/' + shortCode;
  const personal = window.currentPersonal;
  const nomePersonal = (window.currentUser?.nome || '').split(' ')[0] || 'seu personal';
  const primeiroNome = (al.nome || '').split(' ')[0];
  const abertura = personal?.msg_convite_abertura || ('Fala ' + primeiroNome + '! Aqui é o ' + nomePersonal + ', seu personal.');
  const fechamento = personal?.msg_convite_fechamento || ('Qualquer dúvida me chama aqui. Bora! - ' + nomePersonal);
  const msg = [abertura, '', 'Seu treino e dieta estão prontos! No app você vai ver tudo organizado: treino do dia, séries, carga, dieta com checklist e sua evolução.', '', 'Cria sua senha aqui pra acessar (é rapidinho):', link, '', fechamento].join('\n');

  if (al.telefone) {
    const num = al.telefone.replace(/\D/g, '');
    const fone = num.startsWith('55') ? num : '55' + num;
    window.open('https://wa.me/' + fone + '?text=' + encodeURIComponent(msg), '_blank');
  } else {
    try { navigator.clipboard.writeText(msg); } catch(e) {}
    showToast('Link copiado! Cole no WhatsApp do aluno.');
  }
  document.getElementById('bannerConvite')?.remove();
}

// ── Avisar aluno de atualização (dieta/treino) ──
async function avisarAlunoAtualizacao(tipo) {
  if (!alunoSelecionado?.id) return;
  const { data: al } = await supabase.from('alunos').select('nome, telefone').eq('id', alunoSelecionado.id).single();
  if (!al) return;

  const personal = window.currentPersonal;
  const nomePersonal = (window.currentUser?.nome || '').split(' ')[0] || 'seu personal';
  const primeiroNome = (al.nome || '').split(' ')[0];
  const link = 'https://loadpro.com.br/aluno/dashboard.html';

  const tipoTexto = tipo === 'dieta' ? 'plano alimentar' : 'treino';
  const msg = [
    `Fala ${primeiroNome}! Aqui é o ${nomePersonal}.`,
    '',
    `Atualizei seu ${tipoTexto} no app! Entra lá pra conferir as mudanças.`,
    '',
    link,
    '',
    `Qualquer dúvida me chama aqui. Bora! 💪`
  ].join('\n');

  if (al.telefone) {
    const num = al.telefone.replace(/\D/g, '');
    const fone = num.startsWith('55') ? num : '55' + num;
    window.open('https://wa.me/' + fone + '?text=' + encodeURIComponent(msg), '_blank');
  } else {
    try { await navigator.clipboard.writeText(msg); } catch(e) {}
    showToast('Mensagem copiada! Cole no WhatsApp do aluno.');
  }
  document.getElementById('bannerConvite')?.remove();
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

  const idade = alunoSelecionado.data_nascimento ? calcIdade(alunoSelecionado.data_nascimento) : 25;

  const { data, error } = await supabase.rpc('aplicar_template_dieta', {
    p_aluno_id: alunoSelecionado.id,
    p_personal_id: window.currentPersonal.id,
    p_objetivo: objetivo,
    p_fator: fator,
    p_peso: peso,
    p_altura: altura,
    p_sexo: alunoSelecionado.sexo || 'masculino',
    p_idade: idade
  });

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  if (data?.error) { showToast(data.error, 'warning'); return; }

  showToast('Dieta montada! ' + data.meta_kcal + ' kcal/dia');
  await carregarPlano();

  // Banner: confere e envia convite quando quiser
  const old = document.getElementById('bannerConvite');
  if (old) old.remove();

  // Verificar se aluno já tem acesso ou precisa de convite
  const { data: alunoConvite } = await supabase.from('alunos').select('convite_token, user_id, telefone').eq('id', alunoSelecionado.id).single();
  const jaTemAcesso = !!alunoConvite?.user_id;
  const temToken = !!alunoConvite?.convite_token;

  const banner = document.createElement('div');
  banner.id = 'bannerConvite';
  banner.style.cssText = 'position:sticky;top:0;z-index:50;background:var(--success);color:#fff;padding:14px 20px;border-radius:var(--radius);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
  banner.innerHTML = `
    <span style="font-weight:600">${jaTemAcesso ? 'Dieta atualizada!' : 'Dieta pronta! Confira abaixo e quando estiver ok:'}</span>
    <div style="display:flex;gap:8px">
      <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff" onclick="document.getElementById('bannerConvite').remove()">Ficar aqui</button>
      ${jaTemAcesso
        ? `<button class="btn btn-sm" style="background:#fff;color:var(--success);font-weight:700" onclick="avisarAlunoAtualizacao('dieta')">Avisar aluno via WhatsApp →</button>`
        : temToken
          ? `<button class="btn btn-sm" style="background:#fff;color:var(--success);font-weight:700" onclick="enviarConviteAluno()">Enviar convite WhatsApp →</button>`
          : ''
      }
    </div>`;
  const container = document.getElementById('planoContainer');
  container.parentNode.insertBefore(banner, container);
}
