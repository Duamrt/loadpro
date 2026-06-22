// LoadPro — PWA + alertas locais. Sem push remoto: dispara enquanto o app/PWA esta aberto.
(function () {
  var SETTINGS_KEY = 'lp_alert_settings';
  var DEFAULTS = { enabled: false, waterInterval: 90, meals: true };
  var timers = [];
  var bound = false;
  var settings = loadSettings();

  function $(id) { return document.getElementById(id); }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY) || '';
      var parts = raw.split('|');
      if (parts.length !== 3) return Object.assign({}, DEFAULTS);
      return {
        enabled: parts[0] === '1',
        waterInterval: Number(parts[1]) || 0,
        meals: parts[2] === '1'
      };
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, [
        settings.enabled ? '1' : '0',
        String(settings.waterInterval || 0),
        settings.meals ? '1' : '0'
      ].join('|'));
    } catch (e) {}
  }

  function canNotify() {
    return 'Notification' in window && window.isSecureContext;
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
    try {
      return await navigator.serviceWorker.register('/sw.js?v=20260622-alerts');
    } catch (err) {
      console.warn('LoadPro/alertas: service worker indisponivel', err);
      return null;
    }
  }

  async function requestPermission() {
    if (!canNotify()) {
      setText('alerts-status', 'indisponivel');
      setText('alerts-next', 'Notificacoes exigem HTTPS e navegador compativel.');
      return false;
    }
    var permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    settings.enabled = permission === 'granted';
    saveSettings();
    render();
    reschedule();
    return settings.enabled;
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function clearTimers() {
    timers.forEach(function (timer) { clearTimeout(timer); });
    timers = [];
  }

  function schedule(fn, ms) {
    if (ms < 0) return;
    timers.push(setTimeout(fn, ms));
  }

  function nextTimeFor(hour, minute) {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  function parseTime(value) {
    var match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour: hour, minute: minute };
  }

  function mealTimes() {
    var out = [];
    document.querySelectorAll('#diet-today-meals time').forEach(function (node) {
      var parsed = parseTime(node.textContent);
      if (parsed) out.push(parsed);
    });
    return out;
  }

  function nextMealLabel() {
    var times = mealTimes();
    if (!times.length) return '';
    var next = times.map(function (time) {
      return nextTimeFor(time.hour, time.minute);
    }).sort(function (a, b) { return a - b; })[0];
    return String(next.getHours()).padStart(2, '0') + ':' + String(next.getMinutes()).padStart(2, '0');
  }

  async function notify(title, body) {
    if (!settings.enabled || !canNotify() || Notification.permission !== 'granted') return;
    var options = {
      body: body,
      icon: '/icons/loadpro-icon.svg',
      badge: '/icons/loadpro-icon.svg',
      tag: 'loadpro-alert',
      renotify: true
    };
    try {
      var registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.showNotification) {
        registration.showNotification(title, options);
        return;
      }
    } catch (e) {}
    try { new Notification(title, options); } catch (e2) {}
  }

  function scheduleWater() {
    var interval = Number(settings.waterInterval) || 0;
    if (!interval) return;
    schedule(function tick() {
      notify('LoadPro: agua', 'Hora de bater mais um copo e manter a meta do dia.');
      schedule(tick, interval * 60 * 1000);
      renderNext();
    }, interval * 60 * 1000);
  }

  function scheduleMeals() {
    if (!settings.meals) return;
    mealTimes().forEach(function (time) {
      var next = nextTimeFor(time.hour, time.minute);
      schedule(function () {
        notify('LoadPro: refeicao', 'Refeicao programada para agora.');
        renderNext();
        reschedule();
      }, next.getTime() - Date.now());
    });
  }

  function reschedule() {
    clearTimers();
    if (!settings.enabled) {
      renderNext();
      return;
    }
    scheduleWater();
    scheduleMeals();
    renderNext();
  }

  function renderNext() {
    var next = [];
    if (settings.enabled && Number(settings.waterInterval)) next.push('agua a cada ' + settings.waterInterval + ' min');
    var meal = settings.enabled && settings.meals ? nextMealLabel() : '';
    if (meal) next.push('proxima refeicao ' + meal);
    setText('alerts-next', next.length ? next.join(' · ') : 'Alertas locais desligados.');
  }

  function render() {
    var enable = $('alerts-enable');
    var water = $('alerts-water-interval');
    var meals = $('alerts-meals');
    if (enable) enable.textContent = settings.enabled ? 'Desativar' : 'Ativar';
    if (water) water.value = String(settings.waterInterval || 0);
    if (meals) meals.checked = !!settings.meals;
    var status = !canNotify() ? 'indisponivel' : settings.enabled ? 'ativos' : 'inativos';
    if (canNotify() && Notification.permission === 'denied') status = 'bloqueado';
    setText('alerts-status', status);
    renderNext();
  }

  function bind() {
    if (bound) return;
    var enable = $('alerts-enable');
    var water = $('alerts-water-interval');
    var meals = $('alerts-meals');

    if (enable) {
      enable.addEventListener('click', async function () {
        if (settings.enabled) {
          settings.enabled = false;
          saveSettings();
          render();
          reschedule();
          return;
        }
        await requestPermission();
      });
    }
    if (water) {
      water.addEventListener('change', function () {
        settings.waterInterval = Number(water.value) || 0;
        saveSettings();
        reschedule();
        render();
      });
    }
    if (meals) {
      meals.addEventListener('change', function () {
        settings.meals = !!meals.checked;
        saveSettings();
        reschedule();
        render();
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) reschedule();
    });
    bound = true;
  }

  async function start() {
    bind();
    await registerServiceWorker();
    render();
    reschedule();
    setTimeout(reschedule, 1400);
  }

  window.LP = window.LP || {};
  window.LP.notifications = { start: start };
})();
