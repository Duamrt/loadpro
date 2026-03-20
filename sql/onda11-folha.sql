-- ONDA 11: Coluna salary nos barbeiros (folha de pagamento)

ALTER TABLE barbers ADD COLUMN IF NOT EXISTS salary numeric(10,2) DEFAULT 0;
COMMENT ON COLUMN barbers.salary IS 'Salário base mensal do barbeiro (0 = só comissão)';
