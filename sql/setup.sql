-- NaRegua — Setup completo do banco de dados
-- Rodar no Supabase SQL Editor

-- ══════════════════════════════════════════
-- TABELAS
-- ══════════════════════════════════════════

-- Barbearias
CREATE TABLE barbershops (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  city text DEFAULT '',
  phone text DEFAULT '',
  plan text DEFAULT 'basico' CHECK (plan IN ('basico', 'profissional', 'premium')),
  plan_expires_at timestamptz,
  opening_time time DEFAULT '08:00',
  closing_time time DEFAULT '19:00',
  business_type text DEFAULT 'barbearia',
  paid_until date,
  interval_min integer DEFAULT 30,
  days_open integer[] DEFAULT '{1,2,3,4,5,6}',
  created_at timestamptz DEFAULT now()
);

-- Barbeiros
CREATE TABLE barbers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  commission_pct numeric DEFAULT 0,
  working_days integer[],
  working_start time,
  working_end time,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Serviços
CREATE TABLE services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  duration_min integer NOT NULL DEFAULT 30,
  blocks_all_day boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Agendamentos
CREATE TABLE appointments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  barber_id uuid REFERENCES barbers(id),
  service_id uuid REFERENCES services(id),
  client_name text NOT NULL,
  client_phone text DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'done', 'cancelled', 'no_show')),
  group_id uuid,
  price_paid numeric,
  payment_method text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Despesas
CREATE TABLE expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  category text DEFAULT 'outros',
  created_at timestamptz DEFAULT now()
);

-- Pagamentos
CREATE TABLE payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  method text DEFAULT 'dinheiro' CHECK (method IN ('pix', 'dinheiro', 'cartao')),
  paid_at timestamptz DEFAULT now()
);

-- Assinaturas (controle de plano)
CREATE TABLE subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  plan text DEFAULT 'basico' CHECK (plan IN ('basico', 'profissional', 'premium')),
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  active boolean DEFAULT true
);

-- ══════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════
CREATE INDEX idx_barbershops_owner ON barbershops(owner_id);
CREATE INDEX idx_barbershops_slug ON barbershops(slug);
CREATE INDEX idx_barbers_shop ON barbers(barbershop_id);
CREATE INDEX idx_services_shop ON services(barbershop_id);
CREATE INDEX idx_appointments_shop ON appointments(barbershop_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_expenses_shop ON expenses(barbershop_id);
CREATE INDEX idx_payments_shop ON payments(barbershop_id);

-- ══════════════════════════════════════════
-- RLS (Row Level Security)
-- ══════════════════════════════════════════

-- Barbershops: dono vê/edita só a sua
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barbershops_select" ON barbershops
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "barbershops_insert" ON barbershops
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "barbershops_update" ON barbershops
  FOR UPDATE USING (owner_id = auth.uid());

-- Leitura pública do slug (pra página de agendamento)
CREATE POLICY "barbershops_public_slug" ON barbershops
  FOR SELECT USING (true);

-- Barbers: dono da barbearia
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barbers_owner" ON barbers
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

-- Leitura pública (cliente vê barbeiros ao agendar)
CREATE POLICY "barbers_public_read" ON barbers
  FOR SELECT USING (active = true);

-- Services: dono da barbearia
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_owner" ON services
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

-- Leitura pública (cliente vê serviços ao agendar)
CREATE POLICY "services_public_read" ON services
  FOR SELECT USING (active = true);

-- Appointments: dono da barbearia + inserção anônima (cliente agenda sem login)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_owner" ON appointments
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

CREATE POLICY "appointments_public_insert" ON appointments
  FOR INSERT WITH CHECK (true);

-- Leitura pública de agendamentos ativos (necessário pra conflito e grade de horários)
CREATE POLICY "appointments_public_read_active" ON appointments
  FOR SELECT USING (status IN ('pending', 'confirmed'));

-- Expenses: só dono da barbearia
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_owner" ON expenses
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

-- Payments: só dono da barbearia
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_owner" ON payments
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

-- Subscriptions: só dono da barbearia
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_owner" ON subscriptions
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );
