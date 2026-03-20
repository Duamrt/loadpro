-- ONDA 9: Colunas extras de segurança
-- Rodar DEPOIS dos SQLs anteriores (onda1 a onda8)

-- Descrição da barbearia (usado no mini-site público barbearia.html)
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS description text;
COMMENT ON COLUMN barbershops.description IS 'Descrição da barbearia para o mini-site público';

-- Garantir que a tabela clients tem policy de leitura pra anon (minha-conta.html)
-- Se já existir, o DROP IF EXISTS cuida
DROP POLICY IF EXISTS "clients_anon_select" ON clients;
CREATE POLICY "clients_anon_select" ON clients FOR SELECT TO anon USING (true);

-- Garantir que appointments tem policy anon SELECT (já deve ter do agendar.html, mas por segurança)
DROP POLICY IF EXISTS "appointments_anon_select" ON appointments;
CREATE POLICY "appointments_anon_select" ON appointments FOR SELECT TO anon USING (true);

-- Garantir que services tem policy anon SELECT (barbearia.html pública precisa)
DROP POLICY IF EXISTS "services_anon_select" ON services;
CREATE POLICY "services_anon_select" ON services FOR SELECT TO anon USING (true);

-- Garantir que barbers tem policy anon SELECT (barbearia.html pública precisa)
DROP POLICY IF EXISTS "barbers_anon_select" ON barbers;
CREATE POLICY "barbers_anon_select" ON barbers FOR SELECT TO anon USING (true);

-- Garantir que barbershops tem policy anon SELECT (páginas públicas precisam)
DROP POLICY IF EXISTS "barbershops_anon_select" ON barbershops;
CREATE POLICY "barbershops_anon_select" ON barbershops FOR SELECT TO anon USING (true);

-- Combos anon SELECT (barbearia.html + agendar.html público)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'combos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "combos_anon_select" ON combos';
    EXECUTE 'CREATE POLICY "combos_anon_select" ON combos FOR SELECT TO anon USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "combo_services_anon_select" ON combo_services';
    EXECUTE 'CREATE POLICY "combo_services_anon_select" ON combo_services FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- Cupons anon SELECT (agendar.html público precisa validar cupom)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cupons') THEN
    EXECUTE 'DROP POLICY IF EXISTS "cupons_anon_select" ON cupons';
    EXECUTE 'CREATE POLICY "cupons_anon_select" ON cupons FOR SELECT TO anon USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "cupom_usos_anon_insert" ON cupom_usos';
    EXECUTE 'CREATE POLICY "cupom_usos_anon_insert" ON cupom_usos FOR INSERT TO anon WITH CHECK (true)';
  END IF;
END $$;

-- Galeria anon SELECT (barbearia.html pública + galeria.html pública)
-- Já criado no onda8, mas garantir
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'galeria') THEN
    EXECUTE 'DROP POLICY IF EXISTS "galeria_anon" ON galeria';
    EXECUTE 'CREATE POLICY "galeria_anon" ON galeria FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- Respostas satisfação anon INSERT (já criado no onda3, garantir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'respostas_satisfacao') THEN
    EXECUTE 'DROP POLICY IF EXISTS "respostas_anon_insert" ON respostas_satisfacao';
    EXECUTE 'CREATE POLICY "respostas_anon_insert" ON respostas_satisfacao FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "respostas_anon_select" ON respostas_satisfacao';
    EXECUTE 'CREATE POLICY "respostas_anon_select" ON respostas_satisfacao FOR SELECT TO anon USING (true)';
  END IF;
END $$;
