// LoadPro — PWA + Web Push. Mantem alerta local como fallback quando o app esta aberto.
(function () {
  var SETTINGS_KEY = 'lp_alert_settings';
  var PUSH_TABLE = 'lp_push_subscriptions';
  var VAPID_PUBLIC_KEY = 'BLKKIEyoIzxaOQG5-vt3kQpAmKUtH__ClesEGf6X8Pvemm_ZLR9coKr0T38IFWkz0WXHqW0HqpKzfuy_-5yk1EQ';
  var DEFAULTS = { enabled: false, waterInterval: 90, meals: true };
  var timers = [];
  var bound = false;
  var settings = loadSettings();
  var registrationPromise = null;

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

  function canPush() {
    return canNotify() && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  }

  function isStandalone() {
    return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  }

  function urlBase64ToUint8Array(value) {
    var padding = '='.repeat((4 - value.length % 4) % 4);
    var base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = window.atob(base64);
    var output = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
    if (registrationPromise) return registrationPromise;
    registrationPromise = navigator.serviceWorker.register('/sw.js?v=20260622-webpush')
      .then(function (registration) { return registration; })
      .catch(function (err) {
        console.warn('LoadPro/alertas: service worker indisponivel', err);
        return null;
      });
    return registrationPromise;
  }

  async function readyRegistration() {
    var registration = await registerServiceWorker();
    if (!registration) return null;
    try {
      await navigator.serviceWorker.ready;
    } catch (err) {
      return registration;
    }
    return registration;
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
    if (settings.enabled) await registerPushSubscription();
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

  function subscriptionPayload(subscription) {
    var data = subscription && subscription.toJSON ? subscription.toJSON() : {};
    var keys = data.keys || {};
    return {
      endpoint: data.endpoint || subscription.endpoint,
      p256dh: keys.p256dh || '',
      auth: keys.auth || ''
    };
  }

  function pushRows(subscription) {
    var user = window.LP && window.LP.user;
    var sub = subscriptionPayload(subscription);
    var base = {
      user_id: user && user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: navigator.userAgent || ''
    };
    var extended = Object.assign({}, base, {
      enabled: true,
      water_interval_minutes: Number(settings.waterInterval) || 0,
      meal_alerts: !!settings.meals,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
    });
    return { extended: extended, base: base };
  }

  async function savePushRow(row) {
    var sb = window.LP && window.LP.sb;
    if (!sb || !row.user_id || !row.endpoint) return false;
    var found = await sb.from(PUSH_TABLE)
      .select('id')
      .eq('user_id', row.user_id)
      .eq('endpoint', row.endpoint)
      .maybeSingle();
    if (found.error && found.error.code !== 'PGRST116') throw found.error;
    if (found.data && found.data.id) {
      var updated = await sb.from(PUSH_TABLE).update(row).eq('id', found.data.id);
      if (updated.error) throw updated.error;
      return true;
    }
    var inserted = await sb.from(PUSH_TABLE).insert(row);
    if (inserted.error) throw inserted.error;
    return true;
  }

  async function persistPushSubscription(subscription) {
    var rows = pushRows(subscription);
    try {
      await savePushRow(rows.extended);
      return true;
    } catch (err) {
      try {
        await savePushRow(rows.base);
        return true;
      } catch (fallbackErr) {
        console.warn('LoadPro/alertas: nao salvou inscricao push', fallbackErr);
        setText('alerts-next', 'Permissao ativa, mas o device ainda nao foi salvo no banco.');
        return false;
      }
    }
  }

  async function registerPushSubscription() {
    if (!canPush() || Notification.permission !== 'granted') return false;
    if (isIos() && !isStandalone()) {
      setText('alerts-next', 'No iPhone, instale na tela inicial antes de ativar push real.');
      return false;
    }
    var registration = await readyRegistration();
    if (!registration || !registration.pushManager) return false;
    try {
      var subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      var saved = await persistPushSubscription(subscription);
      if (saved) setText('alerts-next', 'Push real ativo neste aparelho.');
      return saved;
    } catch (err) {
      console.warn('LoadPro/alertas: push indisponivel', err);
      setText('alerts-next', 'Push indisponivel neste navegador. Alerta local segue como fallback.');
      return false;
    }
  }

  async function deletePushSubscription() {
    var sb = window.LP && window.LP.sb;
    if (!canPush() || !sb) return;
    try {
      var registration = await readyRegistration();
      var subscription = registration && registration.pushManager ? await registration.pushManager.getSubscription() : null;
      if (!subscription) return;
      var endpoint = subscription.endpoint;
      try { await subscription.unsubscribe(); } catch (e) {}
      await sb.from(PUSH_TABLE).delete().eq('endpoint', endpoint);
    } catch (err) {
      console.warn('LoadPro/alertas: nao removeu inscricao push', err);
    }
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
    if (settings.enabled && canPush()) next.push('push real no aparelho');
    if (isIos() && !isStandalone()) next.push('iPhone: instale na tela inicial');
    setText('alerts-next', next.length ? next.join(' · ') : 'Alertas desligados.');
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
          await deletePushSubscription();
          saveSettings();
          render();
          reschedule();
          return;
        }
        await requestPermission();
      });
    }
    if (water) {
      water.addEventListener('change', async function () {
        settings.waterInterval = Number(water.value) || 0;
        saveSettings();
        if (settings.enabled) await registerPushSubscription();
        reschedule();
        render();
      });
    }
    if (meals) {
      meals.addEventListener('change', async function () {
        settings.meals = !!meals.checked;
        saveSettings();
        if (settings.enabled) await registerPushSubscription();
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
    if (settings.enabled && Notification.permission === 'granted') await registerPushSubscription();
    render();
    reschedule();
    setTimeout(reschedule, 1400);
  }

  window.LP = window.LP || {};
  window.LP.notifications = { start: start, registerPushSubscription: registerPushSubscription };
})();
