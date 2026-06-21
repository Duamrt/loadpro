// LoadPro — autenticação via Supabase Auth (projeto 3DR).
// A RLS das tabelas lp_ isola os dados por usuário (auth.uid() = user_id),
// então mesmo o Auth sendo compartilhado, cada login só enxerga os próprios dados.
(function () {
  var cfg = window.LP_CONFIG;
  var sb = window.supabase.createClient(cfg.url, cfg.anonKey);

  window.LP = window.LP || {};
  window.LP.sb = sb;

  async function currentSession() {
    var res = await sb.auth.getSession();
    return res.data.session;
  }

  async function signIn(email, password) {
    return sb.auth.signInWithPassword({ email: email, password: password });
  }

  async function signOut() {
    return sb.auth.signOut();
  }

  window.LP.auth = {
    currentSession: currentSession,
    signIn: signIn,
    signOut: signOut
  };
})();
