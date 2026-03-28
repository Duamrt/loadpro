// LoadPro — Avaliacoes Fisicas Completas
// Dobras cutaneas (JP7, JP3), Navy, Bioimpedancia, IMC, RCQ, TMB

let avaliacoesAluno = [];
let avalCharts = {};
let avalAnterior = null; // ultima avaliacao para comparacao
let editandoId = null;
let alunoSexo = 'masculino';
let alunoNascimento = null;
let currentStep = 1;
const TOTAL_STEPS = 6;

// ═══ FORMULAS DE COMPOSICAO CORPORAL ═══

// Jackson & Pollock 7 dobras → Densidade → Siri (% gordura)
function calcJP7(dobras, idade, sexo) {
  const soma = (dobras.triceps || 0) + (dobras.peitoral || 0) + (dobras.axilar_media || 0) +
               (dobras.subescapular || 0) + (dobras.abdominal || 0) + (dobras.suprailiaca || 0) + (dobras.coxa || 0);
  if (soma <= 0) return null;
  var dc;
  if (sexo === 'masculino') {
    dc = 1.112 - 0.00043499 * soma + 0.00000055 * soma * soma - 0.00028826 * idade;
  } else {
    dc = 1.097 - 0.00046971 * soma + 0.00000056 * soma * soma - 0.00012828 * idade;
  }
  return (495 / dc) - 450;
}

// Jackson & Pollock 3 dobras
function calcJP3(dobras, idade, sexo) {
  var soma, dc;
  if (sexo === 'masculino') {
    soma = (dobras.peitoral || 0) + (dobras.abdominal || 0) + (dobras.coxa || 0);
    if (soma <= 0) return null;
    dc = 1.10938 - 0.0008267 * soma + 0.0000016 * soma * soma - 0.0002574 * idade;
  } else {
    soma = (dobras.triceps || 0) + (dobras.suprailiaca || 0) + (dobras.coxa || 0);
    if (soma <= 0) return null;
    dc = 1.0994921 - 0.0009929 * soma + 0.0000023 * soma * soma - 0.0001392 * idade;
  }
  return (495 / dc) - 450;
}

// Navy Method (sem adipometro)
function calcNavy(circ, alturaCm, sexo) {
  if (sexo === 'masculino') {
    if (!circ.cintura || !circ.pescoco || !alturaCm) return null;
    return 86.010 * Math.log10(circ.cintura - circ.pescoco) - 70.041 * Math.log10(alturaCm) + 36.76;
  } else {
    if (!circ.cintura || !circ.quadril || !circ.pescoco || !alturaCm) return null;
    return 163.205 * Math.log10(circ.cintura + circ.quadril - circ.pescoco) - 97.684 * Math.log10(alturaCm) + 78.387;
  }
}

// Classificacao % Gordura (ACSM)
function classificaBF(bf, sexo) {
  if (bf == null) return { label: '—', cls: '' };
  if (sexo === 'masculino') {
    if (bf < 6)  return { label: 'Essencial', cls: 'warning' };
    if (bf < 14) return { label: 'Atleta', cls: 'success' };
    if (bf < 18) return { label: 'Fitness', cls: 'success' };
    if (bf < 25) return { label: 'Media', cls: 'warning' };
    return { label: 'Acima da media', cls: 'danger' };
  } else {
    if (bf < 14) return { label: 'Essencial', cls: 'warning' };
    if (bf < 21) return { label: 'Atleta', cls: 'success' };
    if (bf < 25) return { label: 'Fitness', cls: 'success' };
    if (bf < 32) return { label: 'Media', cls: 'warning' };
    return { label: 'Acima da media', cls: 'danger' };
  }
}

// RCQ (Relacao Cintura-Quadril)
function calcRCQ(cintura, quadril) {
  if (!cintura || !quadril) return null;
  return cintura / quadril;
}

function classificaRCQ(rcq, sexo) {
  if (rcq == null) return { label: '—', cls: '' };
  if (sexo === 'masculino') {
    if (rcq < 0.85) return { label: 'Baixo risco', cls: 'success' };
    if (rcq < 0.90) return { label: 'Risco moderado', cls: 'warning' };
    return { label: 'Risco alto', cls: 'danger' };
  } else {
    if (rcq < 0.75) return { label: 'Baixo risco', cls: 'success' };
    if (rcq < 0.80) return { label: 'Risco moderado', cls: 'warning' };
    return { label: 'Risco alto', cls: 'danger' };
  }
}

// Classificacao IMC (com classe CSS)
function classificaIMCFull(imc) {
  if (imc == null) return { label: '—', cls: '' };
  if (imc < 18.5) return { label: 'Abaixo do peso', cls: 'warning' };
  if (imc < 25)   return { label: 'Normal', cls: 'success' };
  if (imc < 30)   return { label: 'Sobrepeso', cls: 'warning' };
  if (imc < 35)   return { label: 'Obesidade I', cls: 'danger' };
  if (imc < 40)   return { label: 'Obesidade II', cls: 'danger' };
  return { label: 'Obesidade III', cls: 'danger' };
}

// ═══ INIT ═══

document.addEventListener('auth-ready', async function() {
  var personal = window.currentPersonal;

  // Carregar alunos
  var resp = await supabase
    .from('alunos').select('id, nome, sexo, data_nascimento')
    .eq('personal_id', personal.id)
    .eq('status', 'ativo')
    .order('nome');

  var alunos = resp.data || [];
  var select = document.getElementById('seletorAluno');
  alunos.forEach(function(a) {
    select.innerHTML += '<option value="' + a.id + '" data-sexo="' + (a.sexo || 'masculino') + '" data-nasc="' + (a.data_nascimento || '') + '">' + esc(a.nome) + '</option>';
  });

  select.addEventListener('change', function() {
    var opt = select.options[select.selectedIndex];
    alunoSexo = opt.dataset.sexo || 'masculino';
    alunoNascimento = opt.dataset.nasc || null;
    carregarAvaliacoes();
  });

  // URL param
  var params = new URLSearchParams(location.search);
  if (params.get('aluno')) {
    select.value = params.get('aluno');
    var opt = select.options[select.selectedIndex];
    if (opt) {
      alunoSexo = opt.dataset.sexo || 'masculino';
      alunoNascimento = opt.dataset.nasc || null;
    }
    await carregarAvaliacoes();
    // Se veio da ficha do aluno, abrir modal de nova avaliação direto
    if (params.get('nova') === '1') {
      novaAvaliacao();
    }
  }

  // Listeners de calculo em tempo real
  setupAutoCalc();
});

// ═══ CARREGAR AVALIACOES ═══

async function carregarAvaliacoes() {
  var alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) return;

  var resp = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false });

  avaliacoesAluno = resp.data || [];
  avalAnterior = avaliacoesAluno.length > 0 ? avaliacoesAluno[0] : null;

  renderTimeline();
  renderAvalCharts();
}

// ═══ TIMELINE ═══

function renderTimeline() {
  var container = document.getElementById('timelineContainer');

  if (!avaliacoesAluno.length) {
    container.innerHTML = '<div class="empty-state"><i data-lucide="clipboard-check"></i><h3>Nenhuma avaliacao</h3><p>Registre a primeira avaliacao fisica deste aluno.</p></div>';
    document.getElementById('chartsContainer').style.display = 'none';
    try { lucide.createIcons(); } catch(e) {}
    return;
  }

  container.innerHTML = avaliacoesAluno.map(function(a, i) {
    var anterior = avaliacoesAluno[i + 1];
    var diffPeso = (anterior && a.peso && anterior.peso) ? +(a.peso - anterior.peso).toFixed(1) : null;
    var diffBF = (anterior && a.bf_percent && anterior.bf_percent) ? +(a.bf_percent - anterior.bf_percent).toFixed(1) : null;
    var imcClass = classificaIMCFull(a.imc);
    var bfClass = classificaBF(a.bf_percent, alunoSexo);
    var tipoLabel = a.tipo === 'rapida' ? '<span class="badge badge-warning" style="font-size:.7rem">Rapida</span>' : '<span class="badge badge-primary" style="font-size:.7rem">Completa</span>';

    return '<div class="card" style="margin-bottom:12px;cursor:pointer" onclick="verAvaliacao(\'' + a.id + '\')">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-weight:600">' + formatDate(a.data) + '</span> ' + tipoLabel +
          '</div>' +
          '<div style="display:flex;gap:16px;margin-top:8px;font-size:.9rem;flex-wrap:wrap">' +
            (a.peso ? '<span>Peso: <strong>' + a.peso + 'kg</strong>' + (diffPeso !== null ? ' <span style="color:' + (diffPeso <= 0 ? 'var(--success)' : 'var(--danger)') + '">(' + (diffPeso > 0 ? '+' : '') + diffPeso + 'kg)</span>' : '') + '</span>' : '') +
            (a.bf_percent ? '<span>BF: <strong>' + (+a.bf_percent).toFixed(1) + '%</strong> <span class="badge badge-' + bfClass.cls + '" style="font-size:.7rem">' + bfClass.label + '</span>' + (diffBF !== null ? ' <span style="color:' + (diffBF <= 0 ? 'var(--success)' : 'var(--danger)') + '">(' + (diffBF > 0 ? '+' : '') + diffBF + '%)</span>' : '') + '</span>' : '') +
            (a.imc ? '<span>IMC: <strong>' + (+a.imc).toFixed(1) + '</strong> <span class="badge badge-' + imcClass.cls + '" style="font-size:.7rem">' + imcClass.label + '</span></span>' : '') +
            (a.tmb ? '<span>TMB: <strong>' + Math.round(a.tmb) + ' kcal</strong></span>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();editarAvaliacao(\'' + a.id + '\')"><i data-lucide="edit-2" style="width:14px;height:14px"></i></button>' +
          '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();excluirAvaliacao(\'' + a.id + '\')"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>' +
        '</div>' +
      '</div>' +
      (a.observacoes ? '<div style="margin-top:8px;font-size:.85rem;color:var(--text-muted);font-style:italic">' + esc(a.observacoes) + '</div>' : '') +
    '</div>';
  }).join('');

  try { lucide.createIcons(); } catch(e) {}
}

// ═══ GRAFICOS ═══

function renderAvalCharts() {
  if (!avaliacoesAluno.length) return;
  document.getElementById('chartsContainer').style.display = 'grid';

  var sorted = avaliacoesAluno.slice().reverse();
  var labels = sorted.map(function(a) { return formatDate(a.data); });

  var chartOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: function(ctx) { return ctx.parsed.y?.toFixed(1); } } }
    },
    scales: {
      x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: '#71717a' }, grid: { color: '#2a2a2a' }, beginAtZero: false }
    }
  };

  Object.values(avalCharts).forEach(function(c) { c.destroy(); });
  avalCharts = {};

  avalCharts.peso = new Chart(document.getElementById('chartPesoAval'), {
    type: 'line',
    data: { labels: labels, datasets: [{ data: sorted.map(function(a) { return a.peso; }), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: .3, pointRadius: 4 }] },
    options: chartOpts
  });

  avalCharts.bf = new Chart(document.getElementById('chartBFAval'), {
    type: 'line',
    data: { labels: labels, datasets: [{ data: sorted.map(function(a) { return a.bf_percent; }), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: .3, pointRadius: 4 }] },
    options: chartOpts
  });

  avalCharts.imc = new Chart(document.getElementById('chartIMCAval'), {
    type: 'line',
    data: { labels: labels, datasets: [{ data: sorted.map(function(a) { return a.imc; }), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: .3, pointRadius: 4 }] },
    options: chartOpts
  });

  // Circunferencia selecionada
  var campoCirc = document.getElementById('seletorCircAval').value;
  avalCharts.circ = new Chart(document.getElementById('chartCircAval'), {
    type: 'line',
    data: { labels: labels, datasets: [{ data: sorted.map(function(a) { var c = a.circunferencias || {}; return c[campoCirc] || null; }), borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', fill: true, tension: .3, pointRadius: 4 }] },
    options: chartOpts
  });
}

// ═══ WIZARD MODAL ═══

function abrirNovaAvaliacao() {
  editandoId = null;
  limparFormulario();
  document.getElementById('avalData').value = new Date().toISOString().split('T')[0];

  // Preencher idade automaticamente
  if (alunoNascimento) {
    document.getElementById('avalIdade').value = calcIdade(alunoNascimento) || '';
  }

  // Preencher altura da ultima avaliacao
  if (avalAnterior && avalAnterior.altura) {
    document.getElementById('avalAltura').value = avalAnterior.altura;
  }

  currentStep = 1;
  renderStep();
  openModal('modalAvaliacao');
}

function limparFormulario() {
  var form = document.getElementById('formAvaliacao');
  if (form) {
    var inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(function(inp) {
      if (inp.type === 'date') return;
      if (inp.tagName === 'SELECT') { inp.selectedIndex = 0; return; }
      inp.value = '';
    });
  }
  // Limpar resultados
  document.getElementById('resultadosContainer').innerHTML = '';
}

function renderStep() {
  // Mostrar/esconder steps
  for (var s = 1; s <= TOTAL_STEPS; s++) {
    var el = document.getElementById('step' + s);
    if (el) el.style.display = s === currentStep ? 'block' : 'none';
  }

  // Progress bar
  var pct = (currentStep / TOTAL_STEPS) * 100;
  document.getElementById('wizardProgress').style.width = pct + '%';
  document.getElementById('wizardStepLabel').textContent = 'Etapa ' + currentStep + ' de ' + TOTAL_STEPS;

  // Botoes
  document.getElementById('btnAnterior').style.display = currentStep > 1 ? 'inline-flex' : 'none';
  document.getElementById('btnProximo').style.display = currentStep < TOTAL_STEPS ? 'inline-flex' : 'none';
  document.getElementById('btnSalvar').style.display = currentStep === TOTAL_STEPS ? 'inline-flex' : 'none';

  // Se chegou nos resultados, calcular tudo
  if (currentStep === 6) {
    calcularResultados();
  }

  // Mostrar valores anteriores nas circunferencias
  if (currentStep === 2 && avalAnterior) {
    mostrarValoresAnteriores();
  }
}

function stepAnterior() {
  if (currentStep > 1) { currentStep--; renderStep(); }
}

function stepProximo() {
  if (currentStep < TOTAL_STEPS) { currentStep++; renderStep(); }
}

// Mostrar valores da ultima avaliacao nos campos
function mostrarValoresAnteriores() {
  if (!avalAnterior) return;
  var circ = avalAnterior.circunferencias || {};
  var hints = document.querySelectorAll('.hint-anterior');
  hints.forEach(function(h) {
    var campo = h.dataset.campo;
    var val = circ[campo];
    if (val) h.textContent = 'Anterior: ' + val + ' cm';
  });

  var dobras = avalAnterior.dobras || {};
  var hintsD = document.querySelectorAll('.hint-anterior-dobra');
  hintsD.forEach(function(h) {
    var campo = h.dataset.campo;
    var val = dobras[campo];
    if (val) h.textContent = 'Anterior: ' + val + ' mm';
  });
}

// ═══ AUTO-CALCULO EM TEMPO REAL ═══

function setupAutoCalc() {
  var pesoInp = document.getElementById('avalPeso');
  var alturaInp = document.getElementById('avalAltura');
  var idadeInp = document.getElementById('avalIdade');

  [pesoInp, alturaInp].forEach(function(inp) {
    if (inp) inp.addEventListener('input', function() {
      var peso = +pesoInp.value;
      var altura = +alturaInp.value;
      var imc = calcIMC(peso, altura);
      var el = document.getElementById('previewIMC');
      if (el) {
        if (imc) {
          var cls = classificaIMCFull(imc);
          el.innerHTML = 'IMC: <strong>' + imc + '</strong> — <span class="badge badge-' + cls.cls + '">' + cls.label + '</span>';
        } else {
          el.innerHTML = '';
        }
      }
    });
  });
}

// ═══ CALCULAR RESULTADOS (Step 6) ═══

function calcularResultados() {
  var peso = +document.getElementById('avalPeso').value || 0;
  var altura = +document.getElementById('avalAltura').value || 0;
  var idade = +document.getElementById('avalIdade').value || 0;
  var sexo = alunoSexo;

  // Dobras
  var dobras = getDobrasFromForm();

  // Circunferencias
  var circ = getCircFromForm();

  // Bioimpedancia
  var bio = getBioFromForm();

  // Calculos
  var imc = calcIMC(peso, altura);
  var rcq = calcRCQ(circ.cintura, circ.quadril);
  var tmb = (peso && altura && idade) ? calcTMB(peso, altura, idade, sexo) : null;
  var jp7 = (idade > 0) ? calcJP7(dobras, idade, sexo) : null;
  var jp3 = (idade > 0) ? calcJP3(dobras, idade, sexo) : null;
  var navy = calcNavy(circ, altura, sexo);
  var bioBF = bio.massa_gorda_pct || null;

  // Selecionar melhor BF disponivel
  var bf = null;
  var bfFormula = null;
  if (jp7 !== null && jp7 > 0 && jp7 < 60) { bf = jp7; bfFormula = 'jp7'; }
  else if (jp3 !== null && jp3 > 0 && jp3 < 60) { bf = jp3; bfFormula = 'jp3'; }
  else if (navy !== null && navy > 0 && navy < 60) { bf = navy; bfFormula = 'navy'; }
  else if (bioBF !== null) { bf = bioBF; bfFormula = 'bio'; }

  var container = document.getElementById('resultadosContainer');
  var imcCls = classificaIMCFull(imc);
  var bfCls = classificaBF(bf, sexo);
  var rcqCls = classificaRCQ(rcq, sexo);

  // Massa magra e gorda
  var massaGorda = (bf && peso) ? +(peso * bf / 100).toFixed(1) : null;
  var massaMagra = (massaGorda && peso) ? +(peso - massaGorda).toFixed(1) : null;

  var html = '<div class="grid grid-2" style="gap:12px">';

  // IMC
  html += '<div class="stat-card">' +
    '<div style="font-size:.8rem;color:var(--text-muted)">IMC</div>' +
    '<div style="font-size:1.8rem;font-weight:800">' + (imc || '—') + '</div>' +
    (imc ? '<span class="badge badge-' + imcCls.cls + '">' + imcCls.label + '</span>' : '') +
  '</div>';

  // % Gordura
  html += '<div class="stat-card">' +
    '<div style="font-size:.8rem;color:var(--text-muted)">% Gordura' + (bfFormula ? ' (' + bfFormula.toUpperCase() + ')' : '') + '</div>' +
    '<div style="font-size:1.8rem;font-weight:800">' + (bf ? (+bf).toFixed(1) + '%' : '—') + '</div>' +
    (bf ? '<span class="badge badge-' + bfCls.cls + '">' + bfCls.label + '</span>' : '') +
  '</div>';

  // RCQ
  html += '<div class="stat-card">' +
    '<div style="font-size:.8rem;color:var(--text-muted)">RCQ</div>' +
    '<div style="font-size:1.8rem;font-weight:800">' + (rcq ? rcq.toFixed(3) : '—') + '</div>' +
    (rcq ? '<span class="badge badge-' + rcqCls.cls + '">' + rcqCls.label + '</span>' : '') +
  '</div>';

  // TMB
  html += '<div class="stat-card">' +
    '<div style="font-size:.8rem;color:var(--text-muted)">TMB (Mifflin)</div>' +
    '<div style="font-size:1.8rem;font-weight:800">' + (tmb ? Math.round(tmb) + ' kcal' : '—') + '</div>' +
  '</div>';

  // Massa magra/gorda
  if (massaGorda) {
    html += '<div class="stat-card">' +
      '<div style="font-size:.8rem;color:var(--text-muted)">Massa Gorda</div>' +
      '<div style="font-size:1.8rem;font-weight:800">' + massaGorda + ' kg</div>' +
    '</div>';
    html += '<div class="stat-card">' +
      '<div style="font-size:.8rem;color:var(--text-muted)">Massa Magra</div>' +
      '<div style="font-size:1.8rem;font-weight:800">' + massaMagra + ' kg</div>' +
    '</div>';
  }

  html += '</div>';

  // Detalhes das formulas
  html += '<div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text-muted)">';
  html += '<strong style="color:var(--text)">Detalhamento:</strong><br>';
  if (jp7 !== null) html += 'JP 7 dobras: ' + (+jp7).toFixed(1) + '%<br>';
  if (jp3 !== null) html += 'JP 3 dobras: ' + (+jp3).toFixed(1) + '%<br>';
  if (navy !== null) html += 'Navy: ' + (+navy).toFixed(1) + '%<br>';
  if (bioBF) html += 'Bioimpedancia: ' + bioBF + '%<br>';
  if (!jp7 && !jp3 && !navy && !bioBF) html += 'Preencha dobras, circunferencias ou bioimpedancia para calcular.<br>';
  html += '</div>';

  // Comparacao com avaliacao anterior
  if (avalAnterior && avalAnterior.id !== editandoId) {
    html += renderComparacao(avalAnterior, { peso: peso, imc: imc, bf_percent: bf, rcq: rcq, tmb: tmb });
  }

  // Metas
  html += '<div style="margin-top:16px">' +
    '<h4 style="margin-bottom:8px">Metas (opcional)</h4>' +
    '<div class="grid grid-2">' +
      '<div class="form-group"><label>Peso meta (kg)</label><input type="number" class="form-control" id="avalPesoMeta" step="0.1" value="' + (editandoId && avaliacoesAluno.find(function(x){return x.id===editandoId;}) ? (avaliacoesAluno.find(function(x){return x.id===editandoId;}).peso_meta || '') : '') + '"></div>' +
      '<div class="form-group"><label>BF% meta</label><input type="number" class="form-control" id="avalBFMeta" step="0.1" value="' + (editandoId && avaliacoesAluno.find(function(x){return x.id===editandoId;}) ? (avaliacoesAluno.find(function(x){return x.id===editandoId;}).bf_meta || '') : '') + '"></div>' +
    '</div>' +
  '</div>';

  container.innerHTML = html;

  // Guardar calculados no form (hidden)
  document.getElementById('calcIMC').value = imc || '';
  document.getElementById('calcRCQ').value = rcq ? rcq.toFixed(3) : '';
  document.getElementById('calcTMB').value = tmb ? Math.round(tmb) : '';
  document.getElementById('calcBF').value = bf ? (+bf).toFixed(1) : '';
  document.getElementById('calcBFFormula').value = bfFormula || '';
}

function renderComparacao(ant, atual) {
  var html = '<div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:var(--radius-sm)">';
  html += '<strong style="font-size:.9rem">Comparacao com ' + formatDate(ant.data) + '</strong>';
  html += '<div class="grid grid-2" style="gap:8px;margin-top:8px;font-size:.85rem">';

  var items = [
    { label: 'Peso', ant: ant.peso, atual: atual.peso, unit: 'kg', invertColor: true },
    { label: 'IMC', ant: ant.imc, atual: atual.imc, unit: '', invertColor: true },
    { label: 'BF%', ant: ant.bf_percent, atual: atual.bf_percent, unit: '%', invertColor: true },
    { label: 'TMB', ant: ant.tmb, atual: atual.tmb, unit: ' kcal', invertColor: false }
  ];

  items.forEach(function(it) {
    if (it.ant == null || it.atual == null) return;
    var diff = +(it.atual - it.ant).toFixed(1);
    var color = diff === 0 ? 'var(--text-muted)' : (it.invertColor ? (diff < 0 ? 'var(--success)' : 'var(--danger)') : (diff > 0 ? 'var(--success)' : 'var(--danger)'));
    html += '<div>' + it.label + ': <strong>' + (+it.atual).toFixed(1) + it.unit + '</strong> <span style="color:' + color + '">(' + (diff > 0 ? '+' : '') + diff + it.unit + ')</span></div>';
  });

  html += '</div></div>';
  return html;
}

// ═══ GETTERS DO FORMULARIO ═══

function getDobrasFromForm() {
  return {
    triceps: +document.getElementById('dTriceps').value || 0,
    peitoral: +document.getElementById('dPeitoral').value || 0,
    axilar_media: +document.getElementById('dAxilar').value || 0,
    subescapular: +document.getElementById('dSubescapular').value || 0,
    abdominal: +document.getElementById('dAbdominal').value || 0,
    suprailiaca: +document.getElementById('dSuprailiaca').value || 0,
    coxa: +document.getElementById('dCoxa').value || 0
  };
}

function getCircFromForm() {
  return {
    pescoco: +document.getElementById('cPescoco').value || 0,
    torax: +document.getElementById('cTorax').value || 0,
    cintura: +document.getElementById('cCintura').value || 0,
    abdomen: +document.getElementById('cAbdomen').value || 0,
    quadril: +document.getElementById('cQuadril').value || 0,
    braco_d: +document.getElementById('cBracoD').value || 0,
    braco_e: +document.getElementById('cBracoE').value || 0,
    antebraco_d: +document.getElementById('cAntebracoD').value || 0,
    antebraco_e: +document.getElementById('cAntebracoE').value || 0,
    coxa_d: +document.getElementById('cCoxaD').value || 0,
    coxa_e: +document.getElementById('cCoxaE').value || 0,
    panturrilha_d: +document.getElementById('cPantD').value || 0,
    panturrilha_e: +document.getElementById('cPantE').value || 0,
    ombro: +document.getElementById('cOmbro').value || 0
  };
}

function getBioFromForm() {
  return {
    massa_muscular_kg: +document.getElementById('bioMassaMuscKg').value || 0,
    massa_muscular_pct: +document.getElementById('bioMassaMuscPct').value || 0,
    massa_gorda_kg: +document.getElementById('bioMassaGordaKg').value || 0,
    massa_gorda_pct: +document.getElementById('bioMassaGordaPct').value || 0,
    massa_ossea_kg: +document.getElementById('bioMassaOssea').value || 0,
    agua_pct: +document.getElementById('bioAgua').value || 0,
    proteina_pct: +document.getElementById('bioProteina').value || 0,
    gordura_visceral: +document.getElementById('bioGordVisceral').value || 0,
    gordura_subcutanea: +document.getElementById('bioGordSubcutanea').value || 0,
    idade_corporal: +document.getElementById('bioIdadeCorporal').value || 0
  };
}

// ═══ SALVAR AVALIACAO ═══

async function salvarAvaliacao() {
  var alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) { showToast('Selecione um aluno', 'error'); return; }

  var peso = +document.getElementById('avalPeso').value || null;
  var altura = +document.getElementById('avalAltura').value || null;
  var idade = +document.getElementById('avalIdade').value || null;
  var tipo = document.getElementById('avalTipo').value;

  var dobras = getDobrasFromForm();
  var circ = getCircFromForm();
  var bio = getBioFromForm();

  // Limpar zeros dos JSONB
  var dobrasClean = {};
  Object.keys(dobras).forEach(function(k) { if (dobras[k]) dobrasClean[k] = dobras[k]; });
  var circClean = {};
  Object.keys(circ).forEach(function(k) { if (circ[k]) circClean[k] = circ[k]; });
  var bioClean = {};
  Object.keys(bio).forEach(function(k) { if (bio[k]) bioClean[k] = bio[k]; });

  var dados = {
    aluno_id: alunoId,
    personal_id: window.currentPersonal.id,
    data: document.getElementById('avalData').value,
    tipo: tipo,
    peso: peso,
    altura: altura,
    idade: idade,
    dobras: dobrasClean,
    circunferencias: circClean,
    bioimpedancia: bioClean,
    imc: +document.getElementById('calcIMC').value || null,
    rcq: +document.getElementById('calcRCQ').value || null,
    tmb: +document.getElementById('calcTMB').value || null,
    bf_percent: +document.getElementById('calcBF').value || null,
    bf_formula: document.getElementById('calcBFFormula').value || null,
    peso_meta: +document.getElementById('avalPesoMeta').value || null,
    bf_meta: +document.getElementById('avalBFMeta').value || null,
    observacoes: document.getElementById('avalObs').value.trim() || null
  };

  var resp;
  if (editandoId) {
    resp = await supabase.from('avaliacoes').update(dados).eq('id', editandoId);
  } else {
    resp = await supabase.from('avaliacoes').insert(dados);
  }

  if (resp.error) { showToast('Erro: ' + resp.error.message, 'error'); return; }

  closeModal('modalAvaliacao');
  showToast(editandoId ? 'Avaliacao atualizada!' : 'Avaliacao registrada!');
  editandoId = null;
  await carregarAvaliacoes();
}

// ═══ EDITAR ═══

function editarAvaliacao(id) {
  var aval = avaliacoesAluno.find(function(a) { return a.id === id; });
  if (!aval) return;

  editandoId = id;
  limparFormulario();

  // Dados basicos
  document.getElementById('avalData').value = aval.data || '';
  document.getElementById('avalTipo').value = aval.tipo || 'completa';
  document.getElementById('avalPeso').value = aval.peso || '';
  document.getElementById('avalAltura').value = aval.altura || '';
  document.getElementById('avalIdade').value = aval.idade || '';

  // Circunferencias
  var circ = aval.circunferencias || {};
  var circMap = { cPescoco:'pescoco', cTorax:'torax', cCintura:'cintura', cAbdomen:'abdomen', cQuadril:'quadril', cBracoD:'braco_d', cBracoE:'braco_e', cAntebracoD:'antebraco_d', cAntebracoE:'antebraco_e', cCoxaD:'coxa_d', cCoxaE:'coxa_e', cPantD:'panturrilha_d', cPantE:'panturrilha_e', cOmbro:'ombro' };
  Object.keys(circMap).forEach(function(elId) {
    var el = document.getElementById(elId);
    if (el) el.value = circ[circMap[elId]] || '';
  });

  // Dobras
  var dobras = aval.dobras || {};
  var dobraMap = { dTriceps:'triceps', dPeitoral:'peitoral', dAxilar:'axilar_media', dSubescapular:'subescapular', dAbdominal:'abdominal', dSuprailiaca:'suprailiaca', dCoxa:'coxa' };
  Object.keys(dobraMap).forEach(function(elId) {
    var el = document.getElementById(elId);
    if (el) el.value = dobras[dobraMap[elId]] || '';
  });

  // Bioimpedancia
  var bio = aval.bioimpedancia || {};
  var bioMap = { bioMassaMuscKg:'massa_muscular_kg', bioMassaMuscPct:'massa_muscular_pct', bioMassaGordaKg:'massa_gorda_kg', bioMassaGordaPct:'massa_gorda_pct', bioMassaOssea:'massa_ossea_kg', bioAgua:'agua_pct', bioProteina:'proteina_pct', bioGordVisceral:'gordura_visceral', bioGordSubcutanea:'gordura_subcutanea', bioIdadeCorporal:'idade_corporal' };
  Object.keys(bioMap).forEach(function(elId) {
    var el = document.getElementById(elId);
    if (el) el.value = bio[bioMap[elId]] || '';
  });

  // Observacoes
  document.getElementById('avalObs').value = aval.observacoes || '';

  currentStep = 1;
  renderStep();
  openModal('modalAvaliacao');
}

// ═══ VER DETALHES ═══

function verAvaliacao(id) {
  var aval = avaliacoesAluno.find(function(a) { return a.id === id; });
  if (!aval) return;

  var circ = aval.circunferencias || {};
  var dobras = aval.dobras || {};
  var bio = aval.bioimpedancia || {};

  var imcCls = classificaIMCFull(aval.imc);
  var bfCls = classificaBF(aval.bf_percent, alunoSexo);
  var rcqCls = classificaRCQ(aval.rcq, alunoSexo);

  var html = '<div style="max-height:70vh;overflow-y:auto">';

  // Resumo
  html += '<div class="grid grid-3" style="gap:12px;margin-bottom:16px">';
  if (aval.peso) html += '<div class="stat-card"><div style="font-size:.75rem;color:var(--text-muted)">Peso</div><div style="font-size:1.5rem;font-weight:800">' + aval.peso + ' kg</div></div>';
  if (aval.imc) html += '<div class="stat-card"><div style="font-size:.75rem;color:var(--text-muted)">IMC</div><div style="font-size:1.5rem;font-weight:800">' + (+aval.imc).toFixed(1) + '</div><span class="badge badge-' + imcCls.cls + '">' + imcCls.label + '</span></div>';
  if (aval.bf_percent) html += '<div class="stat-card"><div style="font-size:.75rem;color:var(--text-muted)">BF% (' + (aval.bf_formula || '').toUpperCase() + ')</div><div style="font-size:1.5rem;font-weight:800">' + (+aval.bf_percent).toFixed(1) + '%</div><span class="badge badge-' + bfCls.cls + '">' + bfCls.label + '</span></div>';
  if (aval.rcq) html += '<div class="stat-card"><div style="font-size:.75rem;color:var(--text-muted)">RCQ</div><div style="font-size:1.5rem;font-weight:800">' + (+aval.rcq).toFixed(3) + '</div><span class="badge badge-' + rcqCls.cls + '">' + rcqCls.label + '</span></div>';
  if (aval.tmb) html += '<div class="stat-card"><div style="font-size:.75rem;color:var(--text-muted)">TMB</div><div style="font-size:1.5rem;font-weight:800">' + Math.round(aval.tmb) + '</div><div style="font-size:.75rem;color:var(--text-muted)">kcal/dia</div></div>';
  html += '</div>';

  // Circunferencias
  var circLabels = { pescoco:'Pescoco', torax:'Torax', cintura:'Cintura', abdomen:'Abdomen', quadril:'Quadril', braco_d:'Braco D', braco_e:'Braco E', antebraco_d:'Antebraco D', antebraco_e:'Antebraco E', coxa_d:'Coxa D', coxa_e:'Coxa E', panturrilha_d:'Panturrilha D', panturrilha_e:'Panturrilha E', ombro:'Ombro' };
  var hasCirc = Object.keys(circ).length > 0;
  if (hasCirc) {
    html += '<h4 style="margin:12px 0 8px">Circunferencias (cm)</h4><div class="grid grid-3" style="gap:8px;font-size:.85rem">';
    Object.keys(circLabels).forEach(function(k) {
      if (circ[k]) html += '<div><span style="color:var(--text-muted)">' + circLabels[k] + ':</span> <strong>' + circ[k] + '</strong></div>';
    });
    html += '</div>';
  }

  // Dobras
  var dobraLabels = { triceps:'Triceps', peitoral:'Peitoral', axilar_media:'Axilar Media', subescapular:'Subescapular', abdominal:'Abdominal', suprailiaca:'Suprailiaca', coxa:'Coxa' };
  var hasDobras = Object.keys(dobras).length > 0;
  if (hasDobras) {
    html += '<h4 style="margin:12px 0 8px">Dobras Cutaneas (mm)</h4><div class="grid grid-3" style="gap:8px;font-size:.85rem">';
    Object.keys(dobraLabels).forEach(function(k) {
      if (dobras[k]) html += '<div><span style="color:var(--text-muted)">' + dobraLabels[k] + ':</span> <strong>' + dobras[k] + '</strong></div>';
    });
    html += '</div>';
  }

  // Bioimpedancia
  var bioLabels = { massa_muscular_kg:'Massa Muscular', massa_muscular_pct:'Massa Muscular %', massa_gorda_kg:'Massa Gorda', massa_gorda_pct:'Massa Gorda %', massa_ossea_kg:'Massa Ossea', agua_pct:'Agua %', proteina_pct:'Proteina %', gordura_visceral:'Gord. Visceral', gordura_subcutanea:'Gord. Subcutanea', idade_corporal:'Idade Corporal' };
  var hasBio = Object.keys(bio).length > 0;
  if (hasBio) {
    html += '<h4 style="margin:12px 0 8px">Bioimpedancia</h4><div class="grid grid-3" style="gap:8px;font-size:.85rem">';
    Object.keys(bioLabels).forEach(function(k) {
      if (bio[k]) {
        var unit = k.includes('pct') ? '%' : (k.includes('kg') ? ' kg' : '');
        html += '<div><span style="color:var(--text-muted)">' + bioLabels[k] + ':</span> <strong>' + bio[k] + unit + '</strong></div>';
      }
    });
    html += '</div>';
  }

  if (aval.observacoes) {
    html += '<div style="margin-top:12px;padding:12px;background:var(--bg);border-radius:var(--radius-sm);font-size:.85rem;font-style:italic;color:var(--text-muted)">' + esc(aval.observacoes) + '</div>';
  }

  html += '</div>';

  document.getElementById('detalheConteudo').innerHTML = html;
  document.getElementById('detalheTitle').textContent = 'Avaliacao — ' + formatDate(aval.data);
  openModal('modalDetalhe');
}

// ═══ EXCLUIR ═══

async function excluirAvaliacao(id) {
  if (!confirm('Excluir esta avaliacao?')) return;
  var resp = await supabase.from('avaliacoes').delete().eq('id', id);
  if (resp.error) { showToast('Erro: ' + resp.error.message, 'error'); return; }
  showToast('Avaliacao excluida');
  await carregarAvaliacoes();
}
