-- =============================================
-- ONDA 3 — RETENCAO (NaRegua SaaS)
-- Pesquisa de Satisfacao + Aniversariantes
-- =============================================

-- 1. CLIENTS (perfis consolidados)
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  birthday date,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(barbershop_id, phone)
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_clients_barbershop ON clients(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(barbershop_id, phone);
CREATE INDEX IF NOT EXISTS idx_clients_birthday ON clients(barbershop_id, birthday);

-- RLS clients
DROP POLICY IF EXISTS "clients_owner_all" ON clients;
CREATE POLICY "clients_owner_all" ON clients FOR ALL
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "clients_admin_all" ON clients;
CREATE POLICY "clients_admin_all" ON clients FOR ALL
  USING (auth.jwt()->>'email' = 'duam-rt@hotmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "clients_barber_select" ON clients;
CREATE POLICY "clients_barber_select" ON clients FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- 2. PESQUISAS_SATISFACAO (templates de pesquisa)
CREATE TABLE IF NOT EXISTS pesquisas_satisfacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Pesquisa padrão',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pesquisas_satisfacao ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pesquisas_barbershop ON pesquisas_satisfacao(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_pesquisas_active ON pesquisas_satisfacao(barbershop_id, active);

-- RLS pesquisas_satisfacao
DROP POLICY IF EXISTS "pesquisas_owner_all" ON pesquisas_satisfacao;
CREATE POLICY "pesquisas_owner_all" ON pesquisas_satisfacao FOR ALL
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pesquisas_admin_all" ON pesquisas_satisfacao;
CREATE POLICY "pesquisas_admin_all" ON pesquisas_satisfacao FOR ALL
  USING (auth.jwt()->>'email' = 'duam-rt@hotmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "pesquisas_barber_select" ON pesquisas_satisfacao;
CREATE POLICY "pesquisas_barber_select" ON pesquisas_satisfacao FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- 3. RESPOSTAS_SATISFACAO (respostas dos clientes)
CREATE TABLE IF NOT EXISTS respostas_satisfacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesquisa_id uuid NOT NULL REFERENCES pesquisas_satisfacao(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  barber_id uuid REFERENCES barbers(id) ON DELETE SET NULL,
  client_name text,
  client_phone text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  responded_at timestamptz DEFAULT now()
);

ALTER TABLE respostas_satisfacao ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_respostas_barbershop ON respostas_satisfacao(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_respostas_pesquisa ON respostas_satisfacao(pesquisa_id);
CREATE INDEX IF NOT EXISTS idx_respostas_barber ON respostas_satisfacao(barbershop_id, barber_id);
CREATE INDEX IF NOT EXISTS idx_respostas_rating ON respostas_satisfacao(barbershop_id, rating);
CREATE INDEX IF NOT EXISTS idx_respostas_responded ON respostas_satisfacao(barbershop_id, responded_at);

-- RLS respostas_satisfacao
DROP POLICY IF EXISTS "respostas_owner_all" ON respostas_satisfacao;
CREATE POLICY "respostas_owner_all" ON respostas_satisfacao FOR ALL
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "respostas_admin_all" ON respostas_satisfacao;
CREATE POLICY "respostas_admin_all" ON respostas_satisfacao FOR ALL
  USING (auth.jwt()->>'email' = 'duam-rt@hotmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "respostas_barber_select" ON respostas_satisfacao;
CREATE POLICY "respostas_barber_select" ON respostas_satisfacao FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));

-- INSERT publico (anon) para clientes responderem sem login
DROP POLICY IF EXISTS "respostas_anon_insert" ON respostas_satisfacao;
CREATE POLICY "respostas_anon_insert" ON respostas_satisfacao FOR INSERT TO anon
  WITH CHECK (true);


-- =============================================
-- VIEWS UTEIS
-- =============================================

-- Aniversariantes do mes (consulta na clients)
CREATE OR REPLACE VIEW vw_aniversariantes_mes AS
SELECT
  c.id,
  c.barbershop_id,
  c.name,
  c.phone,
  c.birthday,
  EXTRACT(DAY FROM c.birthday)::int AS dia,
  EXTRACT(MONTH FROM c.birthday)::int AS mes
FROM clients c
WHERE c.birthday IS NOT NULL
  AND EXTRACT(MONTH FROM c.birthday) = EXTRACT(MONTH FROM CURRENT_DATE);

-- Clientes sem retorno (ultima visita via appointments)
CREATE OR REPLACE VIEW vw_clientes_sem_retorno AS
SELECT
  c.id AS client_id,
  c.barbershop_id,
  c.name,
  c.phone,
  MAX(a.scheduled_at) AS ultima_visita,
  CURRENT_DATE - MAX(a.scheduled_at)::date AS dias_sem_retorno
FROM clients c
LEFT JOIN appointments a
  ON a.barbershop_id = c.barbershop_id
  AND a.client_phone = c.phone
  AND a.status = 'completed'
GROUP BY c.id, c.barbershop_id, c.name, c.phone
HAVING MAX(a.scheduled_at) IS NULL
   OR CURRENT_DATE - MAX(a.scheduled_at)::date >= 30;

-- Media de avaliacao por barbeiro
CREATE OR REPLACE VIEW vw_media_avaliacao_barbeiro AS
SELECT
  r.barbershop_id,
  r.barber_id,
  b.name AS barber_name,
  COUNT(*) AS total_respostas,
  ROUND(AVG(r.rating), 1) AS media_rating
FROM respostas_satisfacao r
JOIN barbers b ON b.id = r.barber_id
GROUP BY r.barbershop_id, r.barber_id, b.name;
