// NaLinha — Autenticação

// ── Estado ────────────────────────────────────────────────────
let authMode = 'login'; // 'login' ou 'signup'

// ── Inicialização ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Se já tem sessão ativa, redireciona
  checkSession();

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.mode));
  });

  // Forms
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-signup').addEventListener('submit', handleSignup);

  // Toggle senha
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? '🙈' : '👁';
    });
  });
});

// ── Sessão ────────────────────────────────────────────────────
const ADMIN_EMAILS = ['duam-rt@hotmail.com'];

async function checkSession() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    await redirectUser(session.user);
  } catch (e) {
    console.error('checkSession erro:', e);
  }
}

// ── Trocar tabs ───────────────────────────────────────────────
function switchTab(mode) {
  authMode = mode;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.getElementById('form-login').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = mode === 'signup' ? 'block' : 'none';
  hideMsg();
}

// BUG 7 ALTO FIX: validação de email com regex
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Login ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value;
  const btn = document.getElementById('btn-login');

  if (!email || !senha) {
    showMsg('Preencha todos os campos.', 'error');
    return;
  }

  // BUG 7 ALTO FIX: validar email antes de enviar
  if (!isValidEmail(email)) {
    showMsg('Informe um e-mail válido.', 'error');
    return;
  }

  // Login aceita qualquer senha (validação forte só no signup)
  if (senha.length < 4) {
    showMsg('Digite sua senha.', 'error');
    return;
  }

  setLoading(btn, true);
  hideMsg();

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: senha
  });

  setLoading(btn, false);

  if (error) {
    const msg = error.message.includes('Invalid login')
      ? 'E-mail ou senha incorretos.'
      : error.message.includes('Email not confirmed')
      ? 'Confirme seu e-mail antes de entrar.'
      : 'Erro ao entrar. Tente novamente.';
    showMsg(msg, 'error');
    return;
  }

  // Redirecionar
  await redirectUser(data.user);
}

// Redireciona baseado no role do usuario
async function redirectUser(user) {
  if (ADMIN_EMAILS.includes(user.email)) {
    window.location.href = 'admin.html';
    return;
  }

  const { data: shop } = await sb
    .from('barbershops')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (shop) { window.location.href = 'dashboard.html'; return; }

  // Verificar se ja esta vinculado como barbeiro
  const { data: barber } = await sb
    .from('barbers')
    .select('id, is_owner')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (barber) {
    // Se e barbeiro-dono, vai pro dashboard (nao pro personal.html)
    window.location.href = barber.is_owner ? 'dashboard.html' : 'personal.html';
    return;
  }

  // Tentar vincular por telefone (email fake = telefone@nalinha.app)
  const phoneFromEmail = user.email.replace('@nalinha.app', '');
  if (user.email.endsWith('@nalinha.app') && phoneFromEmail) {
    const { data: pending } = await sb
      .from('barbers')
      .select('id')
      .eq('phone', phoneFromEmail)
      .is('user_id', null)
      .eq('active', true)
      .maybeSingle();

    if (pending) {
      await sb.rpc('link_barber_user', { p_barber_id: pending.id, p_user_id: user.id });
      window.location.href = 'personal.html';
      return;
    }
  }

  window.location.href = 'onboarding.html';
}

// ── Criar conta ───────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  const nome = document.getElementById('signup-nome').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const senha = document.getElementById('signup-senha').value;
  const btn = document.getElementById('btn-signup');

  if (!nome || !email || !senha) {
    showMsg('Preencha todos os campos.', 'error');
    return;
  }

  // BUG 7 ALTO FIX: validar email no signup
  if (!isValidEmail(email)) {
    showMsg('Informe um e-mail válido.', 'error');
    return;
  }

  if (senha.length < 8 || !/\d/.test(senha)) {
    showMsg('A senha deve ter pelo menos 8 caracteres e incluir um número.', 'error');
    return;
  }

  setLoading(btn, true);
  hideMsg();

  const { data, error } = await sb.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome }
    }
  });

  setLoading(btn, false);

  if (error) {
    const msg = error.message.includes('already registered')
      ? 'Este e-mail já está cadastrado. Faça login.'
      : 'Erro ao criar conta. Tente novamente.';
    showMsg(msg, 'error');
    return;
  }

  // Supabase pode exigir confirmacao de e-mail ou nao (depende da config)
  if (data.session) {
    await redirectUser(data.user);
  } else {
    // Precisa confirmar e-mail
    showMsg('Conta criada! Verifique seu e-mail para confirmar.', 'success');
    // Limpar form e voltar pro login
    document.getElementById('form-signup').reset();
    setTimeout(() => switchTab('login'), 3000);
  }
}

// ── Feedback visual ───────────────────────────────────────────
function showMsg(text, type) {
  const el = document.getElementById('auth-msg');
  el.textContent = text;
  el.className = `msg msg-${type} show`;
}

function hideMsg() {
  const el = document.getElementById('auth-msg');
  el.className = 'msg';
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  const label = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.spinner');
  if (label) label.style.display = loading ? 'none' : 'inline';
  if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
}
