-- ═══════════════════════════════════════════════
-- LoadPro — Schema Completo
-- SaaS para Personal Trainers
-- ═══════════════════════════════════════════════

-- ══ MÓDULO 1 — GESTÃO DE ALUNOS ══

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('personal','aluno')),
  avatar_url text,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE personals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  telefone text,
  plano text CHECK (plano IN ('starter','pro')),
  status_assinatura text DEFAULT 'trial' CHECK (status_assinatura IN ('trial','ativo','vencido','bloqueado','cancelado')),
  data_vencimento date,
  asaas_customer_id text,
  asaas_subscription_id text,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  personal_id uuid REFERENCES personals(id) ON DELETE CASCADE,
  telefone text,
  data_nascimento date,
  sexo text CHECK (sexo IN ('masculino','feminino')),
  objetivo text,
  nivel text CHECK (nivel IN ('iniciante','intermediario','avancado')),
  status text DEFAULT 'pendente' CHECK (status IN ('ativo','arquivado','pendente')),
  convite_token text UNIQUE,
  aluno_registra_medidas boolean DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE anamnese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid UNIQUE REFERENCES alunos(id) ON DELETE CASCADE,
  historico_saude text,
  lesoes text,
  medicamentos text,
  restricoes_alimentares text,
  alergias text,
  dias_disponiveis text[],
  observacoes text,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- ══ MÓDULO 2 — TREINO ══

CREATE TABLE exercicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid REFERENCES personals(id) ON DELETE CASCADE, -- NULL = exercício global
  nome text NOT NULL,
  grupo_muscular text NOT NULL,
  grupos_secundarios text[],
  descricao text,
  gif_url text,
  equipamento text,
  global boolean DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE rotinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  personal_id uuid REFERENCES personals(id) ON DELETE CASCADE,
  nome text NOT NULL,
  dias_semana text[],
  ativa boolean DEFAULT true,
  duracao_estimada int, -- minutos
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE rotina_exercicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid REFERENCES rotinas(id) ON DELETE CASCADE,
  exercicio_id uuid REFERENCES exercicios(id) ON DELETE SET NULL,
  ordem int NOT NULL,
  series int DEFAULT 3,
  reps_min int DEFAULT 8,
  reps_max int DEFAULT 12,
  carga_sugerida numeric,
  descanso_seg int DEFAULT 60,
  observacoes text
);

CREATE TABLE treino_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  rotina_id uuid REFERENCES rotinas(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  duracao_min int,
  completo boolean DEFAULT false,
  observacoes text,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE treino_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treino_log_id uuid REFERENCES treino_logs(id) ON DELETE CASCADE,
  exercicio_id uuid REFERENCES exercicios(id) ON DELETE SET NULL,
  serie_num int NOT NULL,
  reps int,
  carga numeric,
  concluida boolean DEFAULT false,
  pr boolean DEFAULT false
);

-- ══ MÓDULO 3 — DIETA E NUTRIÇÃO ══

CREATE TABLE planos_dieta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  personal_id uuid REFERENCES personals(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Plano Alimentar',
  tmb numeric,
  get_kcal numeric,
  meta_kcal numeric,
  proteina_g numeric,
  carboidrato_g numeric,
  gordura_g numeric,
  fator_atividade numeric,
  objetivo_dieta text CHECK (objetivo_dieta IN ('deficit','manutencao','superavit')),
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE refeicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid REFERENCES planos_dieta(id) ON DELETE CASCADE,
  nome text NOT NULL, -- ex: Café da Manhã, Almoço
  horario time,
  ordem int,
  descricao text,
  calorias numeric,
  proteina_g numeric,
  carboidrato_g numeric,
  gordura_g numeric
);

CREATE TABLE refeicao_alimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refeicao_id uuid REFERENCES refeicoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  quantidade text, -- ex: "200g", "1 unidade"
  calorias numeric,
  proteina_g numeric,
  carboidrato_g numeric,
  gordura_g numeric
);

CREATE TABLE dieta_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  refeicao_id uuid REFERENCES refeicoes(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  feita boolean DEFAULT false,
  criado_em timestamptz DEFAULT now(),
  UNIQUE(aluno_id, refeicao_id, data)
);

CREATE TABLE agua_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  meta_ml int DEFAULT 3000,
  consumido_ml int DEFAULT 0,
  UNIQUE(aluno_id, data)
);

-- ══ MÓDULO SUPLEMENTAÇÃO ══

CREATE TABLE suplementos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  personal_id uuid REFERENCES personals(id) ON DELETE CASCADE,
  nome text NOT NULL,
  dosagem text,
  horario text,
  dias_uso text CHECK (dias_uso IN ('todos','treino','descanso')),
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE suplemento_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  suplemento_id uuid REFERENCES suplementos(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tomado boolean DEFAULT false,
  UNIQUE(aluno_id, suplemento_id, data)
);

-- ══ MÓDULO 4 — MEDIDAS E AVALIAÇÃO FÍSICA ══

CREATE TABLE medidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  registrado_por uuid REFERENCES users(id),
  data date NOT NULL,
  peso_kg numeric,
  altura_cm numeric,
  gordura_pct numeric,
  massa_muscular_kg numeric,
  imc numeric,
  pescoco_cm numeric,
  ombro_cm numeric,
  peitoral_cm numeric,
  cintura_cm numeric,
  abdomen_cm numeric,
  quadril_cm numeric,
  coxa_d_cm numeric,
  coxa_e_cm numeric,
  panturrilha_d_cm numeric,
  panturrilha_e_cm numeric,
  biceps_d_cm numeric,
  biceps_e_cm numeric,
  observacoes text,
  criado_em timestamptz DEFAULT now()
);

-- ══ MÓDULO AGENDA ══

CREATE TABLE agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid REFERENCES personals(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  dia_semana text NOT NULL CHECK (dia_semana IN ('seg','ter','qua','qui','sex','sab','dom')),
  horario time NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- ══ FOTOS DE PROGRESSO ══

CREATE TABLE fotos_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  url text NOT NULL,
  tipo text CHECK (tipo IN ('frente','costas','lateral_d','lateral_e')),
  data date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  criado_em timestamptz DEFAULT now()
);

-- ══ CHAT ══

CREATE TABLE mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid REFERENCES personals(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES alunos(id) ON DELETE CASCADE,
  remetente_id uuid REFERENCES users(id),
  texto text NOT NULL,
  lida boolean DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

-- ══ INDEXES ══

CREATE INDEX idx_alunos_personal ON alunos(personal_id);
CREATE INDEX idx_alunos_status ON alunos(status);
CREATE INDEX idx_rotinas_aluno ON rotinas(aluno_id);
CREATE INDEX idx_treino_logs_aluno ON treino_logs(aluno_id);
CREATE INDEX idx_treino_logs_data ON treino_logs(data);
CREATE INDEX idx_treino_series_log ON treino_series(treino_log_id);
CREATE INDEX idx_medidas_aluno ON medidas(aluno_id);
CREATE INDEX idx_medidas_data ON medidas(data);
CREATE INDEX idx_dieta_checklist_aluno_data ON dieta_checklist(aluno_id, data);
CREATE INDEX idx_agua_log_aluno_data ON agua_log(aluno_id, data);
CREATE INDEX idx_mensagens_personal ON mensagens(personal_id);
CREATE INDEX idx_mensagens_aluno ON mensagens(aluno_id);
CREATE INDEX idx_exercicios_global ON exercicios(global);
CREATE INDEX idx_agenda_personal ON agenda(personal_id);

-- ══ RLS ══

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE personals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnese ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotina_exercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE treino_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE treino_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_dieta ENABLE ROW LEVEL SECURITY;
ALTER TABLE refeicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE refeicao_alimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dieta_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE agua_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE suplementos ENABLE ROW LEVEL SECURITY;
ALTER TABLE suplemento_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE medidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

-- Helper: retorna personal_id do usuário logado
CREATE OR REPLACE FUNCTION auth_personal_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT p.id FROM personals p
  JOIN users u ON u.id = p.user_id
  WHERE u.auth_id = auth.uid()
$$;

-- Helper: retorna aluno_id do usuário logado
CREATE OR REPLACE FUNCTION auth_aluno_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT a.id FROM alunos a
  JOIN users u ON u.id = a.user_id
  WHERE u.auth_id = auth.uid()
$$;

-- Helper: checa se aluno pertence ao personal logado
CREATE OR REPLACE FUNCTION aluno_do_personal(p_aluno_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM alunos
    WHERE id = p_aluno_id AND personal_id = auth_personal_id()
  )
$$;

-- ═══ POLICIES ═══

-- users
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth_id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth_id = auth.uid());

-- personals
CREATE POLICY "personals_select_own" ON personals FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "personals_update_own" ON personals FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- alunos
CREATE POLICY "alunos_personal_select" ON alunos FOR SELECT USING (personal_id = auth_personal_id());
CREATE POLICY "alunos_personal_insert" ON alunos FOR INSERT WITH CHECK (personal_id = auth_personal_id());
CREATE POLICY "alunos_personal_update" ON alunos FOR UPDATE USING (personal_id = auth_personal_id());
CREATE POLICY "alunos_personal_delete" ON alunos FOR DELETE USING (personal_id = auth_personal_id());
CREATE POLICY "alunos_self_select" ON alunos FOR SELECT USING (id = auth_aluno_id());

-- anamnese
CREATE POLICY "anamnese_personal" ON anamnese FOR ALL USING (aluno_do_personal(aluno_id));
CREATE POLICY "anamnese_aluno" ON anamnese FOR SELECT USING (aluno_id = auth_aluno_id());

-- exercicios (globais + do personal)
CREATE POLICY "exercicios_select" ON exercicios FOR SELECT USING (global = true OR personal_id = auth_personal_id());
CREATE POLICY "exercicios_personal_insert" ON exercicios FOR INSERT WITH CHECK (personal_id = auth_personal_id());
CREATE POLICY "exercicios_personal_update" ON exercicios FOR UPDATE USING (personal_id = auth_personal_id());
CREATE POLICY "exercicios_personal_delete" ON exercicios FOR DELETE USING (personal_id = auth_personal_id());

-- rotinas
CREATE POLICY "rotinas_personal" ON rotinas FOR ALL USING (personal_id = auth_personal_id());
CREATE POLICY "rotinas_aluno" ON rotinas FOR SELECT USING (aluno_id = auth_aluno_id());

-- rotina_exercicios
CREATE POLICY "rotina_ex_personal" ON rotina_exercicios FOR ALL
  USING (rotina_id IN (SELECT id FROM rotinas WHERE personal_id = auth_personal_id()));
CREATE POLICY "rotina_ex_aluno" ON rotina_exercicios FOR SELECT
  USING (rotina_id IN (SELECT id FROM rotinas WHERE aluno_id = auth_aluno_id()));

-- treino_logs
CREATE POLICY "treino_logs_personal" ON treino_logs FOR SELECT USING (aluno_do_personal(aluno_id));
CREATE POLICY "treino_logs_aluno" ON treino_logs FOR ALL USING (aluno_id = auth_aluno_id());

-- treino_series
CREATE POLICY "treino_series_personal" ON treino_series FOR SELECT
  USING (treino_log_id IN (SELECT id FROM treino_logs WHERE aluno_do_personal(aluno_id)));
CREATE POLICY "treino_series_aluno" ON treino_series FOR ALL
  USING (treino_log_id IN (SELECT id FROM treino_logs WHERE aluno_id = auth_aluno_id()));

-- planos_dieta
CREATE POLICY "dieta_personal" ON planos_dieta FOR ALL USING (personal_id = auth_personal_id());
CREATE POLICY "dieta_aluno" ON planos_dieta FOR SELECT USING (aluno_id = auth_aluno_id());

-- refeicoes
CREATE POLICY "refeicoes_personal" ON refeicoes FOR ALL
  USING (plano_id IN (SELECT id FROM planos_dieta WHERE personal_id = auth_personal_id()));
CREATE POLICY "refeicoes_aluno" ON refeicoes FOR SELECT
  USING (plano_id IN (SELECT id FROM planos_dieta WHERE aluno_id = auth_aluno_id()));

-- refeicao_alimentos
CREATE POLICY "alimentos_personal" ON refeicao_alimentos FOR ALL
  USING (refeicao_id IN (SELECT id FROM refeicoes WHERE plano_id IN (SELECT id FROM planos_dieta WHERE personal_id = auth_personal_id())));
CREATE POLICY "alimentos_aluno" ON refeicao_alimentos FOR SELECT
  USING (refeicao_id IN (SELECT id FROM refeicoes WHERE plano_id IN (SELECT id FROM planos_dieta WHERE aluno_id = auth_aluno_id())));

-- dieta_checklist
CREATE POLICY "checklist_personal" ON dieta_checklist FOR SELECT USING (aluno_do_personal(aluno_id));
CREATE POLICY "checklist_aluno" ON dieta_checklist FOR ALL USING (aluno_id = auth_aluno_id());

-- agua_log
CREATE POLICY "agua_personal" ON agua_log FOR SELECT USING (aluno_do_personal(aluno_id));
CREATE POLICY "agua_aluno" ON agua_log FOR ALL USING (aluno_id = auth_aluno_id());

-- suplementos
CREATE POLICY "suplementos_personal" ON suplementos FOR ALL USING (personal_id = auth_personal_id());
CREATE POLICY "suplementos_aluno" ON suplementos FOR SELECT USING (aluno_id = auth_aluno_id());

-- suplemento_checklist
CREATE POLICY "sup_check_personal" ON suplemento_checklist FOR SELECT USING (aluno_do_personal(aluno_id));
CREATE POLICY "sup_check_aluno" ON suplemento_checklist FOR ALL USING (aluno_id = auth_aluno_id());

-- medidas
CREATE POLICY "medidas_personal" ON medidas FOR ALL USING (aluno_do_personal(aluno_id));
CREATE POLICY "medidas_aluno_select" ON medidas FOR SELECT USING (aluno_id = auth_aluno_id());
CREATE POLICY "medidas_aluno_insert" ON medidas FOR INSERT
  WITH CHECK (
    aluno_id = auth_aluno_id()
    AND EXISTS(SELECT 1 FROM alunos WHERE id = aluno_id AND aluno_registra_medidas = true)
  );

-- agenda
CREATE POLICY "agenda_personal" ON agenda FOR ALL USING (personal_id = auth_personal_id());
CREATE POLICY "agenda_aluno" ON agenda FOR SELECT USING (aluno_id = auth_aluno_id());

-- fotos_progresso
CREATE POLICY "fotos_personal" ON fotos_progresso FOR ALL USING (aluno_do_personal(aluno_id));
CREATE POLICY "fotos_aluno" ON fotos_progresso FOR ALL USING (aluno_id = auth_aluno_id());

-- mensagens
CREATE POLICY "msgs_personal" ON mensagens FOR ALL USING (personal_id = auth_personal_id());
CREATE POLICY "msgs_aluno" ON mensagens FOR ALL USING (aluno_id = auth_aluno_id());

-- ══ STORAGE BUCKETS ══
-- Criar via dashboard ou API:
-- avatars (public)
-- exercicios-gifs (public)
-- fotos-progresso (private, RLS por aluno)
