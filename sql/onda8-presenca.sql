-- ONDA 8: Galeria + Políticas

-- Galeria de fotos
CREATE TABLE IF NOT EXISTS galeria (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) NOT NULL,
  barber_id uuid REFERENCES barbers(id),
  image_url text NOT NULL,
  description text,
  category text DEFAULT 'cabelo' CHECK (category IN ('cabelo', 'barba', 'cabelo_barba', 'antes_depois', 'ambiente')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE galeria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "galeria_owner_select" ON galeria;
DROP POLICY IF EXISTS "galeria_owner_insert" ON galeria;
DROP POLICY IF EXISTS "galeria_owner_update" ON galeria;
DROP POLICY IF EXISTS "galeria_owner_delete" ON galeria;
DROP POLICY IF EXISTS "galeria_admin" ON galeria;
DROP POLICY IF EXISTS "galeria_barber" ON galeria;
DROP POLICY IF EXISTS "galeria_anon" ON galeria;

CREATE POLICY "galeria_owner_select" ON galeria FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "galeria_owner_insert" ON galeria FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "galeria_owner_update" ON galeria FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "galeria_owner_delete" ON galeria FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));
CREATE POLICY "galeria_admin" ON galeria FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'duam-rt@hotmail.com');
CREATE POLICY "galeria_barber" ON galeria FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT barbershop_id FROM barbers WHERE user_id = auth.uid()));
CREATE POLICY "galeria_anon" ON galeria FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_galeria_shop ON galeria(barbershop_id);
CREATE INDEX IF NOT EXISTS idx_galeria_barber ON galeria(barbershop_id, barber_id);

-- Coluna policies na barbershops
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS policies jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN barbershops.policies IS 'Políticas: cancelamento, atraso, no_show, pagamento, horario, observacoes';

-- Storage bucket para galeria (rodar no Dashboard > Storage > New bucket)
-- Nome: galeria
-- Public: true
-- Se preferir via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('galeria', 'galeria', true) ON CONFLICT DO NOTHING;
