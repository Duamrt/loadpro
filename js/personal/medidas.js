// LoadPro — Medidas e Avaliação Física

let medidasAluno = [];
let charts = {};

document.addEventListener('auth-ready', async () => {
  const personal = window.currentPersonal;

  // Data default
  document.getElementById('mData').value = new Date().toISOString().split('T')[0];

  // Auto-calcular IMC
  const pesoInput = document.getElementById('mPeso');
  const alturaInput = document.getElementById('mAltura');
  [pesoInput, alturaInput].forEach(inp => inp.addEventListener('input', () => {
    const imc = calcIMC(+pesoInput.value, +alturaInput.value);
    document.getElementById('mIMC').value = imc ? `${imc} — ${classificarIMC(imc)}` : '';
  }));

  // Carregar alunos
  const { data: alunos } = await supabase
    .from('alunos').select('id, nome')
    .eq('personal_id', personal.id)
    .eq('status', 'ativo')
    .order('nome');

  const select = document.getElementById('seletorAluno');
  (alunos || []).forEach(a => {
    select.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
  });

  select.addEventListener('change', carregarMedidas);
  document.getElementById('seletorCirc').addEventListener('change', () => renderCharts());

  const params = new URLSearchParams(location.search);
  if (params.get('aluno')) { select.value = params.get('aluno'); carregarMedidas(); }
});

async function carregarMedidas() {
  const alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) return;

  const { data } = await supabase
    .from('medidas')
    .select('*')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false });

  medidasAluno = data || [];

  // Preencher altura da última avaliação
  if (medidasAluno.length && medidasAluno[0].altura_cm) {
    document.getElementById('mAltura').value = medidasAluno[0].altura_cm;
  }

  renderTimeline();
  renderCharts();
}

function renderTimeline() {
  const container = document.getElementById('timelineContainer');

  if (!medidasAluno.length) {
    container.innerHTML = '<div class="empty-state"><i data-lucide="ruler"></i><h3>Nenhuma avaliação</h3><p>Registre a primeira avaliação física deste aluno.</p></div>';
    lucide.createIcons();
    return;
  }

  container.innerHTML = medidasAluno.map((m, i) => {
    const anterior = medidasAluno[i + 1];
    const diffPeso = anterior && m.peso_kg && anterior.peso_kg ? +(m.peso_kg - anterior.peso_kg).toFixed(1) : null;
    const diffGord = anterior && m.gordura_pct && anterior.gordura_pct ? +(m.gordura_pct - anterior.gordura_pct).toFixed(1) : null;

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-weight:600">${formatDate(m.data)}</div>
            <div style="display:flex;gap:16px;margin-top:8px;font-size:.9rem">
              ${m.peso_kg ? `<span>Peso: <strong>${m.peso_kg}kg</strong> ${diffPeso !== null ? `<span style="color:${diffPeso <= 0 ? 'var(--success)' : 'var(--danger)'}">(${diffPeso > 0 ? '+' : ''}${diffPeso}kg)</span>` : ''}</span>` : ''}
              ${m.gordura_pct ? `<span>Gordura: <strong>${m.gordura_pct}%</strong> ${diffGord !== null ? `<span style="color:${diffGord <= 0 ? 'var(--success)' : 'var(--danger)'}">(${diffGord > 0 ? '+' : ''}${diffGord}%)</span>` : ''}</span>` : ''}
              ${m.imc ? `<span>IMC: <strong>${m.imc}</strong> (${classificarIMC(m.imc)})</span>` : ''}
            </div>
          </div>
          ${m.massa_muscular_kg ? `<span class="badge badge-primary">${m.massa_muscular_kg}kg músculo</span>` : ''}
        </div>
        ${m.observacoes ? `<div style="margin-top:8px;font-size:.85rem;color:var(--text-muted);font-style:italic">${m.observacoes}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderCharts() {
  if (!medidasAluno.length) return;
  document.getElementById('chartsContainer').style.display = 'grid';

  const sorted = [...medidasAluno].reverse();
  const labels = sorted.map(m => formatDate(m.data));

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: '#71717a' }, grid: { color: '#2a2a2a' } }
    }
  };

  // Destroy existing
  Object.values(charts).forEach(c => c.destroy());

  charts.peso = new Chart(document.getElementById('chartPeso'), {
    type: 'line', data: { labels, datasets: [{ data: sorted.map(m => m.peso_kg), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: .3, pointRadius: 4 }] }, options: chartOpts
  });

  charts.gordura = new Chart(document.getElementById('chartGordura'), {
    type: 'line', data: { labels, datasets: [{ data: sorted.map(m => m.gordura_pct), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: .3, pointRadius: 4 }] }, options: chartOpts
  });

  charts.imc = new Chart(document.getElementById('chartIMC'), {
    type: 'line', data: { labels, datasets: [{ data: sorted.map(m => m.imc), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: .3, pointRadius: 4 }] }, options: chartOpts
  });

  // Circunferência selecionada
  const campo = document.getElementById('seletorCirc').value;
  charts.circ = new Chart(document.getElementById('chartCirc'), {
    type: 'line', data: { labels, datasets: [{ data: sorted.map(m => m[campo]), borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', fill: true, tension: .3, pointRadius: 4 }] }, options: chartOpts
  });
}

async function salvarMedida() {
  const alunoId = document.getElementById('seletorAluno').value;
  if (!alunoId) { showToast('Selecione um aluno', 'error'); return; }

  const peso = +document.getElementById('mPeso').value || null;
  const altura = +document.getElementById('mAltura').value || null;
  const imc = calcIMC(peso, altura);

  const dados = {
    aluno_id: alunoId,
    registrado_por: window.currentUser.id,
    data: document.getElementById('mData').value,
    peso_kg: peso,
    altura_cm: altura,
    gordura_pct: +document.getElementById('mGordura').value || null,
    massa_muscular_kg: +document.getElementById('mMassa').value || null,
    imc,
    pescoco_cm: +document.getElementById('mPescoco').value || null,
    ombro_cm: +document.getElementById('mOmbro').value || null,
    peitoral_cm: +document.getElementById('mPeitoral').value || null,
    cintura_cm: +document.getElementById('mCintura').value || null,
    abdomen_cm: +document.getElementById('mAbdomen').value || null,
    quadril_cm: +document.getElementById('mQuadril').value || null,
    coxa_d_cm: +document.getElementById('mCoxaD').value || null,
    coxa_e_cm: +document.getElementById('mCoxaE').value || null,
    panturrilha_d_cm: +document.getElementById('mPantD').value || null,
    panturrilha_e_cm: +document.getElementById('mPantE').value || null,
    biceps_d_cm: +document.getElementById('mBicepsD').value || null,
    biceps_e_cm: +document.getElementById('mBicepsE').value || null,
    observacoes: document.getElementById('mObs').value.trim() || null
  };

  const { error } = await supabase.from('medidas').insert(dados);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  closeModal('modalMedida');
  showToast('Avaliação registrada!');
  await carregarMedidas();
}
