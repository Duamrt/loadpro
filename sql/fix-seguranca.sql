-- ═══════════════════════════════════════════════
-- LoadPro — Correções de Segurança (Auditoria)
-- Rodar no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- 1. RESTRINGIR UPDATE do personal (não pode mudar plano/status)
-- Personal só pode editar telefone, não pode mudar plano/status/vencimento
DROP POLICY IF EXISTS "personals_update_own" ON personals;
CREATE POLICY "personals_update_own" ON personals FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (
    -- Só permite se plano, status e vencimento NÃO mudaram
    plano = (SELECT plano FROM personals WHERE id = personals.id)
    AND status_assinatura = (SELECT status_assinatura FROM personals WHERE id = personals.id)
    AND data_vencimento = (SELECT data_vencimento FROM personals WHERE id = personals.id)
  );

-- 2. TRIGGER para limite de alunos por plano (server-side)
CREATE OR REPLACE FUNCTION validar_limite_alunos() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  limite int;
  total int;
BEGIN
  SELECT CASE WHEN plano = 'pro' THEN 20 ELSE 10 END INTO limite
  FROM personals WHERE id = NEW.personal_id;

  SELECT count(*) INTO total
  FROM alunos WHERE personal_id = NEW.personal_id AND status = 'ativo';

  IF total >= limite THEN
    RAISE EXCEPTION 'Limite de alunos do plano atingido (% de %)', total, limite;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_limite_alunos ON alunos;
CREATE TRIGGER trg_limite_alunos
  BEFORE INSERT ON alunos
  FOR EACH ROW
  EXECUTE FUNCTION validar_limite_alunos();

-- 3. FORÇAR global=false no insert de exercícios pelo personal
DROP POLICY IF EXISTS "exercicios_personal_insert" ON exercicios;
CREATE POLICY "exercicios_personal_insert" ON exercicios FOR INSERT
  WITH CHECK (personal_id = auth_personal_id() AND global = false);

-- 4. POLICY para aluno ver seu personal (faltava)
CREATE POLICY "personals_aluno_select" ON personals FOR SELECT
  USING (id IN (SELECT personal_id FROM alunos WHERE id = auth_aluno_id()));

-- 5. POLICY para convite anônimo (aluno aceitar convite sem login)
CREATE POLICY "alunos_convite_anon" ON alunos FOR SELECT TO anon
  USING (convite_token IS NOT NULL AND status = 'pendente');

-- 6. Permitir anon ler personal do aluno pendente (pra tela de convite)
CREATE POLICY "personals_convite_anon" ON personals FOR SELECT TO anon
  USING (id IN (SELECT personal_id FROM alunos WHERE convite_token IS NOT NULL AND status = 'pendente'));

-- 7. Permitir anon ler nome do personal (users) na tela de convite
CREATE POLICY "users_convite_anon" ON users FOR SELECT TO anon
  USING (id IN (
    SELECT user_id FROM personals WHERE id IN (
      SELECT personal_id FROM alunos WHERE convite_token IS NOT NULL AND status = 'pendente'
    )
  ));

-- 8. RPC ATÔMICA para cadastro de personal (evita dados órfãos)
CREATE OR REPLACE FUNCTION criar_conta_personal(
  p_auth_id uuid,
  p_email text,
  p_nome text,
  p_telefone text,
  p_plano text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_personal_id uuid;
  v_vencimento date;
BEGIN
  -- Calcular vencimento trial (7 dias)
  v_vencimento := CURRENT_DATE + INTERVAL '7 days';

  -- Criar user
  INSERT INTO users (auth_id, email, nome, tipo)
  VALUES (p_auth_id, p_email, p_nome, 'personal')
  RETURNING id INTO v_user_id;

  -- Criar personal
  INSERT INTO personals (user_id, telefone, plano, status_assinatura, data_vencimento)
  VALUES (v_user_id, p_telefone, p_plano, 'trial', v_vencimento)
  RETURNING id INTO v_personal_id;

  RETURN v_personal_id;
END $$;
