// LoadPro — casca: alterna login x painel, navegação, e orquestra os módulos.
// app.js é o ÚLTIMO script a carregar; os módulos (hydration, etc.) já estão registrados quando ele roda.
(function () {
  var authView = document.getElementById('auth-view');
  var appView = document.getElementById('app-view');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var logoutBtn = document.getElementById('logout-btn');

  // pré-preenche o último e-mail usado (sem hardcode no HTML público)
  try {
    var savedEmail = localStorage.getItem('lp_email');
    if (savedEmail) {
      var emailField = document.getElementById('login-email');
      if (emailField) emailField.value = savedEmail;
    }
  } catch (e) {}

  function showApp(show) {
    authView.hidden = show;
    appView.hidden = !show;
  }

  function navigate(screenId) {
    var screens = document.querySelectorAll('.screen');
    var i;
    for (i = 0; i < screens.length; i++) {
      screens[i].classList.toggle('active', screens[i].id === 'screen-' + screenId);
    }
    var navItems = document.querySelectorAll('[data-screen]');
    for (i = 0; i < navItems.length; i++) {
      navItems[i].classList.toggle('active', navItems[i].dataset.screen === screenId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startModules() {
    if (window.LP.hydration) window.LP.hydration.start();
    if (window.LP.weight) window.LP.weight.start();
    if (window.LP.workout) window.LP.workout.start();
    if (window.LP.diet) window.LP.diet.start();
  }

  var navButtons = document.querySelectorAll('[data-screen]');
  for (var n = 0; n < navButtons.length; n++) {
    (function (btn) {
      btn.addEventListener('click', function () { navigate(btn.dataset.screen); });
    })(navButtons[n]);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      loginError.textContent = '';
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'entrando...';
      try {
        var res = await window.LP.auth.signIn(email, password);
        if (res.error) {
          loginError.textContent = 'Não foi possível entrar. Confira e-mail e senha.';
          return;
        }
        try { localStorage.setItem('lp_email', email); } catch (e2) {}
        window.LP.user = res.data.user;
        showApp(true);
        navigate('dashboard');
        startModules();
      } catch (err) {
        loginError.textContent = 'Erro de conexão. Tente de novo.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'entrar no painel';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      try { await window.LP.auth.signOut(); } catch (e) {}
      showApp(false);
    });
  }

  (async function init() {
    var session = null;
    try {
      session = await window.LP.auth.currentSession();
    } catch (e) {}
    showApp(!!session);
    if (session) {
      window.LP.user = session.user;
      navigate('dashboard');
      startModules();
    }
  })();
})();
