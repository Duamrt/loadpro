-- ONDA 6: Promoções/Broadcast
-- Rodar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS promocoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) NOT NULL,
  title text,
  message text,
  recipient_filter jsonb,
  recipient_count int DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promocoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promocoes_select" ON promocoes;
DROP POLICY IF EXISTS "promocoes_insert" ON promocoes;
DROP POLICY IF EXISTS "promocoes_update" ON promocoes;
DROP POLICY IF EXISTS "promocoes_delete" ON promocoes;
DROP POLICY IF EXISTS "promocoes_admin" ON promocoes;
DROP POLICY IF EXISTS "promocoes_barber" ON promocoes;

CREATE POLICY "promocoes_select" ON promocoes FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "promocoes_insert" ON promocoes FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "promocoes_update" ON promocoes FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "promocoes_delete" ON promocoes FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "promocoes_admin" ON promocoes FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'duam-rt@hotmail.com');
CREATE POLICY "promocoes_barber" ON promocoes FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_promocoes_shop ON promocoes(barbershop_id);
