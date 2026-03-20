-- =============================================
-- ONDA 2 — RECEITA RECORRENTE
-- NaRegua SaaS · Supabase/PostgreSQL
-- Pacotes, Assinaturas (Clubes), Cupons
-- =============================================

-- =============================================
-- 1. PACOTES (ex: "5 Cortes por R$100")
-- =============================================
CREATE TABLE IF NOT EXISTS pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pacotes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pacotes_barbershop ON pacotes(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_pacotes_service ON pacotes(service_id);
CREATE INDEX IF NOT EXISTS idx_pacotes_active ON pacotes(barbershop_id, active);

-- Policies: pacotes
DROP POLICY IF EXISTS "pacotes_owner_select" ON pacotes;
CREATE POLICY "pacotes_owner_select" ON pacotes FOR SELECT
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacotes_owner_insert" ON pacotes;
CREATE POLICY "pacotes_owner_insert" ON pacotes FOR INSERT
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacotes_owner_update" ON pacotes;
CREATE POLICY "pacotes_owner_update" ON pacotes FOR UPDATE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacotes_owner_delete" ON pacotes;
CREATE POLICY "pacotes_owner_delete" ON pacotes FOR DELETE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacotes_admin_all" ON pacotes;
CREATE POLICY "pacotes_admin_all" ON pacotes FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "pacotes_barber_select" ON pacotes;
CREATE POLICY "pacotes_barber_select" ON pacotes FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- 2. PACOTE_VENDAS (venda de pacote ao cliente)
-- =============================================
CREATE TABLE IF NOT EXISTS pacote_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id uuid NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_phone text,
  uses_remaining int NOT NULL CHECK (uses_remaining >= 0),
  uses_total int NOT NULL CHECK (uses_total > 0),
  payment_method text CHECK (payment_method IN ('pix', 'dinheiro', 'debito', 'credito')),
  sold_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'esgotado', 'expirado', 'cancelado')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pacote_vendas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pacote_vendas_barbershop ON pacote_vendas(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_pacote_vendas_pacote ON pacote_vendas(pacote_id);
CREATE INDEX IF NOT EXISTS idx_pacote_vendas_status ON pacote_vendas(barbershop_id, status);
CREATE INDEX IF NOT EXISTS idx_pacote_vendas_client ON pacote_vendas(barbershop_id, client_phone);

-- Policies: pacote_vendas
DROP POLICY IF EXISTS "pacote_vendas_owner_select" ON pacote_vendas;
CREATE POLICY "pacote_vendas_owner_select" ON pacote_vendas FOR SELECT
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacote_vendas_owner_insert" ON pacote_vendas;
CREATE POLICY "pacote_vendas_owner_insert" ON pacote_vendas FOR INSERT
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacote_vendas_owner_update" ON pacote_vendas;
CREATE POLICY "pacote_vendas_owner_update" ON pacote_vendas FOR UPDATE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacote_vendas_owner_delete" ON pacote_vendas;
CREATE POLICY "pacote_vendas_owner_delete" ON pacote_vendas FOR DELETE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "pacote_vendas_admin_all" ON pacote_vendas;
CREATE POLICY "pacote_vendas_admin_all" ON pacote_vendas FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "pacote_vendas_barber_select" ON pacote_vendas;
CREATE POLICY "pacote_vendas_barber_select" ON pacote_vendas FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- 3. ASSINATURAS (clubes — ex: "Mensal R$80")
-- =============================================
CREATE TABLE IF NOT EXISTS assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  max_uses int CHECK (max_uses IS NULL OR max_uses > 0),
  services jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assinaturas_barbershop ON assinaturas(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_active ON assinaturas(barbershop_id, active);

-- Policies: assinaturas
DROP POLICY IF EXISTS "assinaturas_owner_select" ON assinaturas;
CREATE POLICY "assinaturas_owner_select" ON assinaturas FOR SELECT
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinaturas_owner_insert" ON assinaturas;
CREATE POLICY "assinaturas_owner_insert" ON assinaturas FOR INSERT
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinaturas_owner_update" ON assinaturas;
CREATE POLICY "assinaturas_owner_update" ON assinaturas FOR UPDATE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinaturas_owner_delete" ON assinaturas;
CREATE POLICY "assinaturas_owner_delete" ON assinaturas FOR DELETE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinaturas_admin_all" ON assinaturas;
CREATE POLICY "assinaturas_admin_all" ON assinaturas FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "assinaturas_barber_select" ON assinaturas;
CREATE POLICY "assinaturas_barber_select" ON assinaturas FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- 4. ASSINATURA_CLIENTES (cliente assinante)
-- =============================================
CREATE TABLE IF NOT EXISTS assinatura_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_phone text,
  payment_method text CHECK (payment_method IN ('pix', 'dinheiro', 'debito', 'credito')),
  uses_this_month int DEFAULT 0,
  status text DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'vencida')),
  started_at timestamptz DEFAULT now(),
  next_payment timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assinatura_clientes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assinatura_clientes_barbershop ON assinatura_clientes(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_assinatura_clientes_assinatura ON assinatura_clientes(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_assinatura_clientes_status ON assinatura_clientes(barbershop_id, status);
CREATE INDEX IF NOT EXISTS idx_assinatura_clientes_client ON assinatura_clientes(barbershop_id, client_phone);
CREATE INDEX IF NOT EXISTS idx_assinatura_clientes_next_payment ON assinatura_clientes(next_payment) WHERE status = 'ativa';

-- Policies: assinatura_clientes
DROP POLICY IF EXISTS "assinatura_clientes_owner_select" ON assinatura_clientes;
CREATE POLICY "assinatura_clientes_owner_select" ON assinatura_clientes FOR SELECT
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinatura_clientes_owner_insert" ON assinatura_clientes;
CREATE POLICY "assinatura_clientes_owner_insert" ON assinatura_clientes FOR INSERT
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinatura_clientes_owner_update" ON assinatura_clientes;
CREATE POLICY "assinatura_clientes_owner_update" ON assinatura_clientes FOR UPDATE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinatura_clientes_owner_delete" ON assinatura_clientes;
CREATE POLICY "assinatura_clientes_owner_delete" ON assinatura_clientes FOR DELETE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "assinatura_clientes_admin_all" ON assinatura_clientes;
CREATE POLICY "assinatura_clientes_admin_all" ON assinatura_clientes FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "assinatura_clientes_barber_select" ON assinatura_clientes;
CREATE POLICY "assinatura_clientes_barber_select" ON assinatura_clientes FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- 5. CUPONS (cupons de desconto)
-- =============================================
CREATE TABLE IF NOT EXISTS cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentual', 'fixo')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  max_uses int CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count int DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(barbershop_id, code)
);

ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cupons_barbershop ON cupons(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_cupons_code ON cupons(barbershop_id, code);
CREATE INDEX IF NOT EXISTS idx_cupons_active ON cupons(barbershop_id, active);

-- Policies: cupons
DROP POLICY IF EXISTS "cupons_owner_select" ON cupons;
CREATE POLICY "cupons_owner_select" ON cupons FOR SELECT
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupons_owner_insert" ON cupons;
CREATE POLICY "cupons_owner_insert" ON cupons FOR INSERT
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupons_owner_update" ON cupons;
CREATE POLICY "cupons_owner_update" ON cupons FOR UPDATE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupons_owner_delete" ON cupons;
CREATE POLICY "cupons_owner_delete" ON cupons FOR DELETE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupons_admin_all" ON cupons;
CREATE POLICY "cupons_admin_all" ON cupons FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "cupons_barber_select" ON cupons;
CREATE POLICY "cupons_barber_select" ON cupons FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- 6. CUPOM_USOS (rastreio de uso de cupom)
-- =============================================
CREATE TABLE IF NOT EXISTS cupom_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid NOT NULL REFERENCES cupons(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_name text,
  client_phone text,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  discount_applied numeric(10,2) NOT NULL CHECK (discount_applied > 0),
  used_at timestamptz DEFAULT now()
);

ALTER TABLE cupom_usos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cupom_usos_barbershop ON cupom_usos(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_cupom_usos_cupom ON cupom_usos(cupom_id);
CREATE INDEX IF NOT EXISTS idx_cupom_usos_appointment ON cupom_usos(appointment_id);
CREATE INDEX IF NOT EXISTS idx_cupom_usos_client ON cupom_usos(barbershop_id, client_phone);

-- Policies: cupom_usos
DROP POLICY IF EXISTS "cupom_usos_owner_select" ON cupom_usos;
CREATE POLICY "cupom_usos_owner_select" ON cupom_usos FOR SELECT
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupom_usos_owner_insert" ON cupom_usos;
CREATE POLICY "cupom_usos_owner_insert" ON cupom_usos FOR INSERT
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupom_usos_owner_update" ON cupom_usos;
CREATE POLICY "cupom_usos_owner_update" ON cupom_usos FOR UPDATE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupom_usos_owner_delete" ON cupom_usos;
CREATE POLICY "cupom_usos_owner_delete" ON cupom_usos FOR DELETE
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "cupom_usos_admin_all" ON cupom_usos;
CREATE POLICY "cupom_usos_admin_all" ON cupom_usos FOR ALL
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'duam-rt@hotmail.com');

DROP POLICY IF EXISTS "cupom_usos_barber_select" ON cupom_usos;
CREATE POLICY "cupom_usos_barber_select" ON cupom_usos FOR SELECT
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));


-- =============================================
-- COMMENTS (documentação das tabelas)
-- =============================================
COMMENT ON TABLE pacotes IS 'Pacotes de serviços (ex: 5 cortes por R$100)';
COMMENT ON TABLE pacote_vendas IS 'Vendas de pacotes — controle de usos restantes';
COMMENT ON TABLE assinaturas IS 'Planos de assinatura/clube mensal';
COMMENT ON TABLE assinatura_clientes IS 'Clientes assinantes ativos';
COMMENT ON TABLE cupons IS 'Cupons de desconto por barbearia';
COMMENT ON TABLE cupom_usos IS 'Registro de uso de cupons';
