// LoadPro — Água (hidratação). Registra, desfaz e zera o consumo do dia em lp_hydration_logs.
// Trata erro de rede (load e save) e serializa os cliques pra não dar corrida de valores.
(function () {
  var state = { date: null, consumed: 0, target: 5, previous: null, loaded: false, bound: false };
  var saving = false, pending = false;

  function todayLocal() {
    // data LOCAL (sem new Date(iso), conforme padrão do projeto)
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function n1(v) {
    return (Math.round(v * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  function setText(id, t) { var el = document.getElementById(id); if (el) el.textContent = t; }
  function setBar(id, p) { var el = document.getElementById(id); if (el) el.style.setProperty('--w', p + '%'); }
  function setGauge(id, p) { var el = document.getElementById(id); if (el) el.style.background = 'conic-gradient(var(--accent) 0 ' + p + '%, #0b0b0c ' + p + '% 100%)'; }

  function render() {
    var pct = state.target > 0 ? Math.min(100, (state.consumed / state.target) * 100) : 0;
    var left = Math.max(0, state.target - state.consumed);
    setText('hyd-total', n1(state.consumed) + 'L');
    setBar('hyd-bar', pct);
    setGauge('hyd-gauge', pct);
    setText('hyd-dash-total', n1(state.consumed) + 'L');
    setBar('hyd-dash-bar', pct);
    setGauge('hyd-dash-gauge', pct);
    setText('hyd-dash-left', n1(left));
    setText('hyd-status', n1(state.consumed) + ' / ' + n1(state.target) + ' L');
  }

  // carrega o registro de hoje. Em erro de rede NÃO marca como carregado (evita sobrescrever dado real).
  async function load() {
    state.date = todayLocal();
    var res;
    try {
      res = await window.LP.sb.from('lp_hydration_logs')
        .select('consumed_liters,target_liters')
        .eq('date', state.date).maybeSingle();
    } catch (e) {
      state.loaded = false;
      console.warn('LoadPro/água: erro ao carregar', e);
      return false;
    }
    if (res.error) {
      state.loaded = false;
      console.warn('LoadPro/água: erro ao carregar', res.error.message);
      return false;
    }
    if (res.data) {
      state.consumed = Number(res.data.consumed_liters) || 0;
      state.target = Number(res.data.target_liters) || 5;
    } else {
      state.consumed = 0;
      state.target = 5;
    }
    state.previous = null;
    state.loaded = true;
    render();
    return true;
  }

  // salva o estado atual. Serializado: 1 upsert por vez; se chegou estado novo durante o save, salva de novo.
  async function flush() {
    if (saving) { pending = true; return; }
    saving = true;
    var ok = true;
    try {
      var res = await window.LP.sb.from('lp_hydration_logs').upsert({
        user_id: window.LP.user.id,
        date: state.date,
        consumed_liters: state.consumed,
        target_liters: state.target,
        source: 'manual'
      }, { onConflict: 'user_id,date' });
      if (res.error) { ok = false; console.warn('LoadPro/água: erro ao salvar', res.error.message); }
    } catch (e) {
      ok = false;
      console.warn('LoadPro/água: erro de rede ao salvar', e);
    }
    saving = false;
    if (pending) { pending = false; return flush(); }
    if (!ok) { await load(); } // reverte a tela pro estado real do banco
  }

  async function ensureLoaded() {
    if (state.loaded) return true;
    return load();
  }

  // grava um novo total (nunca negativo), atualiza a tela e persiste
  function commit(value, keepPrevious) {
    if (!keepPrevious) state.previous = state.consumed;
    state.consumed = Math.max(0, Math.round(value * 100) / 100);
    render();
    flush();
  }

  async function add(ml) {
    if (!window.LP.user) return;
    if (!(await ensureLoaded())) return;
    commit(state.consumed + ml / 1000);
  }

  async function undo() {
    if (!window.LP.user) return;
    if (!(await ensureLoaded())) return;
    if (state.previous === null) return; // nada a desfazer nesta sessão
    var previous = state.previous;
    state.previous = null;
    commit(previous, true);
  }

  async function reset() {
    if (!window.LP.user) return;
    if (!(await ensureLoaded())) return;
    commit(0);
  }

  function bind() {
    if (state.bound) return;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.addMl) {
        add(Number(btn.dataset.addMl));
        return;
      }
      if (btn.dataset.action === 'undo') {
        undo();
        return;
      }
      if (btn.dataset.action === 'reset') {
        reset();
      }
    });
    state.bound = true;
  }

  window.LP = window.LP || {};
  window.LP.hydration = { start: function () { bind(); load(); } };
})();
