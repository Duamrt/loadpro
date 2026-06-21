// LoadPro — Dieta. Template alimentar + diario real do dia em Supabase.
// Materializa o template ativo em lp_daily_diet_items e recalcula macros pelo consumo marcado.
(function () {
  var DAILY_DEFICIT_KCAL = 550;
  var state = {
    template: null,
    meals: [],
    items: [],
    foodMap: {},
    foodCatalog: [],
    foodMatches: [],
    dailyLogId: null,
    settings: null,
    latestWeight: null,
    editingTemplate: false,
    bound: false,
    loading: false
  };
  var writeQueue = Promise.resolve();

  function sb() { return window.LP && window.LP.sb; }
  function userId() { return window.LP && window.LP.user && window.LP.user.id; }

  function todayLocal() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function num(value) {
    var raw = String(value === null || value === undefined ? '' : value).trim();
    if (!raw) return null;
    var n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
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

  function appendText(parent, tag, text, className) {
    var el = document.createElement(tag);
    el.textContent = text;
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }

  function dateLabel(date) {
    var parts = String(date || todayLocal()).split('-');
    if (parts.length !== 3) return date || '—';
    return parts[2] + '/' + parts[1];
  }

  function timeNowLocal() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  async function loadAll() {
    if (!sb() || !userId() || state.loading) return;
    state.loading = true;
    setText('diet-message', 'Carregando dieta...');
    try {
      await loadMeta();
      await loadActiveTemplate();
      if (!state.template) {
        await seedDefaultTemplate();
        await loadActiveTemplate();
      }
      await loadFoodCatalog();
      await ensureDailyLog();
      await loadDailyItems();
      if (!state.items.length) {
        await materializeDailyItems();
        await loadDailyItems();
      }
      setText('diet-message', '');
    } catch (err) {
      console.warn('LoadPro/dieta: erro ao carregar', err);
      setText('diet-message', 'Erro ao carregar dieta.');
    } finally {
      state.loading = false;
      renderAll();
    }
  }

  async function loadMeta() {
    state.settings = null;
    state.latestWeight = null;

    var settingsRes = await sb().from('lp_settings')
      .select('height_cm,birth_date,sex,activity_factor,goal_weight_kg')
      .maybeSingle();
    if (settingsRes.error) throw settingsRes.error;
    state.settings = settingsRes.data || null;

    var weightRes = await sb().from('lp_body_logs')
      .select('weight_kg,date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (weightRes.error) throw weightRes.error;
    state.latestWeight = weightRes.data ? Number(weightRes.data.weight_kg) : null;
  }

  async function loadActiveTemplate() {
    state.template = null;
    state.meals = [];
    state.foodMap = {};

    var templateRes = await sb().from('lp_diet_templates')
      .select('id,name,active,notes,created_at')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (templateRes.error) throw templateRes.error;
    if (!templateRes.data) return;
    state.template = templateRes.data;
    await loadTemplateParts();
  }

  async function loadTemplateParts() {
    var mealsRes = await sb().from('lp_diet_template_meals')
      .select('id,template_id,name,time,meal_order')
      .eq('template_id', state.template.id)
      .order('meal_order', { ascending: true });
    if (mealsRes.error) throw mealsRes.error;

    var meals = mealsRes.data || [];
    var mealIds = meals.map(function (meal) { return meal.id; });
    var itemsByMeal = {};
    var foodIds = [];

    if (mealIds.length) {
      var itemsRes = await sb().from('lp_diet_template_items')
        .select('id,meal_id,food_id,grams,item_order,option_group')
        .in('meal_id', mealIds)
        .order('item_order', { ascending: true });
      if (itemsRes.error) throw itemsRes.error;

      (itemsRes.data || []).forEach(function (item) {
        if (!itemsByMeal[item.meal_id]) itemsByMeal[item.meal_id] = [];
        itemsByMeal[item.meal_id].push(item);
        if (item.food_id) foodIds.push(item.food_id);
      });
    }

    await loadFoods(foodIds);
    state.meals = meals.map(function (meal) {
      meal.items = itemsByMeal[meal.id] || [];
      return meal;
    });
  }

  async function loadFoods(foodIds) {
    var ids = unique((foodIds || []).filter(Boolean));
    if (!ids.length) return;
    var foodsRes = await sb().from('lp_foods')
      .select('id,name,brand,state,kcal_100g,protein_100g,carbs_100g,fat_100g')
      .in('id', ids);
    if (foodsRes.error) throw foodsRes.error;
    (foodsRes.data || []).forEach(function (food) {
      state.foodMap[food.id] = food;
    });
  }

  async function loadFoodCatalog() {
    var userRes = await sb().from('lp_foods')
      .select('id,name,brand,state,kcal_100g,protein_100g,carbs_100g,fat_100g')
      .order('name', { ascending: true });
    if (userRes.error) throw userRes.error;

    var referenceRes = await sb().from('lp_food_reference')
      .select('id,name,state,category,kcal_100g,protein_100g,carbs_100g,fat_100g,source')
      .order('name', { ascending: true })
      .limit(250);
    if (referenceRes.error) throw referenceRes.error;

    state.foodCatalog = [];
    (userRes.data || []).forEach(function (foodRow) {
      state.foodCatalog.push(catalogFood(foodRow, 'user'));
      state.foodMap[foodRow.id] = foodRow;
    });
    (referenceRes.data || []).forEach(function (foodRow) {
      state.foodCatalog.push(catalogFood(foodRow, 'reference'));
    });
    sortFoodCatalog();
    renderFoodOptions();
  }

  async function seedDefaultTemplate() {
    var foodIds = {};
    var foods = [
      food('Whey protein', 'ready', 400, 80, 8, 6),
      food('Creatina', 'ready', 0, 0, 0, 0),
      food('Batata inglesa cozida', 'cooked', 52, 1.2, 11.9, 0.1),
      food('Frango cozido', 'cooked', 163, 31.5, 0, 3.2),
      food('Batata doce cozida', 'cooked', 77, 0.6, 18.4, 0.1),
      food('Legumes cozidos', 'cooked', 35, 2, 7, 0.2),
      food('Carne moida patinho', 'cooked', 180, 26, 0, 8),
      food('Morango', 'ready', 30, 0.7, 6.8, 0.3)
    ];

    for (var i = 0; i < foods.length; i++) {
      var row = foods[i];
      var foodRes = await sb().from('lp_foods').upsert({
        user_id: userId(),
        name: row.name,
        state: row.state,
        kcal_100g: row.kcal,
        protein_100g: row.protein,
        carbs_100g: row.carbs,
        fat_100g: row.fat,
        source: 'referencia inicial'
      }, { onConflict: 'user_id,name' }).select('id,name').single();
      if (foodRes.error) throw foodRes.error;
      foodIds[row.name] = foodRes.data.id;
    }

    var templateRes = await sb().from('lp_diet_templates').insert({
      user_id: userId(),
      name: 'Dieta coach - base',
      active: true,
      notes: 'Template inicial criado pelo LoadPro. Ajuste macros e gramas conforme sua dieta real.'
    }).select('id').single();
    if (templateRes.error) throw templateRes.error;

    var plan = [
      meal('04:00', 'suplementos', [['Whey protein', 30], ['Creatina', 3]]),
      meal('06:10', 'refeicao 1', [['Batata inglesa cozida', 100], ['Frango cozido', 100]]),
      meal('12:30', 'almoco', [['Batata doce cozida', 100], ['Frango cozido', 100], ['Legumes cozidos', 100]]),
      meal('16:00', 'refeicao 3', [['Batata inglesa cozida', 100], ['Carne moida patinho', 100]]),
      meal('19:30', 'jantar', [['Batata doce cozida', 100], ['Frango cozido', 100], ['Legumes cozidos', 100]]),
      meal('21:30', 'ceia', [['Morango', 50], ['Whey protein', 30]])
    ];

    for (var m = 0; m < plan.length; m++) {
      var mealRow = plan[m];
      var mealRes = await sb().from('lp_diet_template_meals').insert({
        user_id: userId(),
        template_id: templateRes.data.id,
        name: mealRow.name,
        time: mealRow.time,
        meal_order: m + 1
      }).select('id').single();
      if (mealRes.error) throw mealRes.error;

      var itemRows = mealRow.items.map(function (item, idx) {
        return {
          user_id: userId(),
          meal_id: mealRes.data.id,
          food_id: foodIds[item[0]],
          grams: item[1],
          item_order: idx + 1
        };
      });
      var itemRes = await sb().from('lp_diet_template_items').insert(itemRows);
      if (itemRes.error) throw itemRes.error;
    }
  }

  function food(name, stateValue, kcal, protein, carbs, fat) {
    return { name: name, state: stateValue, kcal: kcal, protein: protein, carbs: carbs, fat: fat };
  }

  function meal(time, name, items) {
    return { time: time, name: name, items: items };
  }

  async function ensureDailyLog() {
    if (!state.template) return;
    var res = await sb().from('lp_daily_diet_logs').upsert({
      user_id: userId(),
      date: todayLocal(),
      template_id: state.template.id
    }, { onConflict: 'user_id,date' }).select('id').single();
    if (res.error) throw res.error;
    state.dailyLogId = res.data.id;
  }

  async function loadDailyItems() {
    state.items = [];
    if (!state.dailyLogId) return;
    var res = await sb().from('lp_daily_diet_items')
      .select('id,daily_log_id,meal_time,meal_name,food_id,food_name_snapshot,grams,eaten,item_order,kcal_100g_snapshot,protein_100g_snapshot,carbs_100g_snapshot,fat_100g_snapshot')
      .eq('daily_log_id', state.dailyLogId)
      .order('item_order', { ascending: true });
    if (res.error) throw res.error;

    var rows = res.data || [];
    await loadFoods(rows.map(function (item) { return item.food_id; }));
    state.items = rows;
  }

  async function materializeDailyItems() {
    if (!state.dailyLogId || !state.meals.length) return;
    var rows = [];
    var order = 1;
    state.meals.forEach(function (mealRow) {
      mealRow.items.forEach(function (item) {
        var foodRow = state.foodMap[item.food_id] || {};
        rows.push({
          user_id: userId(),
          daily_log_id: state.dailyLogId,
          meal_time: mealRow.time,
          meal_name: mealRow.name,
          food_id: item.food_id,
          food_name_snapshot: foodRow.name || 'Alimento',
          kcal_100g_snapshot: foodRow.kcal_100g,
          protein_100g_snapshot: foodRow.protein_100g,
          carbs_100g_snapshot: foodRow.carbs_100g,
          fat_100g_snapshot: foodRow.fat_100g,
          grams: num(item.grams),
          eaten: false,
          item_order: order++
        });
      });
    });
    if (!rows.length) return;
    var res = await sb().from('lp_daily_diet_items').insert(rows);
    if (res.error) throw res.error;
  }

  function unique(arr) {
    var seen = {};
    var out = [];
    arr.forEach(function (value) {
      if (!seen[value]) { seen[value] = true; out.push(value); }
    });
    return out;
  }

  function itemMacros(item, countOnlyEaten) {
    if (countOnlyEaten && !item.eaten) return macroZero();
    var foodRow = state.foodMap[item.food_id] || {};
    var grams = Number(item.grams) || 0;
    var factor = grams / 100;
    return {
      kcal: factor * macroFromSnapshot(item, foodRow, 'kcal_100g'),
      protein: factor * macroFromSnapshot(item, foodRow, 'protein_100g'),
      carbs: factor * macroFromSnapshot(item, foodRow, 'carbs_100g'),
      fat: factor * macroFromSnapshot(item, foodRow, 'fat_100g')
    };
  }

  function macroFromSnapshot(item, foodRow, field) {
    var snapshot = item[field + '_snapshot'];
    if (snapshot !== null && snapshot !== undefined) return Number(snapshot) || 0;
    return Number(foodRow[field]) || 0;
  }

  function macroZero() {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }

  function addMacros(a, b) {
    a.kcal += b.kcal;
    a.protein += b.protein;
    a.carbs += b.carbs;
    a.fat += b.fat;
    return a;
  }

  function totals(countOnlyEaten) {
    return state.items.reduce(function (sum, item) {
      return addMacros(sum, itemMacros(item, countOnlyEaten));
    }, macroZero());
  }

  function targetKcal() {
    var settings = state.settings || {};
    var weight = state.latestWeight || 96;
    var height = Number(settings.height_cm) || 179;
    var age = ageFromBirth(settings.birth_date) || 36;
    var activity = Number(settings.activity_factor) || 1.725;
    var sex = settings.sex || 'M';
    var bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'F' ? -161 : 5);
    return Math.max(1200, Math.round(bmr * activity - DAILY_DEFICIT_KCAL));
  }

  function targetMacros(kcal) {
    var goal = Number(state.settings && state.settings.goal_weight_kg) || 85;
    var protein = Math.round(goal * 2.1);
    var fat = Math.round(goal * 0.7);
    var carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { protein: protein, carbs: carbs, fat: fat };
  }

  function ageFromBirth(birthDate) {
    if (!birthDate) return null;
    var parts = String(birthDate).split('-').map(Number);
    if (parts.length !== 3) return null;
    var now = new Date();
    var age = now.getFullYear() - parts[0];
    var month = now.getMonth() + 1;
    var day = now.getDate();
    if (month < parts[1] || (month === parts[1] && day < parts[2])) age--;
    return age;
  }

  function adherence() {
    var total = state.items.length;
    var eaten = state.items.filter(function (item) { return !!item.eaten; }).length;
    return {
      total: total,
      eaten: eaten,
      pct: total ? Math.round((eaten / total) * 100) : 0
    };
  }

  function groupedItems() {
    var groups = [];
    var index = {};
    state.items.forEach(function (item) {
      var key = (item.meal_time || '') + '|' + (item.meal_name || '');
      if (!index[key]) {
        index[key] = { time: item.meal_time || '—', name: item.meal_name || 'refeição', items: [] };
        groups.push(index[key]);
      }
      index[key].items.push(item);
    });
    return groups;
  }

  function renderSummary() {
    var consumed = totals(true);
    var planned = totals(false);
    var target = targetKcal();
    var macroTarget = targetMacros(target);
    var adherenceStats = adherence();
    var left = target - consumed.kcal;

    setText('diet-total-kcal', n0(consumed.kcal));
    setText('diet-planned-kcal', n0(planned.kcal));
    setText('diet-consumed-kcal', n0(consumed.kcal));
    setText('diet-dash-kcal', n0(consumed.kcal));
    setText('diet-dash-protein', n0(consumed.protein));
    setText('diet-target-kcal', n0(target));
    setText('diet-kcal-left', (left >= 0 ? '-' : '+') + n0(Math.abs(left)));
    setText('diet-protein-total', n0(consumed.protein) + 'g');
    setText('diet-carbs-total', n0(consumed.carbs) + 'g');
    setText('diet-fat-total', n0(consumed.fat) + 'g');
    setBar('diet-protein-bar', macroTarget.protein ? (consumed.protein / macroTarget.protein) * 100 : 0);
    setBar('diet-carbs-bar', macroTarget.carbs ? (consumed.carbs / macroTarget.carbs) * 100 : 0);
    setBar('diet-fat-bar', macroTarget.fat ? (consumed.fat / macroTarget.fat) * 100 : 0);
    setText('diet-adherence', adherenceStats.pct + '%');
    setText('diet-items-done', adherenceStats.eaten + '/' + adherenceStats.total);
    setText('diet-today-checks', adherenceStats.eaten + '/' + adherenceStats.total);
    setText('diet-weight-base', state.latestWeight ? n1(state.latestWeight) : '—');
    setText('diet-date-label', dateLabel(todayLocal()));
    setText('diet-template-chip', state.template ? state.template.name : 'sem template');
    setText('diet-today-chip', n0(planned.kcal) + ' kcal plano');
  }

  function renderMeals() {
    var container = document.getElementById('diet-meals');
    if (!container) return;
    clear(container);
    var groups = groupedItems();
    if (!groups.length) {
      appendText(container, 'p', 'Nenhum item de dieta para hoje.', 'muted');
      return;
    }
    groups.forEach(function (group) {
      container.appendChild(mealCard(group));
    });
  }

  function mealCard(group) {
    var card = document.createElement('div');
    card.className = 'diet-meal-card';

    var head = document.createElement('div');
    head.className = 'diet-meal-head';
    appendText(head, 'time', group.time, '');
    var title = document.createElement('div');
    appendText(title, 'strong', group.name || 'refeição', '');
    appendText(title, 'span', mealSubtitle(group.items), 'muted');
    head.appendChild(title);
    appendText(head, 'span', n0(group.items.reduce(function (sum, item) {
      return sum + itemMacros(item, true).kcal;
    }, 0)) + ' kcal', 'grams accent');
    card.appendChild(head);

    var list = document.createElement('div');
    list.className = 'diet-item-list';
    group.items.forEach(function (item) {
      list.appendChild(itemRow(item));
    });
    card.appendChild(list);
    return card;
  }

  function mealSubtitle(items) {
    var done = items.filter(function (item) { return !!item.eaten; }).length;
    return done + '/' + items.length + ' itens feitos';
  }

  function itemRow(item) {
    var row = document.createElement('div');
    row.className = 'diet-item-row' + (item.eaten ? ' done' : '');

    var label = document.createElement('div');
    appendText(label, 'strong', item.food_name_snapshot || 'Alimento', '');
    appendText(label, 'span', itemDetail(item), 'muted');
    appendText(label, 'span', itemCalories(item), 'diet-kcal-line');

    var grams = document.createElement('input');
    grams.inputMode = 'decimal';
    grams.value = item.grams === null || item.grams === undefined ? '' : item.grams;
    grams.dataset.dietGrams = item.id;
    grams.setAttribute('aria-label', 'Gramas de ' + (item.food_name_snapshot || 'alimento'));

    var check = document.createElement('button');
    check.type = 'button';
    check.className = 'diet-check';
    check.dataset.dietEaten = item.id;
    check.setAttribute('aria-pressed', item.eaten ? 'true' : 'false');
    check.textContent = item.eaten ? 'feito' : 'fazer';

    row.appendChild(label);
    row.appendChild(grams);
    row.appendChild(check);
    return row;
  }

  function itemDetail(item) {
    var foodRow = state.foodMap[item.food_id] || {};
    var macros = itemMacros(item, false);
    var stateLabel = foodRow.state || 'ready';
    return n1(macros.protein) + 'p · ' + n1(macros.carbs) + 'c · ' + n1(macros.fat) + 'g · ' + stateLabel;
  }

  function itemCalories(item) {
    var macros = itemMacros(item, false);
    return n0(macros.kcal) + ' kcal neste item';
  }

  function renderTodayMeals() {
    var container = document.getElementById('diet-today-meals');
    if (!container) return;
    clear(container);
    groupedItems().forEach(function (group) {
      var mealEl = document.createElement('div');
      mealEl.className = 'meal';
      appendText(mealEl, 'time', group.time, '');
      var body = document.createElement('div');
      appendText(body, 'strong', compactMealName(group), '');
      appendText(body, 'span', compactMealGrams(group), 'muted');
      mealEl.appendChild(body);
      var allDone = group.items.length && group.items.every(function (item) { return !!item.eaten; });
      appendText(mealEl, 'span', allDone ? 'feito' : 'pendente', allDone ? 'grams accent' : 'grams');
      container.appendChild(mealEl);
    });
  }

  function compactMealName(group) {
    return group.items.map(function (item) { return item.food_name_snapshot; }).join(' + ');
  }

  function compactMealGrams(group) {
    return group.items.map(function (item) { return n0(item.grams) + 'g'; }).join(' · ');
  }

  function renderAll() {
    renderSummary();
    renderFoodOptions();
    renderTemplateEditor();
    renderMeals();
    renderTodayMeals();
  }

  function templateFood(item) {
    if (item.foodDraft) return item.foodDraft;
    return state.foodMap[item.food_id] || {};
  }

  function renderFoodOptions() {
    var list = document.getElementById('diet-food-options');
    if (!list) return;
    clear(list);
    uniqueCatalogOptions().forEach(function (foodRow) {
      var opt = document.createElement('option');
      opt.value = foodRow.name;
      opt.label = n0(foodRow.kcal_100g) + ' kcal/100g';
      list.appendChild(opt);
    });
  }

  function findFoodByName(name) {
    var normalized = normalizeFoodTerm(name);
    if (!normalized) return null;
    var fallback = null;
    for (var i = 0; i < state.foodCatalog.length; i++) {
      if (normalizeFoodTerm(state.foodCatalog[i].name) === normalized) {
        if (state.foodCatalog[i].sourceType === 'user') return state.foodCatalog[i];
        if (!fallback) fallback = state.foodCatalog[i];
      }
    }
    return fallback;
  }

  function catalogFood(foodRow, sourceType) {
    return {
      id: sourceType === 'user' ? foodRow.id : null,
      referenceId: sourceType === 'reference' ? foodRow.id : null,
      sourceType: sourceType,
      name: foodRow.name,
      brand: foodRow.brand || '',
      state: foodRow.state || 'ready',
      category: foodRow.category || '',
      kcal_100g: foodRow.kcal_100g,
      protein_100g: foodRow.protein_100g,
      carbs_100g: foodRow.carbs_100g,
      fat_100g: foodRow.fat_100g,
      source: foodRow.source || (sourceType === 'reference' ? 'referencia' : 'manual')
    };
  }

  function normalizeFoodTerm(value) {
    return String(value || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function sortFoodCatalog() {
    state.foodCatalog.sort(function (a, b) {
      var an = normalizeFoodTerm(a.name);
      var bn = normalizeFoodTerm(b.name);
      if (an === bn && a.sourceType !== b.sourceType) return a.sourceType === 'user' ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }

  function uniqueCatalogOptions() {
    var seen = {};
    var out = [];
    state.foodCatalog.forEach(function (foodRow) {
      var key = normalizeFoodTerm(foodRow.name);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(foodRow);
    });
    return out;
  }

  function foodSearchMatches(term) {
    var normalized = normalizeFoodTerm(term);
    if (!normalized) return [];
    var out = [];
    var seen = {};
    state.foodCatalog.forEach(function (foodRow) {
      var nameKey = normalizeFoodTerm(foodRow.name);
      if (!nameKey || seen[nameKey] || nameKey.indexOf(normalized) === -1) return;
      seen[nameKey] = true;
      out.push(foodRow);
    });
    return out.slice(0, 8);
  }

  function foodMeta(foodRow) {
    var origin = foodRow.sourceType === 'user' ? 'meu banco' : 'referencia';
    return n0(foodRow.kcal_100g) + ' kcal/100g · ' + n1(foodRow.protein_100g) + 'p · ' + origin;
  }

  function removeFoodSuggestions() {
    document.querySelectorAll('.diet-food-suggestions').forEach(function (node) {
      node.remove();
    });
  }

  function showFoodSuggestions(input) {
    removeFoodSuggestions();
    if (!input) return;
    state.foodMatches = foodSearchMatches(input.value);
    document.querySelectorAll('[data-diet-food-active]').forEach(function (node) {
      delete node.dataset.dietFoodActive;
    });
    input.dataset.dietFoodActive = 'true';
    if (!state.foodMatches.length) return;

    var list = document.createElement('div');
    list.className = 'diet-food-suggestions';
    state.foodMatches.forEach(function (foodRow, idx) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.dietFoodSuggestion = String(idx);
      appendText(button, 'strong', foodRow.name, '');
      appendText(button, 'span', foodMeta(foodRow), 'muted');
      list.appendChild(button);
    });
    input.parentNode.appendChild(list);
  }

  function activeFoodInput() {
    return document.querySelector('[data-diet-food-active="true"]');
  }

  function setFoodFields(prefix, foodRow) {
    setField(prefix + '-kcal', foodRow.kcal_100g === null || foodRow.kcal_100g === undefined ? '' : foodRow.kcal_100g);
    setField(prefix + '-protein', foodRow.protein_100g === null || foodRow.protein_100g === undefined ? '' : foodRow.protein_100g);
    setField(prefix + '-carbs', foodRow.carbs_100g === null || foodRow.carbs_100g === undefined ? '' : foodRow.carbs_100g);
    setField(prefix + '-fat', foodRow.fat_100g === null || foodRow.fat_100g === undefined ? '' : foodRow.fat_100g);
  }

  function macroValue(value, fallback) {
    var parsed = num(value);
    if (parsed !== null) return parsed;
    return Number(fallback) || 0;
  }

  function renderTemplateEditor() {
    var panel = document.getElementById('diet-template-editor');
    var nameInput = document.getElementById('diet-template-name');
    var list = document.getElementById('diet-editor-meals');
    if (!panel || !list) return;
    panel.hidden = !state.editingTemplate;
    if (!state.editingTemplate) return;
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = state.template ? state.template.name : '';
    }
    clear(list);
    state.meals.forEach(function (mealRow, mealIdx) {
      list.appendChild(templateMealEditor(mealRow, mealIdx));
    });
  }

  function templateMealEditor(mealRow, mealIdx) {
    var wrap = document.createElement('div');
    wrap.className = 'diet-editor-meal';

    var head = document.createElement('div');
    head.className = 'diet-editor-meal-head';
    head.appendChild(editorInput(mealIdx, null, 'time', mealRow.time || '', 'hora'));
    head.appendChild(editorInput(mealIdx, null, 'name', mealRow.name || '', 'refeição'));
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button-ghost';
    remove.dataset.dietRemoveMeal = String(mealIdx);
    remove.textContent = 'Remover';
    head.appendChild(remove);
    wrap.appendChild(head);

    var items = document.createElement('div');
    items.className = 'diet-editor-items';
    (mealRow.items || []).forEach(function (item, itemIdx) {
      items.appendChild(templateItemEditor(item, mealIdx, itemIdx));
    });
    wrap.appendChild(items);

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'button-ghost diet-add-item';
    add.dataset.dietAddItem = String(mealIdx);
    add.textContent = 'Adicionar alimento';
    wrap.appendChild(add);
    return wrap;
  }

  function templateItemEditor(item, mealIdx, itemIdx) {
    var row = document.createElement('div');
    row.className = 'diet-editor-item';
    var foodRow = templateFood(item);
    row.appendChild(editorInput(mealIdx, itemIdx, 'foodName', foodRow.name || '', 'alimento'));
    row.appendChild(editorInput(mealIdx, itemIdx, 'grams', item.grams, 'g'));
    row.appendChild(editorInput(mealIdx, itemIdx, 'kcal_100g', foodRow.kcal_100g, 'kcal/100'));
    row.appendChild(editorInput(mealIdx, itemIdx, 'protein_100g', foodRow.protein_100g, 'prot'));
    row.appendChild(editorInput(mealIdx, itemIdx, 'carbs_100g', foodRow.carbs_100g, 'carb'));
    row.appendChild(editorInput(mealIdx, itemIdx, 'fat_100g', foodRow.fat_100g, 'gord'));
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'diet-editor-remove';
    remove.dataset.dietRemoveItem = mealIdx + ':' + itemIdx;
    remove.textContent = 'x';
    remove.setAttribute('aria-label', 'Remover alimento');
    row.appendChild(remove);
    return row;
  }

  function editorInput(mealIdx, itemIdx, field, value, label) {
    var wrap = document.createElement('label');
    var cap = document.createElement('span');
    cap.className = 'cap';
    cap.textContent = label;
    var input = document.createElement('input');
    input.value = value === null || value === undefined ? '' : value;
    input.autocomplete = 'off';
    if (field === 'foodName') input.setAttribute('list', 'diet-food-options');
    input.dataset.dietEditMeal = String(mealIdx);
    input.dataset.dietEditField = field;
    if (itemIdx !== null && itemIdx !== undefined) input.dataset.dietEditItem = String(itemIdx);
    if (field !== 'name' && field !== 'time' && field !== 'foodName') input.inputMode = 'decimal';
    wrap.appendChild(cap);
    wrap.appendChild(input);
    return wrap;
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (String(state.items[i].id) === String(id)) return state.items[i];
    }
    return null;
  }

  function enqueueWrite(fn) {
    writeQueue = writeQueue.then(fn).catch(function (err) {
      console.warn('LoadPro/dieta: erro ao salvar', err);
      setText('diet-message', 'Erro ao salvar dieta.');
    });
    return writeQueue;
  }

  function maxItemOrder() {
    return state.items.reduce(function (max, item) {
      return Math.max(max, Number(item.item_order) || 0);
    }, 0);
  }

  function addTemplateMeal() {
    if (!state.template) return;
    state.editingTemplate = true;
    state.meals.push({
      id: null,
      template_id: state.template.id,
      name: 'nova refeição',
      time: timeNowLocal(),
      meal_order: state.meals.length + 1,
      items: []
    });
    renderAll();
  }

  function addTemplateItem(mealIdx) {
    var mealRow = state.meals[mealIdx];
    if (!mealRow) return;
    mealRow.items = mealRow.items || [];
    mealRow.items.push({
      id: null,
      food_id: null,
      grams: 100,
      item_order: mealRow.items.length + 1,
      foodDraft: {
        name: 'Novo alimento',
        state: 'ready',
        kcal_100g: 0,
        protein_100g: 0,
        carbs_100g: 0,
        fat_100g: 0
      }
    });
    renderAll();
  }

  function removeTemplateMeal(mealIdx) {
    state.meals.splice(mealIdx, 1);
    renderAll();
  }

  function removeTemplateItem(value) {
    var parts = String(value).split(':').map(Number);
    var mealRow = state.meals[parts[0]];
    if (!mealRow || !mealRow.items) return;
    mealRow.items.splice(parts[1], 1);
    renderAll();
  }

  function updateTemplateInput(input) {
    var mealIdx = Number(input.dataset.dietEditMeal);
    var itemIdx = input.dataset.dietEditItem === undefined ? null : Number(input.dataset.dietEditItem);
    var field = input.dataset.dietEditField;
    var mealRow = state.meals[mealIdx];
    if (!mealRow) return;

    if (itemIdx === null || Number.isNaN(itemIdx)) {
      mealRow[field] = input.value.trim();
      return;
    }
    var item = mealRow.items && mealRow.items[itemIdx];
    if (!item) return;
    if (field === 'grams') {
      item.grams = num(input.value);
      return;
    }
    if (!item.foodDraft) {
      var foodRow = state.foodMap[item.food_id] || {};
      item.foodDraft = {
        name: foodRow.name || '',
        state: foodRow.state || 'ready',
        kcal_100g: foodRow.kcal_100g,
        protein_100g: foodRow.protein_100g,
        carbs_100g: foodRow.carbs_100g,
        fat_100g: foodRow.fat_100g
      };
    }
    if (field === 'foodName') item.foodDraft.name = input.value.trim();
    else item.foodDraft[field] = num(input.value);
  }

  function applyCatalogFoodToTemplate(input) {
    if (!input || input.dataset.dietEditField !== 'foodName') return;
    var mealIdx = Number(input.dataset.dietEditMeal);
    var itemIdx = Number(input.dataset.dietEditItem);
    var mealRow = state.meals[mealIdx];
    var item = mealRow && mealRow.items && mealRow.items[itemIdx];
    var foodRow = findFoodByName(input.value);
    if (!item || !foodRow) return;
    item.food_id = foodRow.sourceType === 'user' ? foodRow.id : null;
    item.foodDraft = {
      name: foodRow.name,
      state: foodRow.state || 'ready',
      kcal_100g: foodRow.kcal_100g,
      protein_100g: foodRow.protein_100g,
      carbs_100g: foodRow.carbs_100g,
      fat_100g: foodRow.fat_100g
    };
    if (foodRow.id) state.foodMap[foodRow.id] = foodRow;
    renderAll();
  }

  function applyFoodSelection(input, foodRow) {
    if (!input || !foodRow) return;
    input.value = foodRow.name;
    if (input.id === 'diet-extra-name') {
      applyCatalogFoodToExtra(foodRow);
      return;
    }
    if (input.dataset.dietEditField === 'foodName') {
      applyCatalogFoodToTemplate(input);
    }
  }

  async function ensureTemplateFood(item) {
    var draft = templateFood(item);
    var name = (draft.name || '').trim() || 'Sem nome';
    var existing = item.food_id ? state.foodMap[item.food_id] : findFoodByName(name);
    var payload = {
      user_id: userId(),
      name: name,
      state: draft.state || (existing && existing.state) || 'ready',
      kcal_100g: macroValue(draft.kcal_100g, existing && existing.kcal_100g),
      protein_100g: macroValue(draft.protein_100g, existing && existing.protein_100g),
      carbs_100g: macroValue(draft.carbs_100g, existing && existing.carbs_100g),
      fat_100g: macroValue(draft.fat_100g, existing && existing.fat_100g),
      source: 'manual'
    };
    if (item.food_id) {
      var updateRes = await sb().from('lp_foods')
        .update(payload)
        .eq('id', item.food_id)
        .select('id,name,brand,state,kcal_100g,protein_100g,carbs_100g,fat_100g')
        .single();
      if (updateRes.error) throw updateRes.error;
      state.foodMap[updateRes.data.id] = updateRes.data;
      upsertCatalogFood(updateRes.data);
      return updateRes.data.id;
    }
    var upsertRes = await sb().from('lp_foods').upsert(payload, { onConflict: 'user_id,name' })
      .select('id,name,brand,state,kcal_100g,protein_100g,carbs_100g,fat_100g')
      .single();
      if (upsertRes.error) throw upsertRes.error;
    state.foodMap[upsertRes.data.id] = upsertRes.data;
    upsertCatalogFood(upsertRes.data);
    return upsertRes.data.id;
  }

  async function saveTemplate() {
    if (!state.template || !userId()) return;
    var nameInput = document.getElementById('diet-template-name');
    var templateName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : state.template.name;
    setText('diet-editor-message', 'Salvando dieta...');
    try {
      var templateRes = await sb().from('lp_diet_templates')
        .update({ name: templateName })
        .eq('id', state.template.id)
        .select('id,name,active,notes,created_at')
        .single();
      if (templateRes.error) throw templateRes.error;
      state.template = templateRes.data;

      var delRes = await sb().from('lp_diet_template_meals').delete().eq('template_id', state.template.id);
      if (delRes.error) throw delRes.error;

      for (var m = 0; m < state.meals.length; m++) {
        var mealRow = state.meals[m];
        var mealRes = await sb().from('lp_diet_template_meals').insert({
          user_id: userId(),
          template_id: state.template.id,
          name: (mealRow.name || 'refeição').trim() || 'refeição',
          time: (mealRow.time || '').trim() || timeNowLocal(),
          meal_order: m + 1
        }).select('id').single();
        if (mealRes.error) throw mealRes.error;

        var itemRows = [];
        for (var i = 0; i < (mealRow.items || []).length; i++) {
          var item = mealRow.items[i];
          var foodId = await ensureTemplateFood(item);
          itemRows.push({
            user_id: userId(),
            meal_id: mealRes.data.id,
            food_id: foodId,
            grams: num(item.grams),
            item_order: i + 1
          });
        }
        if (itemRows.length) {
          var itemRes = await sb().from('lp_diet_template_items').insert(itemRows);
          if (itemRes.error) throw itemRes.error;
        }
      }
      await loadActiveTemplate();
      state.editingTemplate = false;
      setText('diet-editor-message', '');
      setText('diet-message', 'Template salvo. Dias novos usam essa dieta.');
    } catch (err) {
      console.warn('LoadPro/dieta: erro ao salvar template', err);
      setText('diet-editor-message', 'Erro ao salvar template.');
    }
    renderAll();
  }

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value;
  }

  function upsertCatalogFood(foodRow) {
    foodRow = catalogFood(foodRow, 'user');
    var replaced = false;
    for (var i = 0; i < state.foodCatalog.length; i++) {
      if (state.foodCatalog[i].sourceType === 'user' && state.foodCatalog[i].id === foodRow.id) {
        state.foodCatalog[i] = foodRow;
        replaced = true;
        break;
      }
    }
    if (!replaced) state.foodCatalog.push(foodRow);
    sortFoodCatalog();
    renderFoodOptions();
  }

  function applyCatalogFoodToExtra(foodRow) {
    foodRow = foodRow || findFoodByName(fieldValue('diet-extra-name'));
    if (!foodRow) return;
    setField('diet-extra-name', foodRow.name);
    setFoodFields('diet-extra', foodRow);
    renderExtraPreview();
  }

  function renderExtraPreview() {
    var grams = num(fieldValue('diet-extra-grams')) || 0;
    var kcal100 = num(fieldValue('diet-extra-kcal')) || 0;
    setText('diet-extra-kcal-preview', n0((grams / 100) * kcal100) + ' kcal');
  }

  async function addExtraItem(form) {
    if (!userId()) return;
    var name = fieldValue('diet-extra-name');
    var grams = num(fieldValue('diet-extra-grams'));
    var existing = findFoodByName(name);
    var kcal = num(fieldValue('diet-extra-kcal'));
    var protein = num(fieldValue('diet-extra-protein'));
    var carbs = num(fieldValue('diet-extra-carbs'));
    var fat = num(fieldValue('diet-extra-fat'));
    var time = fieldValue('diet-extra-time') || timeNowLocal();
    if (existing) {
      if (kcal === null) kcal = Number(existing.kcal_100g) || 0;
      if (protein === null) protein = Number(existing.protein_100g) || 0;
      if (carbs === null) carbs = Number(existing.carbs_100g) || 0;
      if (fat === null) fat = Number(existing.fat_100g) || 0;
    }
    if (!name || !grams || grams <= 0 || kcal === null || kcal < 0) {
      setText('diet-message', 'Informe alimento, gramas e kcal/100g para registrar fora da dieta.');
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setText('diet-message', 'Registrando item avulso...');
    try {
      if (!state.dailyLogId) await ensureDailyLog();
      var foodRes = await sb().from('lp_foods').upsert({
        user_id: userId(),
        name: name,
        state: existing && existing.state ? existing.state : 'ready',
        kcal_100g: kcal,
        protein_100g: protein || 0,
        carbs_100g: carbs || 0,
        fat_100g: fat || 0,
        source: existing && existing.source ? existing.source : 'manual'
      }, { onConflict: 'user_id,name' })
        .select('id,name,brand,state,kcal_100g,protein_100g,carbs_100g,fat_100g')
        .single();
      if (foodRes.error) throw foodRes.error;
      state.foodMap[foodRes.data.id] = foodRes.data;
      upsertCatalogFood(foodRes.data);

      var itemRes = await sb().from('lp_daily_diet_items').insert({
        user_id: userId(),
        daily_log_id: state.dailyLogId,
        meal_time: time,
        meal_name: 'fora da dieta',
        food_id: foodRes.data.id,
        food_name_snapshot: foodRes.data.name,
        kcal_100g_snapshot: foodRes.data.kcal_100g,
        protein_100g_snapshot: foodRes.data.protein_100g,
        carbs_100g_snapshot: foodRes.data.carbs_100g,
        fat_100g_snapshot: foodRes.data.fat_100g,
        grams: grams,
        eaten: true,
        item_order: maxItemOrder() + 1
      }).select('id,daily_log_id,meal_time,meal_name,food_id,food_name_snapshot,grams,eaten,item_order,kcal_100g_snapshot,protein_100g_snapshot,carbs_100g_snapshot,fat_100g_snapshot').single();
      if (itemRes.error) throw itemRes.error;

      state.items.push(itemRes.data);
      await saveAdherence();
      resetExtraForm();
      renderAll();
      setText('diet-message', 'Item avulso registrado.');
    } catch (err) {
      console.warn('LoadPro/dieta: erro ao registrar avulso', err);
      setText('diet-message', 'Erro ao registrar item avulso.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function resetExtraForm() {
    setField('diet-extra-time', timeNowLocal());
    setField('diet-extra-name', '');
    setField('diet-extra-grams', '');
    setField('diet-extra-kcal', '');
    setField('diet-extra-protein', '');
    setField('diet-extra-carbs', '');
    setField('diet-extra-fat', '');
    renderExtraPreview();
  }

  async function saveItem(item) {
    var res = await sb().from('lp_daily_diet_items').update({
      grams: num(item.grams),
      eaten: !!item.eaten
    }).eq('id', item.id);
    if (res.error) throw res.error;
    await saveAdherence();
  }

  async function saveAdherence() {
    if (!state.dailyLogId) return;
    var stats = adherence();
    var res = await sb().from('lp_daily_diet_logs').update({
      adherence_pct: stats.pct
    }).eq('id', state.dailyLogId);
    if (res.error) throw res.error;
  }

  function toggleEaten(id) {
    var item = findItem(id);
    if (!item) return;
    item.eaten = !item.eaten;
    renderAll();
    enqueueWrite(function () { return saveItem(item); });
  }

  function updateGrams(input, persist) {
    var item = findItem(input.dataset.dietGrams);
    if (!item) return;
    item.grams = num(input.value);
    renderSummary();
    renderTodayMeals();
    if (persist) enqueueWrite(function () { return saveItem(item); });
  }

  function bind() {
    if (state.bound) return;
    document.addEventListener('click', function (e) {
      var suggestion = e.target.closest('[data-diet-food-suggestion]');
      if (suggestion) {
        var match = state.foodMatches[Number(suggestion.dataset.dietFoodSuggestion)];
        applyFoodSelection(activeFoodInput(), match);
        removeFoodSuggestions();
        return;
      }
      var eaten = e.target.closest('[data-diet-eaten]');
      if (eaten) {
        toggleEaten(eaten.dataset.dietEaten);
        return;
      }
      if (e.target.closest('#diet-edit-template')) {
        state.editingTemplate = !state.editingTemplate;
        renderAll();
        return;
      }
      if (e.target.closest('#diet-add-meal') || e.target.closest('#diet-editor-add-meal')) {
        addTemplateMeal();
        return;
      }
      if (e.target.closest('#diet-save-template')) {
        saveTemplate();
        return;
      }
      var addItem = e.target.closest('[data-diet-add-item]');
      if (addItem) {
        addTemplateItem(Number(addItem.dataset.dietAddItem));
        return;
      }
      var removeMeal = e.target.closest('[data-diet-remove-meal]');
      if (removeMeal) {
        removeTemplateMeal(Number(removeMeal.dataset.dietRemoveMeal));
        return;
      }
      var removeItem = e.target.closest('[data-diet-remove-item]');
      if (removeItem) {
        removeTemplateItem(removeItem.dataset.dietRemoveItem);
      }
      if (!e.target.closest('.diet-food-suggestions') && e.target.id !== 'diet-extra-name' && e.target.dataset.dietEditField !== 'foodName') {
        removeFoodSuggestions();
      }
    });
    document.addEventListener('input', function (e) {
      if (e.target.id === 'diet-extra-name') {
        applyCatalogFoodToExtra();
        showFoodSuggestions(e.target);
      }
      if (e.target.id && e.target.id.indexOf('diet-extra-') === 0) renderExtraPreview();
      if (e.target.id === 'diet-template-name' && state.template) state.template.name = e.target.value;
      if (e.target.dataset.dietEditField === 'foodName') {
        applyCatalogFoodToTemplate(e.target);
        showFoodSuggestions(e.target);
      }
      if (e.target.dataset.dietEditMeal !== undefined) updateTemplateInput(e.target);
      if (e.target.dataset.dietGrams !== undefined) updateGrams(e.target, false);
    });
    document.addEventListener('change', function (e) {
      if (e.target.id === 'diet-extra-name') applyCatalogFoodToExtra();
      if (e.target.dataset.dietEditField === 'foodName') applyCatalogFoodToTemplate(e.target);
      if (e.target.dataset.dietGrams !== undefined) updateGrams(e.target, true);
    });
    document.addEventListener('focusin', function (e) {
      if (e.target.id === 'diet-extra-name' || e.target.dataset.dietEditField === 'foodName') {
        showFoodSuggestions(e.target);
      }
    });
    var extraForm = document.getElementById('diet-extra-form');
    if (extraForm) {
      setField('diet-extra-time', timeNowLocal());
      extraForm.addEventListener('submit', function (e) {
        e.preventDefault();
        addExtraItem(extraForm);
      });
    }
    state.bound = true;
  }

  window.LP = window.LP || {};
  window.LP.diet = {
    start: function () {
      bind();
      loadAll();
    }
  };
})();
