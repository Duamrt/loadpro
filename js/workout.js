// LoadPro — Treino. Planos livres + sessão do dia em Supabase.
// Auto-fill usa exercise_id estável e busca a última sessão anterior do exercício.
(function () {
  var DEFAULT_REST_SECONDS = 100;
  var WEIGHT_INCREMENT_KG = 2.5;
  var BODYWEIGHT_REP_INCREMENT = 2;
  var PLATEAU_SESSION_COUNT = 3;
  var state = {
    plans: [],
    activePlanId: null,
    activeExercise: 0,
    sessionId: null,
    done: [],
    executed: [],
    lastByExercise: {},
    historyByExercise: {},
    exerciseCatalog: [],
    lastSessionPlanId: null,
    lastSessionDate: null,
    editing: false,
    restLeft: 0,
    bound: false,
    loading: false
  };
  var timer = null;
  var writeQueue = Promise.resolve();

  function tempId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayLocal() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function sb() { return window.LP && window.LP.sb; }
  function userId() { return window.LP && window.LP.user && window.LP.user.id; }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setBar(id, pct) {
    var el = document.getElementById(id);
    if (el) el.style.setProperty('--w', Math.max(0, Math.min(100, pct)) + '%');
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function num(value) {
    var n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function defaultPlan() {
    return {
      id: null,
      name: 'A1 Push',
      restSeconds: 100,
      exercises: [
        ex('Supino 45', [['12 x 34kg', 12, 36], ['12 x 36kg', 12, 38], ['10 x 38kg', 10, 38], ['9 x 40kg', 10, 40]]),
        ex('Voador', [['12 x 55kg', 12, 55], ['12 x 60kg', 12, 60], ['10 x 65kg', 10, 65], ['10 x 65kg', 10, 65]]),
        ex('Supino reto', [['12 x 30kg', 12, 32], ['12 x 32kg', 12, 34], ['10 x 34kg', 10, 36], ['9 x 36kg', 10, 36]]),
        ex('Crossover baixa', [['12 x 18kg', 12, 20], ['12 x 20kg', 12, 22], ['10 x 22kg', 10, 22], ['10 x 22kg', 10, 24]]),
        ex('Elevação lateral', [['12 x 10kg', 12, 10], ['12 x 12kg', 12, 12], ['10 x 12kg', 10, 12], ['10 x 12kg', 10, 12]])
      ]
    };
  }

  function ex(name, sets) {
    return {
      tempId: tempId('ex'),
      planExerciseId: null,
      exerciseId: null,
      name: name,
      sets: sets.map(function (s, i) {
        return { id: null, setOrder: i + 1, targetReps: s[1], suggestedWeight: s[2], lastFallback: s[0] };
      })
    };
  }

  function activePlan() {
    for (var i = 0; i < state.plans.length; i++) {
      if (state.plans[i].id === state.activePlanId) return state.plans[i];
    }
    return state.plans[0] || null;
  }

  function activeExercise() {
    var plan = activePlan();
    return plan && plan.exercises[state.activeExercise] ? plan.exercises[state.activeExercise] : null;
  }

  async function loadAll() {
    if (!sb() || !userId() || state.loading) return;
    state.loading = true;
    setText('workout-message', 'Carregando treino...');
    try {
      await loadPlansFromDb();
      if (!state.plans.length) await seedDefaultPlan();
      await loadExerciseCatalog();
      await loadPlanRecency();
      if (!state.activePlanId || !activePlan()) state.activePlanId = state.plans[0] && state.plans[0].id;
      await loadLastSets();
      await loadSession();
      setText('workout-message', '');
    } catch (err) {
      console.warn('LoadPro/treino: erro ao carregar', err);
      setText('workout-message', 'Erro ao carregar treino.');
    } finally {
      state.loading = false;
      renderAll();
    }
  }

  async function loadPlansFromDb() {
    var plansRes = await sb().from('lp_workout_plans')
      .select('id,name,rest_seconds,created_at')
      .order('created_at', { ascending: true });
    if (plansRes.error) throw plansRes.error;

    var plans = (plansRes.data || []).map(function (row) {
      return { id: row.id, name: row.name, restSeconds: row.rest_seconds || DEFAULT_REST_SECONDS, exercises: [] };
    });
    state.plans = plans;
    if (!plans.length) return;

    var planIds = plans.map(function (p) { return p.id; });
    var peRes = await sb().from('lp_workout_plan_exercises')
      .select('id,plan_id,exercise_id,exercise_order')
      .in('plan_id', planIds)
      .order('exercise_order', { ascending: true });
    if (peRes.error) throw peRes.error;

    var planExercises = peRes.data || [];
    var exerciseIds = unique(planExercises.map(function (row) { return row.exercise_id; }).filter(Boolean));
    var exerciseMap = {};
    if (exerciseIds.length) {
      var exRes = await sb().from('lp_exercises')
        .select('id,name,muscle_group')
        .in('id', exerciseIds);
      if (exRes.error) throw exRes.error;
      (exRes.data || []).forEach(function (row) { exerciseMap[row.id] = row; });
    }

    var peIds = planExercises.map(function (row) { return row.id; });
    var setsByPe = {};
    if (peIds.length) {
      var setRes = await sb().from('lp_workout_plan_sets')
        .select('id,plan_exercise_id,set_order,target_reps,suggested_weight')
        .in('plan_exercise_id', peIds)
        .order('set_order', { ascending: true });
      if (setRes.error) throw setRes.error;
      (setRes.data || []).forEach(function (row) {
        if (!setsByPe[row.plan_exercise_id]) setsByPe[row.plan_exercise_id] = [];
        setsByPe[row.plan_exercise_id].push({
          id: row.id,
          setOrder: row.set_order,
          targetReps: row.target_reps,
          suggestedWeight: row.suggested_weight,
          lastFallback: '—'
        });
      });
    }

    var planMap = {};
    plans.forEach(function (p) { planMap[p.id] = p; });
    planExercises.forEach(function (row) {
      var plan = planMap[row.plan_id];
      var exercise = exerciseMap[row.exercise_id] || {};
      if (!plan) return;
      plan.exercises.push({
        tempId: tempId('ex'),
        planExerciseId: row.id,
        exerciseId: row.exercise_id,
        name: exercise.name || 'Exercício',
        sets: setsByPe[row.id] || []
      });
    });
  }

  async function loadExerciseCatalog() {
    var res = await sb().from('lp_exercises')
      .select('id,name,muscle_group')
      .order('name', { ascending: true });
    if (res.error) throw res.error;
    state.exerciseCatalog = res.data || [];
    renderExerciseOptions();
  }

  async function loadPlanRecency() {
    state.lastSessionPlanId = null;
    state.lastSessionDate = null;
    var setsRes = await sb().from('lp_workout_session_sets')
      .select('session_id,done')
      .eq('done', true);
    if (setsRes.error) throw setsRes.error;
    var sessionIds = unique((setsRes.data || []).map(function (row) { return row.session_id; }).filter(Boolean));
    if (!sessionIds.length) return;
    var res = await sb().from('lp_workout_sessions')
      .select('id,plan_id,date,created_at')
      .in('id', sessionIds)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) return;
    state.lastSessionPlanId = res.data.plan_id || null;
    state.lastSessionDate = res.data.date || null;
  }

  async function seedDefaultPlan() {
    var plan = defaultPlan();
    await savePlanToDb(plan);
    await loadPlansFromDb();
    if (state.plans.length) state.activePlanId = state.plans[0].id;
  }

  function unique(arr) {
    var seen = {};
    var out = [];
    arr.forEach(function (value) {
      if (!seen[value]) { seen[value] = true; out.push(value); }
    });
    return out;
  }

  function normalizeName(value) {
    return String(value || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function findExerciseByName(name) {
    var normalized = normalizeName(name);
    if (!normalized) return null;
    for (var i = 0; i < state.exerciseCatalog.length; i++) {
      if (normalizeName(state.exerciseCatalog[i].name) === normalized) return state.exerciseCatalog[i];
    }
    return null;
  }

  function renderExerciseOptions() {
    var list = document.getElementById('workout-exercise-options');
    if (!list) return;
    clear(list);
    state.exerciseCatalog.forEach(function (exercise) {
      var opt = document.createElement('option');
      opt.value = exercise.name;
      if (exercise.muscle_group) opt.label = exercise.muscle_group;
      list.appendChild(opt);
    });
  }

  async function ensureExerciseRecord(exercise) {
    var name = (exercise.name || '').trim() || 'Sem nome';
    if (exercise.exerciseId) {
      var updateRes = await sb().from('lp_exercises')
        .update({ name: name })
        .eq('id', exercise.exerciseId)
        .select('id')
        .single();
      if (updateRes.error) throw updateRes.error;
      return updateRes.data.id;
    }
    var upsertRes = await sb().from('lp_exercises').upsert({
      user_id: userId(),
      name: name
    }, { onConflict: 'user_id,name' }).select('id').single();
    if (upsertRes.error) throw upsertRes.error;
    exercise.exerciseId = upsertRes.data.id;
    return exercise.exerciseId;
  }

  async function savePlanToDb(plan) {
    if (!plan || !userId()) return null;
    var payload = { user_id: userId(), name: (plan.name || 'Sem nome').trim() || 'Sem nome', rest_seconds: plan.restSeconds || DEFAULT_REST_SECONDS };
    var planRes;
    if (plan.id) {
      planRes = await sb().from('lp_workout_plans').update(payload).eq('id', plan.id).select('id,name,rest_seconds').single();
    } else {
      planRes = await sb().from('lp_workout_plans').insert(payload).select('id,name,rest_seconds').single();
    }
    if (planRes.error) throw planRes.error;
    plan.id = planRes.data.id;
    plan.name = planRes.data.name;
    plan.restSeconds = planRes.data.rest_seconds;

    var delRes = await sb().from('lp_workout_plan_exercises').delete().eq('plan_id', plan.id);
    if (delRes.error) throw delRes.error;

    for (var i = 0; i < plan.exercises.length; i++) {
      var exercise = plan.exercises[i];
      var exerciseId = await ensureExerciseRecord(exercise);
      var peRes = await sb().from('lp_workout_plan_exercises').insert({
        user_id: userId(),
        plan_id: plan.id,
        exercise_id: exerciseId,
        exercise_order: i + 1
      }).select('id').single();
      if (peRes.error) throw peRes.error;
      exercise.planExerciseId = peRes.data.id;
      exercise.exerciseId = exerciseId;

      var rows = exercise.sets.map(function (set, setIdx) {
        return {
          user_id: userId(),
          plan_exercise_id: exercise.planExerciseId,
          set_order: setIdx + 1,
          target_reps: num(set.targetReps),
          suggested_weight: num(set.suggestedWeight)
        };
      });
      if (rows.length) {
        var setRes = await sb().from('lp_workout_plan_sets').insert(rows).select('id,set_order');
        if (setRes.error) throw setRes.error;
        (setRes.data || []).forEach(function (row) {
          var set = exercise.sets[row.set_order - 1];
          if (set) set.id = row.id;
        });
      }
    }
    return plan.id;
  }

  async function loadLastSets() {
    state.lastByExercise = {};
    state.historyByExercise = {};
    var exerciseIds = [];
    state.plans.forEach(function (plan) {
      plan.exercises.forEach(function (exercise) {
        if (exercise.exerciseId) exerciseIds.push(exercise.exerciseId);
      });
    });
    exerciseIds = unique(exerciseIds);
    if (!exerciseIds.length) return;

    var setsRes = await sb().from('lp_workout_session_sets')
      .select('session_id,exercise_id,set_order,reps,weight,done')
      .in('exercise_id', exerciseIds)
      .eq('done', true);
    if (setsRes.error) throw setsRes.error;
    var rows = setsRes.data || [];
    if (!rows.length) return;

    var sessionIds = unique(rows.map(function (row) { return row.session_id; }).filter(Boolean));
    if (!sessionIds.length) return;
    var sessionsRes = await sb().from('lp_workout_sessions')
      .select('id,date')
      .in('id', sessionIds)
      .lt('date', todayLocal());
    if (sessionsRes.error) throw sessionsRes.error;

    var sessionDate = {};
    (sessionsRes.data || []).forEach(function (row) { sessionDate[row.id] = row.date; });
    var latestDateByExercise = {};
    rows.forEach(function (row) {
      var date = sessionDate[row.session_id];
      if (!date) return;
      addHistorySet(row, date);
      if (!latestDateByExercise[row.exercise_id] || date > latestDateByExercise[row.exercise_id]) {
        latestDateByExercise[row.exercise_id] = date;
      }
    });
    rows.forEach(function (row) {
      var date = sessionDate[row.session_id];
      if (!date || latestDateByExercise[row.exercise_id] !== date) return;
      if (!state.lastByExercise[row.exercise_id]) state.lastByExercise[row.exercise_id] = {};
      state.lastByExercise[row.exercise_id][row.set_order] = formatSet(row.reps, row.weight);
    });
    sortExerciseHistory();
  }

  function addHistorySet(row, date) {
    if (!state.historyByExercise[row.exercise_id]) state.historyByExercise[row.exercise_id] = [];
    var sessions = state.historyByExercise[row.exercise_id];
    var session = null;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].sessionId === row.session_id) {
        session = sessions[i];
        break;
      }
    }
    if (!session) {
      session = { sessionId: row.session_id, date: date, sets: [] };
      sessions.push(session);
    }
    session.sets.push({
      setOrder: row.set_order,
      reps: row.reps,
      weight: row.weight
    });
  }

  function sortExerciseHistory() {
    Object.keys(state.historyByExercise).forEach(function (exerciseId) {
      state.historyByExercise[exerciseId].sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      });
      state.historyByExercise[exerciseId].forEach(function (session) {
        session.sets.sort(function (a, b) {
          return Number(a.setOrder) - Number(b.setOrder);
        });
      });
    });
  }

  function formatSet(reps, weight) {
    if (reps === null || reps === undefined || weight === null || weight === undefined) return '—';
    return reps + ' x ' + weight + 'kg';
  }

  async function ensureSession() {
    var plan = activePlan();
    if (!plan || !plan.id) return null;
    var res = await sb().from('lp_workout_sessions').upsert({
      user_id: userId(),
      plan_id: plan.id,
      plan_name_snapshot: plan.name,
      date: todayLocal()
    }, { onConflict: 'user_id,plan_id,date' }).select('id').single();
    if (res.error) throw res.error;
    state.sessionId = res.data.id;
    return state.sessionId;
  }

  async function loadSession() {
    state.done = [];
    state.executed = [];
    state.sessionId = null;
    var sessionId = await ensureSession();
    ensureSessionShape();
    if (!sessionId) return;
    var res = await sb().from('lp_workout_session_sets')
      .select('exercise_id,set_order,reps,weight,done')
      .eq('session_id', sessionId);
    if (res.error) throw res.error;
    var plan = activePlan();
    (res.data || []).forEach(function (row) {
      var exIdx = findExerciseIndex(plan, row.exercise_id);
      if (exIdx < 0 || !state.done[exIdx]) return;
      var setIdx = Number(row.set_order) - 1;
      if (setIdx < 0 || setIdx >= state.done[exIdx].length) return;
      state.done[exIdx][setIdx] = !!row.done;
      state.executed[exIdx][setIdx] = { reps: row.reps, weight: row.weight };
    });
  }

  function findExerciseIndex(plan, exerciseId) {
    if (!plan) return -1;
    for (var i = 0; i < plan.exercises.length; i++) {
      if (plan.exercises[i].exerciseId === exerciseId) return i;
    }
    return -1;
  }

  function ensureSessionShape() {
    var plan = activePlan();
    if (!plan) { state.done = []; state.executed = []; return; }
    state.done = plan.exercises.map(function (exercise, exIdx) {
      var existing = state.done[exIdx] || [];
      return exercise.sets.map(function (_, setIdx) { return !!existing[setIdx]; });
    });
    state.executed = plan.exercises.map(function (exercise, exIdx) {
      var existing = state.executed[exIdx] || [];
      return exercise.sets.map(function (set, setIdx) {
        return existing[setIdx] || { reps: set.targetReps, weight: set.suggestedWeight };
      });
    });
    if (state.activeExercise >= plan.exercises.length) state.activeExercise = 0;
  }

  function totalSets() {
    var plan = activePlan();
    if (!plan) return 0;
    return plan.exercises.reduce(function (sum, exercise) { return sum + exercise.sets.length; }, 0);
  }

  function doneSets(exIdx) {
    return (state.done[exIdx] || []).filter(Boolean).length;
  }

  function allDoneSets() {
    return state.done.reduce(function (sum, rows) { return sum + rows.filter(Boolean).length; }, 0);
  }

  function volumeForActive() {
    var plan = activePlan();
    if (!plan || !plan.exercises[state.activeExercise]) return 0;
    var volume = 0;
    var rows = state.executed[state.activeExercise] || [];
    for (var i = 0; i < rows.length; i++) {
      if (state.done[state.activeExercise][i]) volume += Number(rows[i].reps || 0) * Number(rows[i].weight || 0);
    }
    return volume;
  }

  function nextPlan() {
    if (!state.plans.length) return null;
    if (!state.lastSessionPlanId) return state.plans[0];
    for (var i = 0; i < state.plans.length; i++) {
      if (state.plans[i].id === state.lastSessionPlanId) return state.plans[(i + 1) % state.plans.length];
    }
    return state.plans[0];
  }

  function exerciseHistory(exercise) {
    if (!exercise || !exercise.exerciseId) return [];
    return state.historyByExercise[exercise.exerciseId] || [];
  }

  function bestSetForExercise(exercise) {
    var best = null;
    exerciseHistory(exercise).forEach(function (session) {
      session.sets.forEach(function (set) {
        best = betterSet(best, set, session.date);
      });
    });
    if (exercise === activeExercise()) {
      var rows = state.executed[state.activeExercise] || [];
      var done = state.done[state.activeExercise] || [];
      rows.forEach(function (set, idx) {
        if (!done[idx]) return;
        best = betterSet(best, {
          reps: set.reps,
          weight: set.weight,
          setOrder: idx + 1
        }, todayLocal());
      });
    }
    return best;
  }

  function betterSet(best, candidate, date) {
    var weight = Number(candidate.weight);
    var reps = Number(candidate.reps);
    if (!Number.isFinite(weight) || !Number.isFinite(reps)) return best;
    if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) {
      return { weight: weight, reps: reps, date: date, setOrder: candidate.setOrder };
    }
    return best;
  }

  function bestSetLabel(best) {
    if (!best) return 'sem PR';
    return 'PR ' + best.weight + 'kg x ' + best.reps;
  }

  function dateShort(date) {
    var parts = String(date || '').split('-');
    if (parts.length !== 3) return date || '—';
    return parts[2] + '/' + parts[1];
  }

  function sessionSetSummary(session) {
    return session.sets.map(function (set) {
      return formatSet(set.reps, set.weight);
    }).join(' · ');
  }

  function sessionBestSet(session) {
    var best = null;
    session.sets.forEach(function (set) {
      best = betterSet(best, set, session.date);
    });
    return best;
  }

  function progressionSignal(exercise) {
    var history = exerciseHistory(exercise);
    if (!exercise || !history.length) {
      return {
        type: 'learn',
        text: 'Primeira vez: registre e o LoadPro aprende a partir daqui',
        detail: ''
      };
    }

    var latest = sessionStats(exercise, history[0]);
    var previous = history.length > 1 ? sessionStats(exercise, history[1]) : null;
    if (!latest.workedSets.length) {
      return {
        type: 'learn',
        text: 'Primeira vez: registre séries válidas e o LoadPro aprende a partir daqui',
        detail: ''
      };
    }

    var weighted = latest.topWeight > 0;
    var signal;
    var dropped = didDrop(latest, previous);
    if (weighted) {
      if (dropped) {
        signal = {
          type: 'drop',
          text: 'Atenção: queda' + (previous ? ' vs ' + dateShort(previous.date) : '') + ' — rendeu menos que antes',
          detail: latest.hitCount + '/' + latest.total + ' séries no alvo'
        };
      } else if (latest.hitCount === latest.total) {
        signal = {
          type: 'up',
          text: 'Sugestão: subir para ' + n1(latest.topWeight + WEIGHT_INCREMENT_KG) + ' kg — última vez: ' + latest.hitCount + '/' + latest.total + ' séries no alvo',
          detail: 'Carga topo anterior: ' + n1(latest.topWeight) + ' kg'
        };
      } else if (latest.hitCount > 0) {
        signal = {
          type: 'hold',
          text: 'Sugestão: manter ' + n1(latest.topWeight) + ' kg e fechar as reps — última: ' + latest.hitCount + '/' + latest.total + ' no alvo',
          detail: ''
        };
      } else {
        signal = {
          type: 'drop',
          text: 'Atenção: queda — rendeu menos que antes',
          detail: 'Última: 0/' + latest.total + ' séries no alvo'
        };
      }
    } else {
      if (latest.hitCount === latest.total) {
        signal = {
          type: 'up',
          text: 'Sugestão: +' + BODYWEIGHT_REP_INCREMENT + ' reps na próxima — última vez: ' + latest.hitCount + '/' + latest.total + ' séries no alvo',
          detail: 'Topo anterior: ' + n0(latest.topReps) + ' reps'
        };
      } else {
        signal = {
          type: 'hold',
          text: 'Sugestão: manter e fechar as reps — última: ' + latest.hitCount + '/' + latest.total + ' no alvo',
          detail: ''
        };
      }
    }

    var plateau = plateauSignal(exercise, weighted);
    if (plateau) signal.plateau = plateau;
    return signal;
  }

  function sessionStats(exercise, session) {
    var worked = session.sets.filter(function (set) {
      var reps = Number(set.reps);
      var weight = Number(set.weight);
      return Number.isFinite(reps) && reps > 0 || Number.isFinite(weight) && weight > 0;
    });
    var hit = 0;
    var topWeight = 0;
    var topReps = 0;
    worked.forEach(function (set) {
      var target = targetRepsForSet(exercise, set.setOrder);
      var reps = Number(set.reps) || 0;
      var weight = Number(set.weight) || 0;
      if (target && reps >= target) hit++;
      topWeight = Math.max(topWeight, weight);
      topReps = Math.max(topReps, reps);
    });
    return {
      date: session.date,
      workedSets: worked,
      hitCount: hit,
      total: worked.length,
      topWeight: topWeight,
      topReps: topReps
    };
  }

  function targetRepsForSet(exercise, setOrder) {
    if (!exercise || !exercise.sets || !exercise.sets.length) return 0;
    var idx = Math.max(0, Number(setOrder || 1) - 1);
    var set = exercise.sets[idx] || exercise.sets[exercise.sets.length - 1];
    return Number(set && set.targetReps) || 0;
  }

  function didDrop(latest, previous) {
    if (!latest || !latest.total) return false;
    if (previous && latest.topWeight > 0 && previous.topWeight > 0 && latest.topWeight < previous.topWeight) return true;
    return latest.hitCount === 0;
  }

  function plateauSignal(exercise, weighted) {
    var history = exerciseHistory(exercise).slice(0, PLATEAU_SESSION_COUNT);
    if (history.length < PLATEAU_SESSION_COUNT) return null;
    var values = history.map(function (session) {
      var stats = sessionStats(exercise, session);
      return weighted ? stats.topWeight : stats.topReps;
    }).filter(function (value) { return Number(value) > 0; });
    if (values.length < PLATEAU_SESSION_COUNT) return null;
    var newest = values[0];
    var improved = values.some(function (value) { return value > newest; }) || newest > values[values.length - 1];
    if (improved) return null;
    return 'Platô há ' + values.length + ' sessões — variar exercício, reps ou descanso';
  }

  function n0(value) {
    return Math.round(Number(value) || 0).toLocaleString('pt-BR');
  }

  function n1(value) {
    return (Math.round((Number(value) || 0) * 10) / 10).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function fmtTimer(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function checkIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M20 6L9 17l-5-5');
    svg.appendChild(path);
    return svg;
  }

  function appendText(parent, tag, text, className) {
    var el = document.createElement(tag);
    el.textContent = text;
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }

  function renderPlanSelect() {
    var select = document.getElementById('workout-plan-select');
    if (!select) return;
    clear(select);
    state.plans.forEach(function (plan) {
      var opt = document.createElement('option');
      opt.value = plan.id;
      opt.textContent = plan.name;
      opt.selected = plan.id === state.activePlanId;
      select.appendChild(opt);
    });
  }

  function renderExerciseList() {
    var list = document.getElementById('workout-exercise-list');
    var plan = activePlan();
    if (!list || !plan) return;
    clear(list);
    plan.exercises.forEach(function (exercise, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exercise-pill' + (i === state.activeExercise ? ' active' : '') + (doneSets(i) === exercise.sets.length && exercise.sets.length ? ' done' : '');
      btn.dataset.exerciseIndex = String(i);
      appendText(btn, 'span', String(i + 1).padStart(2, '0'), '');
      appendText(btn, 'strong', exercise.name, '');
      appendText(btn, 'span', doneSets(i) + '/' + exercise.sets.length, 'mono');
      list.appendChild(btn);
    });
  }

  function renderSets() {
    var table = document.getElementById('workout-sets-table');
    var exercise = activeExercise();
    if (!table) return;
    clear(table);
    if (!exercise) {
      setText('workout-exercise-title', 'Sem exercício');
      return;
    }
    var head = document.createElement('div');
    head.className = 'set-row head';
    ['S', 'última', 'reps', 'kg', ''].forEach(function (txt) { appendText(head, 'span', txt, ''); });
    table.appendChild(head);
    exercise.sets.forEach(function (set, i) {
      var done = state.done[state.activeExercise] && state.done[state.activeExercise][i];
      var executed = state.executed[state.activeExercise] && state.executed[state.activeExercise][i] || {};
      var row = document.createElement('div');
      row.className = 'set-row' + (done ? ' done' : '');
      appendText(row, 'span', String(i + 1), '');
      appendText(row, 'span', lastLabel(exercise, set), 'quiet');
      row.appendChild(sessionInput(i, 'reps', executed.reps, 'Reps série ' + (i + 1)));
      row.appendChild(sessionInput(i, 'weight', executed.weight, 'Carga série ' + (i + 1)));
      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'check set-confirm';
      check.dataset.setConfirm = String(i);
      check.setAttribute('aria-pressed', done ? 'true' : 'false');
      check.setAttribute('aria-label', 'Confirmar série ' + (i + 1) + ' de ' + exercise.name);
      if (done) check.appendChild(checkIcon());
      row.appendChild(check);
      table.appendChild(row);
    });
  }

  function sessionInput(setIdx, field, value, label) {
    var input = document.createElement('input');
    input.inputMode = 'decimal';
    input.value = value === null || value === undefined ? '' : value;
    input.setAttribute('aria-label', label);
    input.dataset.sessionSet = String(setIdx);
    input.dataset.sessionField = field;
    return input;
  }

  function lastLabel(exercise, set) {
    if (exercise.exerciseId && state.lastByExercise[exercise.exerciseId] && state.lastByExercise[exercise.exerciseId][set.setOrder]) {
      return state.lastByExercise[exercise.exerciseId][set.setOrder];
    }
    return set.lastFallback || '—';
  }

  function renderStats() {
    var plan = activePlan();
    var exercise = activeExercise();
    var suggested = nextPlan();
    var best = bestSetForExercise(exercise);
    var total = totalSets();
    var done = allDoneSets();
    var progress = total ? Math.round((done / total) * 100) : 0;
    setText('workout-status', (plan ? plan.name : 'Treino') + ' · ' + done + '/' + total);
    setText('workout-session-name', plan ? plan.name : '—');
    setText('workout-session-subtitle', exercise ? exercise.name : 'treino');
    setText('workout-current-plan', plan ? plan.name : '—');
    setText('workout-next-plan', suggested ? suggested.name : '—');
    setText('workout-exercise-title', exercise ? exercise.name : 'Sem exercício');
    setText('workout-pr', exercise ? bestSetLabel(best) : 'sem exercício');
    setText('workout-volume', String(volumeForActive()));
    setText('workout-sets-done', exercise ? doneSets(state.activeExercise) + '/' + exercise.sets.length : '0/0');
    setText('workout-progress', progress + '%');
    setText('workout-message', total && done === total ? 'Sessão completa.' : '');
    setText('workout-rest-label', (plan && plan.restSeconds ? plan.restSeconds : DEFAULT_REST_SECONDS) + 's rest');
  }

  function renderHistory() {
    var container = document.getElementById('workout-history');
    var exercise = activeExercise();
    if (!container) return;
    clear(container);
    if (!exercise) return;

    var history = exerciseHistory(exercise);
    var best = bestSetForExercise(exercise);
    var head = document.createElement('div');
    head.className = 'workout-history-head';
    var title = document.createElement('div');
    appendText(title, 'span', 'histórico do exercício', 'cap');
    appendText(title, 'strong', history.length ? 'Última vez: ' + dateShort(history[0].date) : 'Sem sessões anteriores', '');
    head.appendChild(title);
    appendText(head, 'strong', bestSetLabel(best), 'accent');
    container.appendChild(head);
    container.appendChild(progressionCard(progressionSignal(exercise)));

    if (!history.length) {
      appendText(container, 'p', 'O histórico começa depois do primeiro treino salvo no LoadPro.', 'muted');
      return;
    }

    var list = document.createElement('div');
    list.className = 'workout-history-list';
    history.slice(0, 5).forEach(function (session) {
      var row = document.createElement('div');
      row.className = 'workout-history-row';
      appendText(row, 'time', dateShort(session.date), '');
      appendText(row, 'span', sessionSetSummary(session), 'quiet');
      appendText(row, 'strong', bestSetLabel(sessionBestSet(session)).replace('PR ', ''), '');
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  function progressionCard(signal) {
    var card = document.createElement('div');
    card.className = 'workout-progression ' + (signal && signal.type ? 'is-' + signal.type : 'is-learn');
    appendText(card, 'span', 'progressão sugerida', 'cap');
    appendText(card, 'strong', signal && signal.text ? signal.text : 'Primeira vez: registre e o LoadPro aprende a partir daqui', '');
    if (signal && signal.detail) appendText(card, 'small', signal.detail, 'muted');
    if (signal && signal.plateau) appendText(card, 'small', signal.plateau, 'workout-plateau');
    return card;
  }

  function renderTimer() {
    setText('workout-rest-time', fmtTimer(state.restLeft));
    var plan = activePlan();
    var rest = plan && plan.restSeconds ? plan.restSeconds : DEFAULT_REST_SECONDS;
    setBar('workout-rest-bar', rest ? ((rest - state.restLeft) / rest) * 100 : 0);
    var timerBox = document.querySelector('.rest-timer');
    if (timerBox) timerBox.classList.toggle('active', state.restLeft > 0);
  }

  function renderEditor() {
    var panel = document.getElementById('workout-plan-editor');
    var nameInput = document.getElementById('workout-plan-name');
    var list = document.getElementById('workout-editor-exercises');
    var plan = activePlan();
    if (!panel || !list || !plan) return;
    panel.hidden = !state.editing;
    if (nameInput && document.activeElement !== nameInput) nameInput.value = plan.name;
    clear(list);
    if (!state.editing) return;
    plan.exercises.forEach(function (exercise, i) { list.appendChild(editorExercise(exercise, i)); });
  }

  function editorExercise(exercise, exIdx) {
    var wrap = document.createElement('div');
    wrap.className = 'editor-exercise';
    var head = document.createElement('div');
    head.className = 'editor-exercise-head';
    var label = document.createElement('label');
    var cap = document.createElement('span');
    cap.className = 'cap';
    cap.textContent = 'exercício ' + String(exIdx + 1).padStart(2, '0');
    var input = document.createElement('input');
    input.value = exercise.name;
    input.setAttribute('list', 'workout-exercise-options');
    input.autocomplete = 'off';
    input.dataset.editExercise = String(exIdx);
    input.dataset.editField = 'name';
    label.appendChild(cap);
    label.appendChild(input);
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button-ghost';
    remove.dataset.removeExercise = String(exIdx);
    remove.textContent = 'Remover';
    head.appendChild(label);
    head.appendChild(remove);
    wrap.appendChild(head);

    var sets = document.createElement('div');
    sets.className = 'editor-sets';
    exercise.sets.forEach(function (set, i) {
      var row = document.createElement('div');
      row.className = 'editor-set';
      appendText(row, 'span', 'S' + (i + 1), '');
      row.appendChild(setInput(exIdx, i, 'targetReps', set.targetReps, 'reps'));
      row.appendChild(setInput(exIdx, i, 'suggestedWeight', set.suggestedWeight, 'kg'));
      sets.appendChild(row);
    });
    wrap.appendChild(sets);
    return wrap;
  }

  function setInput(exIdx, setIdx, field, value, label) {
    var input = document.createElement('input');
    input.inputMode = 'decimal';
    input.value = value === null || value === undefined ? '' : value;
    input.setAttribute('aria-label', label + ' série ' + (setIdx + 1));
    input.dataset.editExercise = String(exIdx);
    input.dataset.editSet = String(setIdx);
    input.dataset.editField = field;
    return input;
  }

  function renderAll() {
    ensureSessionShape();
    renderExerciseOptions();
    renderPlanSelect();
    renderExerciseList();
    renderSets();
    renderStats();
    renderTimer();
    renderEditor();
    renderHistory();
  }

  function startRest() {
    var plan = activePlan();
    state.restLeft = plan && plan.restSeconds ? plan.restSeconds : DEFAULT_REST_SECONDS;
    renderTimer();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      state.restLeft = Math.max(0, state.restLeft - 1);
      renderTimer();
      if (state.restLeft === 0) {
        clearInterval(timer);
        timer = null;
      }
    }, 1000);
  }

  function enqueueWrite(fn) {
    writeQueue = writeQueue.then(fn).catch(function (err) {
      console.warn('LoadPro/treino: erro ao salvar', err);
      setText('workout-message', 'Erro ao salvar treino.');
    });
    return writeQueue;
  }

  async function persistSet(exIdx, setIdx) {
    var plan = activePlan();
    var exercise = plan && plan.exercises[exIdx];
    var executed = state.executed[exIdx] && state.executed[exIdx][setIdx];
    if (!exercise || !executed) return;
    if (!state.sessionId) await ensureSession();
    var set = exercise.sets[setIdx];
    var res = await sb().from('lp_workout_session_sets').upsert({
      user_id: userId(),
      session_id: state.sessionId,
      exercise_id: exercise.exerciseId,
      exercise_name_snapshot: exercise.name,
      set_order: set.setOrder || setIdx + 1,
      reps: num(executed.reps),
      weight: num(executed.weight),
      done: !!state.done[exIdx][setIdx]
    }, { onConflict: 'session_id,exercise_id,set_order' });
    if (res.error) throw res.error;
  }

  function toggleSet(idx) {
    var exercise = activeExercise();
    if (!state.done[state.activeExercise] || !exercise) return;
    if (!exercise.exerciseId) {
      setText('workout-message', 'Salve o plano antes de registrar séries desse exercício.');
      return;
    }
    state.done[state.activeExercise][idx] = !state.done[state.activeExercise][idx];
    if (state.done[state.activeExercise][idx]) {
      var plan = activePlan();
      if (plan) {
        state.lastSessionPlanId = plan.id;
        state.lastSessionDate = todayLocal();
      }
      startRest();
    }
    var exIdx = state.activeExercise;
    enqueueWrite(function () { return persistSet(exIdx, idx); });
    renderAll();
  }

  function updateSessionInput(input) {
    var setIdx = Number(input.dataset.sessionSet);
    var field = input.dataset.sessionField;
    if (!state.executed[state.activeExercise] || !state.executed[state.activeExercise][setIdx]) return;
    state.executed[state.activeExercise][setIdx][field] = num(input.value);
    renderStats();
    if (state.done[state.activeExercise] && state.done[state.activeExercise][setIdx]) {
      var exIdx = state.activeExercise;
      enqueueWrite(function () { return persistSet(exIdx, setIdx); });
    }
  }

  function resetSession() {
    state.done = [];
    ensureSessionShape();
    state.activeExercise = 0;
    state.restLeft = 0;
    if (timer) clearInterval(timer);
    timer = null;
    var plan = activePlan();
    var sessionId = state.sessionId;
    enqueueWrite(async function () {
      if (sessionId) {
        var res = await sb().from('lp_workout_session_sets').delete().eq('session_id', sessionId);
        if (res.error) throw res.error;
      }
      if (plan) await loadSession();
    });
    renderAll();
  }

  function addExercise() {
    var plan = activePlan();
    if (!plan) return;
    plan.exercises.push(ex('Novo exercício', [['—', 12, 0], ['—', 12, 0], ['—', 10, 0], ['—', 10, 0]]));
    state.activeExercise = plan.exercises.length - 1;
    ensureSessionShape();
    renderAll();
  }

  async function newPlan() {
    var plan = { id: null, name: 'Novo plano', restSeconds: 100, exercises: [] };
    state.plans.push(plan);
    state.activePlanId = null;
    state.activeExercise = 0;
    state.editing = true;
    try {
      await savePlanToDb(plan);
      state.activePlanId = plan.id;
      await loadPlansFromDb();
      await loadExerciseCatalog();
      await loadSession();
    } catch (err) {
      console.warn('LoadPro/treino: erro ao criar plano', err);
      setText('workout-editor-message', 'Erro ao criar plano.');
    }
    renderAll();
  }

  function removeExercise(index) {
    var plan = activePlan();
    if (!plan) return;
    plan.exercises.splice(index, 1);
    if (state.activeExercise >= plan.exercises.length) state.activeExercise = Math.max(0, plan.exercises.length - 1);
    ensureSessionShape();
    renderAll();
  }

  function updatePlanFromInput(input) {
    var plan = activePlan();
    if (!plan) return;
    var exIdx = Number(input.dataset.editExercise);
    var setIdx = input.dataset.editSet === undefined ? null : Number(input.dataset.editSet);
    var field = input.dataset.editField;
    if (!plan.exercises[exIdx]) return;
    if (setIdx === null || Number.isNaN(setIdx)) {
      plan.exercises[exIdx][field] = input.value.trim() || 'Sem nome';
      if (field === 'name') {
        var existing = findExerciseByName(input.value);
        if (existing) plan.exercises[exIdx].exerciseId = existing.id;
      }
    } else if (plan.exercises[exIdx].sets[setIdx]) {
      plan.exercises[exIdx].sets[setIdx][field] = num(input.value);
      ensureSessionShape();
    }
  }

  async function savePlanName() {
    var plan = activePlan();
    var input = document.getElementById('workout-plan-name');
    if (!plan || !input) return;
    plan.name = input.value.trim() || 'Sem nome';
    try {
      await savePlanToDb(plan);
      await loadPlansFromDb();
      await loadExerciseCatalog();
      state.activePlanId = plan.id;
      await loadLastSets();
      await loadSession();
      state.editing = false;
      setText('workout-editor-message', 'Plano salvo.');
    } catch (err) {
      console.warn('LoadPro/treino: erro ao salvar plano', err);
      setText('workout-editor-message', 'Erro ao salvar plano.');
    }
    renderAll();
  }

  async function selectPlan(planId) {
    state.activePlanId = planId;
    state.activeExercise = 0;
    state.editing = false;
    try {
      await loadLastSets();
      await loadSession();
    } catch (err) {
      console.warn('LoadPro/treino: erro ao trocar plano', err);
      setText('workout-message', 'Erro ao trocar plano.');
    }
    renderAll();
  }

  function bind() {
    if (state.bound) return;
    document.addEventListener('click', function (e) {
      var exercise = e.target.closest('[data-exercise-index]');
      if (exercise) {
        state.activeExercise = Number(exercise.dataset.exerciseIndex) || 0;
        renderAll();
        return;
      }
      var set = e.target.closest('[data-set-confirm]');
      if (set) {
        toggleSet(Number(set.dataset.setConfirm) || 0);
        return;
      }
      if (e.target.closest('#workout-reset')) resetSession();
      if (e.target.closest('#workout-new-plan')) newPlan();
      if (e.target.closest('#workout-edit-plan')) {
        state.editing = !state.editing;
        renderAll();
      }
      if (e.target.closest('#workout-add-exercise')) addExercise();
      if (e.target.closest('#workout-save-plan')) savePlanName();
      var remove = e.target.closest('[data-remove-exercise]');
      if (remove) removeExercise(Number(remove.dataset.removeExercise));
    });
    document.addEventListener('change', function (e) {
      if (e.target.id === 'workout-plan-select') selectPlan(e.target.value);
    });
    document.addEventListener('input', function (e) {
      if (e.target.id === 'workout-plan-name') {
        var plan = activePlan();
        if (plan) plan.name = e.target.value;
        return;
      }
      if (e.target.dataset.sessionSet !== undefined) {
        updateSessionInput(e.target);
        return;
      }
      if (e.target.dataset.editExercise !== undefined) updatePlanFromInput(e.target);
    });
    state.bound = true;
  }

  window.LP = window.LP || {};
  window.LP.workout = {
    start: function () {
      bind();
      loadAll();
    }
  };
})();
