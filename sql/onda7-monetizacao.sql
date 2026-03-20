-- ONDA 7: Monetização — colunas de plano na barbershops

-- Colunas de plano
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS plan text DEFAULT 'trial';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS plan_started_at timestamptz;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS trial_started_at timestamptz DEFAULT now();

-- Setar trial de 30 dias para barbearias existentes que não têm plano
UPDATE barbershops
SET trial_started_at = created_at,
    plan_expires_at = created_at + interval '30 days'
WHERE plan IS NULL OR plan = 'trial'
  AND plan_expires_at IS NULL;

-- Comentários
COMMENT ON COLUMN barbershops.plan IS 'Plano: trial, basico, profissional, premium';
COMMENT ON COLUMN barbershops.plan_expires_at IS 'Data de expiração do plano/trial';
COMMENT ON COLUMN barbershops.trial_started_at IS 'Quando o trial começou';
