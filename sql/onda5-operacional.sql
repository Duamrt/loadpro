-- =============================================
-- ONDA 5 — OPERACIONAL AVANCADO (NaRegua SaaS)
-- Lista de Espera + Combos de Servicos
-- Rodar no Supabase SQL Editor
-- =============================================


-- =============================================
-- 1. LISTA_ESPERA (fila de walk-in)
-- =============================================

CREATE TABLE IF NOT EXISTS lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES barbers(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT 'Cliente',
  client_phone text,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  position int NOT NULL,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'chamado', 'atendido', 'desistiu')),
  notes text,
  entered_at timestamptz DEFAULT now(),
  called_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lista_espera ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lista_espera_shop_status ON lista_espera(barbershop_id, status);
CREATE INDEX IF NOT EXISTS idx_lista_espera_position ON lista_espera(barbershop_id, position);
CREATE INDEX IF NOT EXISTS idx_lista_espera_entered ON lista_espera(barbershop_id, entered_at);

COMMENT ON TABLE lista_espera IS 'Fila de espera walk-in — posicao na fila, barbeiro preferido, status do atendimento';

-- RLS lista_espera
DROP POLICY IF EXISTS "lista_espera_owner_all" ON lista_espera;
CREATE POLICY "lista_espera_owner_all" ON lista_espera FOR ALL
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "lista_espera_admin_all" ON lista_espera;
CREATE POLICY "lista_espera_admin_all" ON lista_espera FOR ALL
  USING (auth.jwt()->>'email' = 'duam-rt@hotmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "lista_espera_barber_select" ON lista_espera;
CREATE POLICY "lista_espera_barber_select" ON lista_espera FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));

-- Barbeiro pode inserir na fila (adicionar cliente walk-in)
DROP POLICY IF EXISTS "lista_espera_barber_insert" ON lista_espera;
CREATE POLICY "lista_espera_barber_insert" ON lista_espera FOR INSERT
  WITH CHECK (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));

-- Barbeiro pode atualizar status (chamar, marcar atendido, desistiu)
DROP POLICY IF EXISTS "lista_espera_barber_update" ON lista_espera;
CREATE POLICY "lista_espera_barber_update" ON lista_espera FOR UPDATE
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- 2. COMBOS (pacotes de servicos)
-- =============================================

CREATE TABLE IF NOT EXISTS combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  duration int,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_combos_barbershop ON combos(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_combos_active ON combos(barbershop_id, active);

COMMENT ON TABLE combos IS 'Combos de servicos — ex: Cabelo+Barba com preco promocional';

-- RLS combos
DROP POLICY IF EXISTS "combos_owner_all" ON combos;
CREATE POLICY "combos_owner_all" ON combos FOR ALL
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "combos_admin_all" ON combos;
CREATE POLICY "combos_admin_all" ON combos FOR ALL
  USING (auth.jwt()->>'email' = 'duam-rt@hotmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "combos_barber_select" ON combos;
CREATE POLICY "combos_barber_select" ON combos FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- 3. COMBO_SERVICES (servicos dentro do combo)
-- =============================================

CREATE TABLE IF NOT EXISTS combo_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(combo_id, service_id)
);

ALTER TABLE combo_services ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_combo_services_combo ON combo_services(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_services_service ON combo_services(service_id);

COMMENT ON TABLE combo_services IS 'Relacao N:N entre combos e services';

-- RLS combo_services (herda acesso via combo → barbershop)
DROP POLICY IF EXISTS "combo_services_owner_all" ON combo_services;
CREATE POLICY "combo_services_owner_all" ON combo_services FOR ALL
  USING (combo_id IN (SELECT id FROM combos WHERE barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())))
  WITH CHECK (combo_id IN (SELECT id FROM combos WHERE barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())));

DROP POLICY IF EXISTS "combo_services_admin_all" ON combo_services;
CREATE POLICY "combo_services_admin_all" ON combo_services FOR ALL
  USING (auth.jwt()->>'email' = 'duam-rt@hotmail.com')
  WITH CHECK (auth.jwt()->>'email' = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "combo_services_barber_select" ON combo_services;
CREATE POLICY "combo_services_barber_select" ON combo_services FOR SELECT
  USING (combo_id IN (SELECT id FROM combos WHERE barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid())));


-- =============================================
-- VIEW: Fila ativa (apenas aguardando/chamado)
-- =============================================

CREATE OR REPLACE VIEW vw_lista_espera_ativa AS
SELECT
  le.id,
  le.barbershop_id,
  le.barber_id,
  b.name AS barber_name,
  le.client_name,
  le.client_phone,
  le.service_id,
  s.name AS service_name,
  le.position,
  le.status,
  le.notes,
  le.entered_at,
  le.called_at,
  EXTRACT(EPOCH FROM (now() - le.entered_at))::int / 60 AS minutos_esperando
FROM lista_espera le
LEFT JOIN barbers b ON b.id = le.barber_id
LEFT JOIN services s ON s.id = le.service_id
WHERE le.status IN ('aguardando', 'chamado')
ORDER BY le.barbershop_id, le.position;


-- =============================================
-- VIEW: Combos com servicos e economia
-- =============================================

CREATE OR REPLACE VIEW vw_combos_detalhado AS
SELECT
  c.id AS combo_id,
  c.barbershop_id,
  c.name AS combo_name,
  c.description,
  c.price AS combo_price,
  c.duration AS combo_duration,
  c.active,
  COALESCE(SUM(s.price), 0) AS soma_servicos,
  COALESCE(SUM(s.price), 0) - c.price AS economia,
  COUNT(cs.service_id) AS total_servicos
FROM combos c
LEFT JOIN combo_services cs ON cs.combo_id = c.id
LEFT JOIN services s ON s.id = cs.service_id
GROUP BY c.id, c.barbershop_id, c.name, c.description, c.price, c.duration, c.active;
