// NaLinha — Plan Guard (inclua em TODAS as páginas protegidas)
// Verifica se o plano está ativo. Se expirado, redireciona pra planos.html.

const PLAN_LIMITS = {
  trial:        { maxBarbers: 1 },
  basico:       { maxBarbers: 1 },
  profissional: { maxBarbers: 3 },
  premium:      { maxBarbers: 999 }
};

const PLAN_CACHE_KEY = 'nalinha_plan_cache';
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 min

function _getCachedPlan() {
  try {
    const raw = sessionStorage.getItem(PLAN_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > PLAN_CACHE_TTL) return null;
    return cached.data;
  } catch { return null; }
}

function _setCachedPlan(data) {
  try {
    sessionStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* ignore */ }
}

function _calcDaysLeft(expiresAt) {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function checkPlan(shopOverride) {
  // Tentar cache primeiro
  const cached = _getCachedPlan();
  if (cached) return cached;

  // Buscar dados frescos
  let shopData = shopOverride || null;

  if (!shopData) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { plan: null, daysLeft: 0, expired: true, maxBarbers: 1 };

    const adminViewingShop = sessionStorage.getItem('admin_viewing_shop');
    if (adminViewingShop) {
      const { data } = await sb.from('barbershops').select('id,plan,plan_started_at,plan_expires_at,trial_started_at').eq('id', adminViewingShop).single();
      shopData = data;
    } else {
      const { data } = await sb.from('barbershops').select('id,plan,plan_started_at,plan_expires_at,trial_started_at').eq('owner_id', session.user.id).maybeSingle();
      shopData = data;
    }
  }

  if (!shopData) return { plan: null, daysLeft: 0, expired: true, maxBarbers: 1 };

  // Graceful handling: se plan é null, trata como trial começando agora
  let plan = shopData.plan || 'trial';
  let expiresAt = shopData.plan_expires_at;

  if (!expiresAt && plan === 'trial') {
    // Trial sem data definida: assume 30 dias a partir de trial_started_at ou agora
    const start = shopData.trial_started_at || new Date().toISOString();
    expiresAt = new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const daysLeft = _calcDaysLeft(expiresAt);
  const expired = daysLeft <= 0;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;

  const result = {
    plan,
    daysLeft,
    expired,
    maxBarbers: limits.maxBarbers,
    expiresAt
  };

  _setCachedPlan(result);
  return result;
}

// ── Enforcement automático ──────────────────────────────────
async function _enforcePlan() {
  // Não rodar na própria página de planos, no login nem no onboarding
  const page = window.location.pathname.split('/').pop();
  const skipPages = ['planos.html', 'app.html', 'index.html', 'landing.html', 'onboarding.html', 'agendar.html', 'personal-cadastro.html', 'cliente.html'];
  if (skipPages.includes(page)) return;

  const info = await checkPlan();

  if (info.expired) {
    window.location.href = 'planos.html?expired=true';
    return;
  }

  // Banner de trial (só pra trial, não pra planos pagos)
  if (info.plan === 'trial' && !document.getElementById('plan-guard-banner')) {
    const banner = document.createElement('div');
    banner.id = 'plan-guard-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#d4a853;color:#000;padding:8px 16px;font-size:12px;font-weight:700;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;gap:12px;';
    banner.innerHTML = 'Trial: ' + info.daysLeft + ' dia' + (info.daysLeft !== 1 ? 's' : '') + ' restante' + (info.daysLeft !== 1 ? 's' : '')
      + ' &middot; <a href="planos.html" style="color:#000;text-decoration:underline;font-weight:800;">Ver planos</a>'
      + '<button onclick="this.parentElement.remove();document.body.style.paddingTop=\'0\'" style="background:none;border:none;color:#000;font-size:16px;cursor:pointer;padding:0 4px;margin-left:8px;font-weight:700;">&#x2715;</button>';
    document.body.prepend(banner);
    document.body.style.paddingTop = '36px';
  }
}

// Rodar automaticamente quando o DOM carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _enforcePlan);
} else {
  _enforcePlan();
}
