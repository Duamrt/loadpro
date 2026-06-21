// LoadPro — Peso. Lê lp_settings/lp_body_logs, renderiza Dashboard/Evolução e salva peso do dia.
// Não filtra user_id nos selects: RLS auth.uid() = user_id isola os dados.
(function () {
  var state = { settings: null, logs: [], loaded: false, bound: false };
  var saving = false, pendingSave = null;

  function todayLocal() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function n1(v) {
    var num = Number(v);
    if (!Number.isFinite(num)) return '—';
    return (Math.round(num * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function dateLabel(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setBar(id, pct) {
    var el = document.getElementById(id);
    if (el) el.style.setProperty('--w', Math.max(0, Math.min(100, pct)) + '%');
  }

  function setPath(id, d) {
    var el = document.getElementById(id);
    if (el) el.setAttribute('d', d || '');
  }

  function parseWeight(raw) {
    var value = Number(String(raw || '').trim().replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  }

  function sortedLogs() {
    return state.logs.slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
  }

  function currentLog() {
    var logs = sortedLogs();
    return logs.length ? logs[logs.length - 1] : null;
  }

  function minWeight(logs) {
    var min = null;
    for (var i = 0; i < logs.length; i++) {
      var w = Number(logs[i].weight_kg);
      if (Number.isFinite(w)) min = min === null ? w : Math.min(min, w);
    }
    return min;
  }

  function buildChart(logs) {
    var width = 520, height = 168, pad = 16;
    var points = [];
    for (var i = 0; i < logs.length; i++) {
      var w = Number(logs[i].weight_kg);
      if (Number.isFinite(w)) points.push({ weight: w });
    }
    if (!points.length) return { line: '', area: '', ghost: '' };

    var min = points[0].weight, max = points[0].weight;
    for (i = 1; i < points.length; i++) {
      min = Math.min(min, points[i].weight);
      max = Math.max(max, points[i].weight);
    }
    if (min === max) { min -= 1; max += 1; }

    var coords = points.map(function (p, idx) {
      var x = points.length === 1 ? width / 2 : (idx / (points.length - 1)) * width;
      var y = pad + ((max - p.weight) / (max - min)) * (height - pad * 2);
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    });

    if (coords.length === 1) {
      var y = coords[0].y;
      var single = 'M0 ' + y + ' L' + width + ' ' + y;
      return {
        line: single,
        area: single + ' L' + width + ' ' + height + ' L0 ' + height + ' Z',
        ghost: single
      };
    }

    var line = 'M' + coords[0].x + ' ' + coords[0].y;
    for (i = 1; i < coords.length; i++) line += ' L' + coords[i].x + ' ' + coords[i].y;
    var area = line + ' L' + width + ' ' + height + ' L0 ' + height + ' Z';
    return { line: line, area: area, ghost: line };
  }

  function renderAll() {
    var logs = sortedLogs();
    var current = currentLog();
    var settings = state.settings || {};
    var start = Number(settings.start_weight_kg);
    var goal = Number(settings.goal_weight_kg);
    var currentWeight = current ? Number(current.weight_kg) : NaN;
    var left = Number.isFinite(currentWeight) && Number.isFinite(goal) ? Math.max(0, currentWeight - goal) : NaN;
    var progress = 0;
    if (Number.isFinite(start) && Number.isFinite(goal) && Number.isFinite(currentWeight) && start !== goal) {
      progress = ((start - currentWeight) / (start - goal)) * 100;
    }
    var min = minWeight(logs);
    var chart = buildChart(logs);

    setText('weight-status', n1(currentWeight) + ' kg');
    setText('weight-goal-status', n1(goal) + ' kg');
    setText('weight-current-date', current ? dateLabel(current.date) : 'sem registro');
    setText('weight-current', n1(currentWeight));
    setText('weight-goal', n1(goal));
    setText('weight-left', n1(left));
    setText('weight-today', current && current.date === todayLocal() ? n1(current.weight_kg) : '—');
    setBar('weight-progress', progress);

    setPath('weight-chart-ghost', chart.ghost);
    setPath('weight-chart-area', chart.area);
    setPath('weight-chart-line', chart.line);
    setPath('weight-progress-area', chart.area);
    setPath('weight-progress-line', chart.line);

    setText('weight-start-dial', n1(start));
    setText('weight-min-dial', n1(min));
    setText('weight-current-dial', n1(currentWeight));
    setText('weight-goal-dial', n1(goal));
  }

  async function load() {
    if (!window.LP.user) return false;
    try {
      var settingsRes = await window.LP.sb.from('lp_settings')
        .select('start_weight_kg,goal_weight_kg,height_cm,birth_date,sex,activity_factor')
        .maybeSingle();
      if (settingsRes.error) throw settingsRes.error;

      var logsRes = await window.LP.sb.from('lp_body_logs')
        .select('date,weight_kg,waist_cm,notes,created_at')
        .order('date', { ascending: true });
      if (logsRes.error) throw logsRes.error;

      state.settings = settingsRes.data || {};
      state.logs = logsRes.data || [];
      state.loaded = true;
      renderAll();
      return true;
    } catch (err) {
      state.loaded = false;
      setText('weight-message', 'Erro ao carregar peso. Tente atualizar.');
      console.warn('LoadPro/peso: erro ao carregar', err);
      return false;
    }
  }

  function mergeToday(weight) {
    var date = todayLocal();
    var found = false;
    for (var i = 0; i < state.logs.length; i++) {
      if (state.logs[i].date === date) {
        state.logs[i].weight_kg = weight;
        found = true;
        break;
      }
    }
    if (!found) state.logs.push({ date: date, weight_kg: weight });
  }

  async function flushSave(weight) {
    if (saving) { pendingSave = weight; return; }
    saving = true;
    setSaving(true);
    var ok = true;
    try {
      var res = await window.LP.sb.from('lp_body_logs').upsert({
        user_id: window.LP.user.id,
        date: todayLocal(),
        weight_kg: weight
      }, { onConflict: 'user_id,date' });
      if (res.error) throw res.error;
    } catch (err) {
      ok = false;
      console.warn('LoadPro/peso: erro ao salvar', err);
    }
    saving = false;
    setSaving(false);
    if (pendingSave !== null) {
      var next = pendingSave;
      pendingSave = null;
      return flushSave(next);
    }
    if (!ok) {
      setText('weight-message', 'Não foi possível salvar. Recarreguei o peso real.');
      await load();
      return;
    }
    setText('weight-message', 'Peso registrado.');
  }

  function setSaving(isSaving) {
    var btn = document.querySelector('#weight-form button[type="submit"]');
    if (btn) {
      btn.disabled = isSaving;
      btn.textContent = isSaving ? 'Salvando...' : 'Registrar medida';
    }
  }

  async function save(raw) {
    if (!window.LP.user) return;
    var weight = parseWeight(raw);
    if (weight === null) {
      setText('weight-message', 'Informe um peso válido em kg.');
      return;
    }
    if (!state.loaded) {
      var ok = await load();
      if (!ok) return;
    }
    setText('weight-message', '');
    mergeToday(weight);
    renderAll();
    flushSave(weight);
  }

  function bind() {
    if (state.bound) return;
    var form = document.getElementById('weight-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = document.getElementById('weight-input');
        save(input ? input.value : '');
      });
    }
    state.bound = true;
  }

  window.LP = window.LP || {};
  window.LP.weight = { start: function () { bind(); load(); } };
})();
