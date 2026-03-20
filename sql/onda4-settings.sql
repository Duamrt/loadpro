-- ONDA 4: Coluna settings na barbershops
-- Rodar no Supabase SQL Editor

-- Adicionar coluna settings (JSONB) na tabela barbershops
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- Comentário
COMMENT ON COLUMN barbershops.settings IS 'Configurações do estabelecimento: slot_interval, booking_limit_days, cancel_limit_hours, allow_overlap, auto_confirm, reminder_minutes, send_confirmation, default_commission, payment_methods, accent_color';
