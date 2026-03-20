-- ONDA 1: Tabelas para Comandas (v2 — com DROP IF EXISTS)

-- Tabelas
CREATE TABLE IF NOT EXISTS comandas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) NOT NULL,
  barber_id uuid REFERENCES barbers(id),
  client_name text NOT NULL DEFAULT 'Cliente avulso',
  client_phone text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'cancelada')),
  payment_method text CHECK (payment_method IN ('pix', 'dinheiro', 'debito', 'credito')),
  total numeric(10,2) DEFAULT 0,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comanda_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comanda_id uuid REFERENCES comandas(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('servico', 'produto')),
  reference_id uuid,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_items ENABLE ROW LEVEL SECURITY;

-- Limpar policies existentes
DROP POLICY IF EXISTS "comandas_select" ON comandas;
DROP POLICY IF EXISTS "comandas_insert" ON comandas;
DROP POLICY IF EXISTS "comandas_update" ON comandas;
DROP POLICY IF EXISTS "comandas_delete" ON comandas;
DROP POLICY IF EXISTS "comandas_admin" ON comandas;
DROP POLICY IF EXISTS "comandas_admin_select" ON comandas;
DROP POLICY IF EXISTS "comandas_admin_all" ON comandas;
DROP POLICY IF EXISTS "comandas_barber" ON comandas;
DROP POLICY IF EXISTS "comandas_barber_select" ON comandas;
DROP POLICY IF EXISTS "comanda_items_select" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_insert" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_update" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_delete" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_admin" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_admin_select" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_admin_all" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_barber" ON comanda_items;
DROP POLICY IF EXISTS "comanda_items_barber_select" ON comanda_items;

-- Dono vê/edita comandas da barbearia dele
CREATE POLICY "comandas_select" ON comandas FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "comandas_insert" ON comandas FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "comandas_update" ON comandas FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "comandas_delete" ON comandas FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

-- Itens seguem a comanda
CREATE POLICY "comanda_items_select" ON comanda_items FOR SELECT TO authenticated
  USING (comanda_id IN (SELECT id FROM comandas WHERE barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())));
CREATE POLICY "comanda_items_insert" ON comanda_items FOR INSERT TO authenticated
  WITH CHECK (comanda_id IN (SELECT id FROM comandas WHERE barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())));
CREATE POLICY "comanda_items_update" ON comanda_items FOR UPDATE TO authenticated
  USING (comanda_id IN (SELECT id FROM comandas WHERE barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())));
CREATE POLICY "comanda_items_delete" ON comanda_items FOR DELETE TO authenticated
  USING (comanda_id IN (SELECT id FROM comandas WHERE barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())));

-- Admin (Duam) vê tudo
CREATE POLICY "comandas_admin" ON comandas FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'duam-rt@hotmail.com');
CREATE POLICY "comanda_items_admin" ON comanda_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM comandas c WHERE c.id = comanda_id AND auth.jwt() ->> 'email' = 'duam-rt@hotmail.com'));

-- Barbeiros veem comandas da barbearia
CREATE POLICY "comandas_barber" ON comandas FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));
CREATE POLICY "comanda_items_barber" ON comanda_items FOR SELECT TO authenticated
  USING (comanda_id IN (SELECT id FROM comandas WHERE barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid())));

-- Indices
CREATE INDEX IF NOT EXISTS idx_comandas_shop_status ON comandas(barbershop_id, status);
CREATE INDEX IF NOT EXISTS idx_comandas_shop_date ON comandas(barbershop_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_comanda_items_comanda ON comanda_items(comanda_id);
