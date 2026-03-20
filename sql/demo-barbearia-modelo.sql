-- ══════════════════════════════════════════════════════════════════
-- NaRegua — Seed COMPLETO: Barbearia Modelo NaRegua (demo Frazão)
-- Dados ricos e realistas · ~150 agendamentos · 30 dias
-- Rodar no Supabase SQL Editor (como service_role)
-- ══════════════════════════════════════════════════════════════════

-- Garantir colunas extras existem
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS policies jsonb DEFAULT '{}'::jsonb;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS schedule jsonb;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS break_start time;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS break_end time;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS salary numeric(10,2) DEFAULT 0;

DO $$
DECLARE
  v_owner_id uuid;
  v_shop_id uuid;
  -- barbeiros
  v_ricardo_id uuid;
  v_felipe_id uuid;
  v_marcos_id uuid;
  -- servicos
  v_svc_corte uuid;
  v_svc_barba uuid;
  v_svc_cortebarba uuid;
  v_svc_degrade uuid;
  v_svc_navalhado uuid;
  v_svc_barba_hidrat uuid;
  v_svc_selagem uuid;
  v_svc_sobrancelha uuid;
  v_svc_barbaterapia uuid;
  v_svc_pigmentacao uuid;
  -- pesquisa satisfacao
  v_pesquisa_id uuid;
  -- combos
  v_combo1_id uuid;
  v_combo2_id uuid;
  -- loop vars
  v_day date;
  v_dow int;
  v_hour int;
  v_minute int;
  v_ts timestamptz;
  v_barber_id uuid;
  v_service_id uuid;
  v_duration int;
  v_price numeric;
  v_status text;
  v_payment text;
  v_price_paid numeric;
  v_client_name text;
  v_client_phone text;
  v_rand float;
  v_rand2 float;
  v_count int := 0;
  v_appt_target int;
  v_appt_id uuid;
  v_clients text[];
  v_phones text[];
BEGIN
  -- ══════════ 0. Owner ID ══════════
  SELECT id INTO v_owner_id FROM auth.users WHERE email = 'duam-rt@hotmail.com';
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Usuário duam-rt@hotmail.com não encontrado em auth.users';
  END IF;

  -- ══════════ 1. Limpar dados existentes (idempotente) ══════════
  -- Tabelas opcionais primeiro (podem não existir)
  BEGIN DELETE FROM cupom_usos     WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM cupons          WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM combo_services  WHERE combo_id IN (SELECT id FROM combos WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua')); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM combos          WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM respostas_satisfacao WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM pesquisas_satisfacao WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM clients         WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM comanda_items   WHERE comanda_id IN (SELECT id FROM comandas WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua')); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM comandas        WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM stock_movements WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM products        WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM pacote_vendas   WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM pacotes         WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM assinatura_clientes WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM assinaturas     WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM lista_espera    WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM promocoes       WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM galeria         WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua'); EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Tabelas core
  DELETE FROM payments      WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM expenses      WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM appointments  WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM services      WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM barbers       WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM subscriptions WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM barbershops   WHERE slug = 'modelo-naregua';

  -- ══════════ 2. Barbearia ══════════
  INSERT INTO barbershops (
    owner_id, name, slug, city, phone, plan,
    opening_time, closing_time, interval_min, days_open,
    plan_expires_at, paid_until,
    address, instagram, description,
    settings, policies
  ) VALUES (
    v_owner_id,
    'Barbearia Modelo NaRegua',
    'modelo-naregua',
    'Jupi-PE',
    '87999990000',
    'profissional',
    '08:00', '19:00', 30, '{1,2,3,4,5,6}',
    now() + interval '90 days',
    (current_date + 90),
    'Rua Principal, 100, Centro, Jupi-PE',
    '@barbearia.modelo',
    'A melhor barbearia de Jupi! Cortes modernos, barba feita com navalha, ambiente climatizado. Agende pelo celular e seja atendido no horário.',
    '{"slot_interval":30,"booking_limit_days":30,"cancel_limit_hours":2,"auto_confirm":true,"reminder_minutes":30,"default_commission":40,"payment_methods":["pix","dinheiro","debito","credito"]}'::jsonb,
    '{"cancelamento":"Cancele com até 2 horas de antecedência. Após isso, o horário pode ser cobrado.","atraso":"Tolerância de 10 minutos. Após isso, o atendimento pode ser remanejado.","no_show":"Duas faltas seguidas = bloqueio temporário de agendamento.","pagamento":"Aceitamos PIX, dinheiro, débito e crédito."}'::jsonb
  ) RETURNING id INTO v_shop_id;

  -- Subscription
  INSERT INTO subscriptions (barbershop_id, plan, expires_at, active)
  VALUES (v_shop_id, 'profissional', now() + interval '90 days', true);

  -- ══════════ 3. Barbeiros ══════════
  -- Ricardo: dono, Seg-Sab, comissão 40%, salário R$1500
  INSERT INTO barbers (barbershop_id, name, commission_pct, salary, working_days, working_start, working_end, active, schedule)
  VALUES (v_shop_id, 'Ricardo', 40, 1500, '{1,2,3,4,5,6}', '08:00', '19:00', true,
    '{"1":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"2":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"3":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"4":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"5":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"6":{"start":"08:00","end":"17:00","break_start":"12:00","break_end":"13:00"}}'::jsonb)
  RETURNING id INTO v_ricardo_id;

  -- Felipe: só comissão 35%, Seg-Sab
  INSERT INTO barbers (barbershop_id, name, commission_pct, salary, working_days, working_start, working_end, active, schedule)
  VALUES (v_shop_id, 'Felipe', 35, 0, '{1,2,3,4,5,6}', '09:00', '19:00', true,
    '{"1":{"start":"09:00","end":"19:00","break_start":"13:00","break_end":"14:00"},"2":{"start":"09:00","end":"19:00","break_start":"13:00","break_end":"14:00"},"3":{"start":"09:00","end":"19:00","break_start":"13:00","break_end":"14:00"},"4":{"start":"09:00","end":"19:00","break_start":"13:00","break_end":"14:00"},"5":{"start":"09:00","end":"19:00","break_start":"13:00","break_end":"14:00"},"6":{"start":"09:00","end":"17:00","break_start":"13:00","break_end":"14:00"}}'::jsonb)
  RETURNING id INTO v_felipe_id;

  -- Marcos: comissão 40%, salário R$1200, Seg-Sex (folga sábado)
  INSERT INTO barbers (barbershop_id, name, commission_pct, salary, working_days, working_start, working_end, active, schedule)
  VALUES (v_shop_id, 'Marcos', 40, 1200, '{1,2,3,4,5}', '08:00', '18:00', true,
    '{"1":{"start":"08:00","end":"18:00","break_start":"12:00","break_end":"13:00"},"2":{"start":"08:00","end":"18:00","break_start":"12:00","break_end":"13:00"},"3":{"start":"08:00","end":"18:00","break_start":"12:00","break_end":"13:00"},"4":{"start":"08:00","end":"18:00","break_start":"12:00","break_end":"13:00"},"5":{"start":"08:00","end":"18:00","break_start":"12:00","break_end":"13:00"}}'::jsonb)
  RETURNING id INTO v_marcos_id;

  -- ══════════ 4. Serviços (10) ══════════
  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Corte Masculino', 30, 30, true) RETURNING id INTO v_svc_corte;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Barba', 20, 20, true) RETURNING id INTO v_svc_barba;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Corte + Barba', 45, 45, true) RETURNING id INTO v_svc_cortebarba;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Corte Degradê', 35, 35, true) RETURNING id INTO v_svc_degrade;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Corte Navalhado', 35, 35, true) RETURNING id INTO v_svc_navalhado;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Barba + Hidratação', 30, 30, true) RETURNING id INTO v_svc_barba_hidrat;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Selagem', 50, 40, true) RETURNING id INTO v_svc_selagem;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Sobrancelha', 10, 10, true) RETURNING id INTO v_svc_sobrancelha;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Barbaterapia', 25, 30, true) RETURNING id INTO v_svc_barbaterapia;

  INSERT INTO services (barbershop_id, name, price, duration_min, active)
  VALUES (v_shop_id, 'Pigmentação', 40, 40, true) RETURNING id INTO v_svc_pigmentacao;

  -- ══════════ 5. Produtos (estoque) ══════════
  BEGIN
    INSERT INTO products (barbershop_id, name, price, cost, quantity, min_stock, category, active) VALUES
      (v_shop_id, 'Pomada Modeladora',  35, 15,   12, 3,  'produto', true),
      (v_shop_id, 'Cerveja Heineken',   10, 6,    24, 6,  'bebida',  true),
      (v_shop_id, 'Minoxidil',          45, 25,    8, 2,  'produto', true),
      (v_shop_id, 'Coca-Cola',           6, 3,    18, 6,  'bebida',  true),
      (v_shop_id, 'Bala Halls',          2, 0.50, 30, 10, 'produto', true);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabela products não existe, pulando estoque.';
  END;

  -- ══════════ 6. Clientes (15 com aniversários) ══════════
  v_clients := ARRAY[
    'João Silva', 'Pedro Santos', 'Lucas Oliveira', 'Matheus Costa', 'Gabriel Ferreira',
    'Rafael Lima', 'Bruno Almeida', 'Carlos Souza', 'André Pereira', 'Marcos Vieira',
    'Henrique Cardoso', 'Thiago Mendes', 'Gustavo Barbosa', 'Diego Ribeiro', 'Leandro Dias',
    'Fábio Cavalcanti', 'Renan Monteiro', 'Welligton Nunes', 'Júnior Gomes', 'Alan Moreira'
  ];
  v_phones := ARRAY[
    '87999991001', '87999991002', '87999991003', '87999991004', '87999991005',
    '87999991006', '87999991007', '87999991008', '87999991009', '87999991010',
    '87999991011', '87999991012', '87999991013', '87999991014', '87999991015',
    '87999991016', '87999991017', '87999991018', '87999991019', '87999991020'
  ];

  BEGIN
    INSERT INTO clients (barbershop_id, name, phone, birthday, notes) VALUES
      (v_shop_id, 'João Silva',        '87999991001', '1992-03-15', 'Cliente fiel, corta toda semana'),
      (v_shop_id, 'Pedro Santos',      '87999991002', '1988-07-22', 'Prefere degradê alto'),
      (v_shop_id, 'Lucas Oliveira',    '87999991003', '1995-03-28', 'Aniversariante do mês!'),
      (v_shop_id, 'Matheus Costa',     '87999991004', '1990-11-10', 'Barba longa, cuidado com as pontas'),
      (v_shop_id, 'Gabriel Ferreira',  '87999991005', '1998-01-05', 'Gosta de corte social'),
      (v_shop_id, 'Rafael Lima',       '87999991006', '1993-03-03', 'Aniversariante do mês!'),
      (v_shop_id, 'Bruno Almeida',     '87999991007', '1987-06-18', 'Pede cerveja enquanto espera'),
      (v_shop_id, 'Carlos Souza',      '87999991008', '1985-09-30', 'Vem sempre com o filho'),
      (v_shop_id, 'André Pereira',     '87999991009', '1996-12-25', 'Pigmentação recorrente'),
      (v_shop_id, 'Marcos Vieira',     '87999991010', '1991-04-12', 'Só corta com Ricardo'),
      (v_shop_id, 'Henrique Cardoso',  '87999991011', '1994-08-07', 'Barbaterapia a cada 15 dias'),
      (v_shop_id, 'Thiago Mendes',     '87999991012', '1989-03-19', 'Aniversariante do mês!'),
      (v_shop_id, 'Gustavo Barbosa',   '87999991013', '1997-02-14', 'Corte + barba, sempre combo'),
      (v_shop_id, 'Diego Ribeiro',     '87999991014', '1986-10-01', 'Selagem mensal'),
      (v_shop_id, 'Leandro Dias',      '87999991015', '1999-05-20', 'Cliente novo, veio por indicação');
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabela clients não existe, pulando.';
  END;

  -- ══════════ 7. Agendamentos (~150 nos últimos 30 dias) ══════════
  v_day := (current_date - 30);

  WHILE v_day <= current_date LOOP
    v_dow := EXTRACT(DOW FROM v_day)::int; -- 0=dom, 6=sab

    -- Skip domingo
    IF v_dow = 0 THEN
      v_day := v_day + 1;
      CONTINUE;
    END IF;

    -- ~5-7 agendamentos por dia útil (26 dias * ~5.8 ≈ ~150)
    v_appt_target := 4 + floor(random() * 4)::int; -- 4 a 7

    -- Sábado: mais movimento
    IF v_dow = 6 THEN
      v_appt_target := v_appt_target + 2;
    END IF;

    FOR i IN 1..v_appt_target LOOP
      -- Escolher barbeiro (Ricardo 45%, Felipe 35%, Marcos 20%)
      v_rand := random();
      IF v_dow = 6 THEN
        -- Sábado: sem Marcos
        IF v_rand < 0.55 THEN v_barber_id := v_ricardo_id;
        ELSE v_barber_id := v_felipe_id; END IF;
      ELSE
        IF v_rand < 0.45 THEN v_barber_id := v_ricardo_id;
        ELSIF v_rand < 0.80 THEN v_barber_id := v_felipe_id;
        ELSE v_barber_id := v_marcos_id; END IF;
      END IF;

      -- Escolher serviço (50% Corte, 20% Corte+Barba, 15% Barba, 15% outros)
      v_rand := random();
      IF v_rand < 0.50 THEN
        v_service_id := v_svc_corte; v_duration := 30; v_price := 30;
      ELSIF v_rand < 0.70 THEN
        v_service_id := v_svc_cortebarba; v_duration := 45; v_price := 45;
      ELSIF v_rand < 0.85 THEN
        v_service_id := v_svc_barba; v_duration := 20; v_price := 20;
      ELSIF v_rand < 0.89 THEN
        v_service_id := v_svc_degrade; v_duration := 35; v_price := 35;
      ELSIF v_rand < 0.92 THEN
        v_service_id := v_svc_navalhado; v_duration := 35; v_price := 35;
      ELSIF v_rand < 0.94 THEN
        v_service_id := v_svc_barba_hidrat; v_duration := 30; v_price := 30;
      ELSIF v_rand < 0.96 THEN
        v_service_id := v_svc_selagem; v_duration := 40; v_price := 50;
      ELSIF v_rand < 0.97 THEN
        v_service_id := v_svc_sobrancelha; v_duration := 10; v_price := 10;
      ELSIF v_rand < 0.99 THEN
        v_service_id := v_svc_barbaterapia; v_duration := 30; v_price := 25;
      ELSE
        v_service_id := v_svc_pigmentacao; v_duration := 40; v_price := 40;
      END IF;

      -- Horário: concentrado 09-12 e 14-17, mas espalhado 08-18
      LOOP
        v_rand := random();
        IF v_rand < 0.15 THEN
          v_hour := 8;
        ELSIF v_rand < 0.55 THEN
          -- bloco manhã 09-12 (mais concentrado)
          v_hour := 9 + floor(random() * 3)::int;
        ELSIF v_rand < 0.65 THEN
          -- almoço — 13h (poucos)
          v_hour := 13;
        ELSIF v_rand < 0.90 THEN
          -- bloco tarde 14-17 (concentrado)
          v_hour := 14 + floor(random() * 3)::int;
        ELSE
          -- final tarde 17-18
          v_hour := 17 + floor(random() * 1)::int;
        END IF;

        -- Pular horários de almoço do barbeiro
        IF v_barber_id = v_ricardo_id AND v_hour = 12 THEN CONTINUE; END IF;
        IF v_barber_id = v_felipe_id AND v_hour = 13 THEN CONTINUE; END IF;
        IF v_barber_id = v_marcos_id AND v_hour = 12 THEN CONTINUE; END IF;
        -- Felipe começa 09h
        IF v_barber_id = v_felipe_id AND v_hour = 8 THEN CONTINUE; END IF;
        -- Marcos termina 18h
        IF v_barber_id = v_marcos_id AND v_hour >= 18 THEN CONTINUE; END IF;
        EXIT;
      END LOOP;

      v_minute := (floor(random() * 2) * 30)::int; -- 0 ou 30

      v_ts := (v_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':' || lpad(v_minute::text, 2, '0') || ':00-03')::timestamptz;

      -- Status
      IF v_day > current_date THEN
        v_status := 'confirmed';
      ELSIF v_day = current_date THEN
        v_rand2 := random();
        IF v_rand2 < 0.50 THEN v_status := 'confirmed';
        ELSIF v_rand2 < 0.80 THEN v_status := 'done';
        ELSE v_status := 'pending'; END IF;
      ELSE
        -- Passado: 80% done, 5% cancelled, 5% no_show, 10% confirmed (tardios)
        v_rand2 := random();
        IF v_rand2 < 0.80 THEN v_status := 'done';
        ELSIF v_rand2 < 0.85 THEN v_status := 'cancelled';
        ELSIF v_rand2 < 0.90 THEN v_status := 'no_show';
        ELSE v_status := 'confirmed'; END IF;
      END IF;

      -- Pagamento (só para done)
      v_price_paid := NULL;
      v_payment := NULL;
      IF v_status = 'done' THEN
        v_price_paid := v_price;
        v_rand2 := random();
        IF v_rand2 < 0.40 THEN v_payment := 'pix';
        ELSIF v_rand2 < 0.65 THEN v_payment := 'dinheiro';
        ELSIF v_rand2 < 0.85 THEN v_payment := 'debito';
        ELSE v_payment := 'credito'; END IF;
      END IF;

      -- Cliente aleatório
      v_rand := floor(random() * 20)::int + 1;
      v_client_name := v_clients[v_rand];
      v_client_phone := v_phones[v_rand];

      INSERT INTO appointments (
        barbershop_id, barber_id, service_id,
        client_name, client_phone, scheduled_at,
        status, price_paid, payment_method,
        created_at
      ) VALUES (
        v_shop_id, v_barber_id, v_service_id,
        v_client_name, v_client_phone, v_ts,
        v_status, v_price_paid, v_payment,
        v_ts - interval '1 day' * (1 + floor(random() * 3)::int)
      );

      v_count := v_count + 1;
    END LOOP;

    v_day := v_day + 1;
  END LOOP;

  RAISE NOTICE '>>> Agendamentos criados: %', v_count;

  -- ══════════ 8. Despesas (10 deste mês) ══════════
  INSERT INTO expenses (barbershop_id, description, amount, date, category) VALUES
    (v_shop_id, 'Aluguel março',               800,   current_date - 14, 'aluguel'),
    (v_shop_id, 'Energia elétrica',            250,   current_date - 12, 'energia'),
    (v_shop_id, 'Internet fibra óptica',       100,   current_date - 10, 'outros'),
    (v_shop_id, 'Compra pomadas (6un)',        300,   current_date - 9,  'produtos'),
    (v_shop_id, 'Conta de água',                80,   current_date - 8,  'agua'),
    (v_shop_id, 'Manutenção máquina de corte', 150,   current_date - 7,  'outros'),
    (v_shop_id, 'Material descartável',         60,   current_date - 5,  'produtos'),
    (v_shop_id, 'Reposição cerveja (cx)',      180,   current_date - 4,  'produtos'),
    (v_shop_id, 'Produtos de limpeza',         120,   current_date - 3,  'outros'),
    (v_shop_id, 'Tesoura profissional nova',   200,   current_date - 1,  'outros');

  -- ══════════ 9. Pesquisa de Satisfação + 5 Respostas ══════════
  BEGIN
    INSERT INTO pesquisas_satisfacao (barbershop_id, name, active)
    VALUES (v_shop_id, 'Pesquisa padrão', true)
    RETURNING id INTO v_pesquisa_id;

    INSERT INTO respostas_satisfacao (pesquisa_id, barbershop_id, barber_id, client_name, client_phone, rating, comment, responded_at) VALUES
      (v_pesquisa_id, v_shop_id, v_ricardo_id, 'João Silva',     '87999991001', 5, 'Atendimento excelente! Sempre saio satisfeito com o corte.',             current_date - 20),
      (v_pesquisa_id, v_shop_id, v_felipe_id,  'Pedro Santos',   '87999991002', 4, 'Sempre saio satisfeito. O Felipe manda bem demais.',                     current_date - 15),
      (v_pesquisa_id, v_shop_id, v_ricardo_id, 'Matheus Costa',  '87999991004', 5, 'Melhor barbearia da cidade! Ambiente top, recomendo.',                   current_date - 10),
      (v_pesquisa_id, v_shop_id, v_ricardo_id, 'Gabriel Ferreira','87999991005', 5, 'Ricardo é fera no degradê. Nunca me decepcionou!',                      current_date - 5),
      (v_pesquisa_id, v_shop_id, v_marcos_id,  'André Pereira',  '87999991009', 4, 'Ambiente top, ar-condicionado gelado, barbeiro pontual. Recomendo!',     current_date - 2);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabelas de satisfação não existem, pulando.';
  END;

  -- ══════════ 10. Combos (2 ativos) ══════════
  BEGIN
    INSERT INTO combos (barbershop_id, name, description, price, duration, active)
    VALUES (v_shop_id, 'Corte + Barba Completa', 'Corte masculino + barba feita na navalha. Economize R$5!', 45, 50, true)
    RETURNING id INTO v_combo1_id;

    INSERT INTO combo_services (combo_id, service_id) VALUES
      (v_combo1_id, v_svc_corte),
      (v_combo1_id, v_svc_barba);

    INSERT INTO combos (barbershop_id, name, description, price, duration, active)
    VALUES (v_shop_id, 'Corte Degradê + Sobrancelha', 'Degradê perfeito + design de sobrancelha. Economize R$5!', 40, 45, true)
    RETURNING id INTO v_combo2_id;

    INSERT INTO combo_services (combo_id, service_id) VALUES
      (v_combo2_id, v_svc_degrade),
      (v_combo2_id, v_svc_sobrancelha);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabelas de combos não existem, pulando.';
  END;

  -- ══════════ 11. Pacote (1 ativo com 1 venda) ══════════
  BEGIN
    DECLARE v_pacote_id uuid;
    BEGIN
      INSERT INTO pacotes (barbershop_id, name, description, service_id, quantity, price, active)
      VALUES (v_shop_id, '5 Cortes por R$120', 'Pacote econômico: 5 cortes masculinos pelo preço de 4!', v_svc_corte, 5, 120, true)
      RETURNING id INTO v_pacote_id;

      INSERT INTO pacote_vendas (pacote_id, barbershop_id, client_name, client_phone, uses_remaining, uses_total, payment_method, status, sold_at)
      VALUES (v_pacote_id, v_shop_id, 'Gustavo Barbosa', '87999991013', 3, 5, 'pix', 'ativo', current_date - 12);
    END;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabelas de pacotes não existem, pulando.';
  END;

  -- ══════════ 12. Assinatura/Clube (1 plano + 2 assinantes) ══════════
  BEGIN
    DECLARE v_ass_id uuid;
    BEGIN
      INSERT INTO assinaturas (barbershop_id, name, description, price, max_uses, active)
      VALUES (v_shop_id, 'Clube Corte Mensal', '2 cortes por mês + sobrancelha grátis. Pagamento mensal.', 50, 3, true)
      RETURNING id INTO v_ass_id;

      INSERT INTO assinatura_clientes (assinatura_id, barbershop_id, client_name, client_phone, payment_method, uses_this_month, status, next_payment) VALUES
        (v_ass_id, v_shop_id, 'João Silva',  '87999991001', 'pix',      1, 'ativa', (date_trunc('month', current_date) + interval '1 month')::timestamptz),
        (v_ass_id, v_shop_id, 'Marcos Vieira','87999991010', 'credito',  2, 'ativa', (date_trunc('month', current_date) + interval '1 month')::timestamptz);
    END;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabelas de assinaturas não existem, pulando.';
  END;

  -- ══════════ 13. Cupom de desconto (1 ativo) ══════════
  BEGIN
    INSERT INTO cupons (barbershop_id, code, description, discount_type, discount_value, max_uses, uses_count, active, valid_until)
    VALUES (v_shop_id, 'NAREGUA10', '10% de desconto no primeiro agendamento pelo app', 'percentual', 10, 50, 3, true, now() + interval '60 days');
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabela cupons não existe, pulando.';
  END;

  -- ══════════ 14. Promoção / Broadcast (1 enviada) ══════════
  BEGIN
    INSERT INTO promocoes (barbershop_id, title, message, recipient_count, sent_at)
    VALUES (v_shop_id, 'Semana do Degradê!', 'Corte degradê por R$30 esta semana! Agende já pelo link: usenaregua.com.br/modelo-naregua', 45, current_date - 5);
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabela promocoes não existe, pulando.';
  END;

  -- ══════════ 15. Lista de espera (2 walk-ins de hoje) ══════════
  BEGIN
    INSERT INTO lista_espera (barbershop_id, barber_id, client_name, client_phone, service_id, position, status, entered_at) VALUES
      (v_shop_id, v_ricardo_id, 'Welligton Nunes', '87999991018', v_svc_corte, 1, 'aguardando', now() - interval '15 minutes'),
      (v_shop_id, v_felipe_id,  'Alan Moreira',    '87999991020', v_svc_cortebarba, 2, 'aguardando', now() - interval '5 minutes');
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Tabela lista_espera não existe, pulando.';
  END;

  -- ══════════ RESUMO ══════════
  RAISE NOTICE '════════════════════════════════════════════';
  RAISE NOTICE 'SEED COMPLETO — Barbearia Modelo NaRegua';
  RAISE NOTICE '════════════════════════════════════════════';
  RAISE NOTICE 'Shop ID: %', v_shop_id;
  RAISE NOTICE 'Barbeiros: Ricardo, Felipe, Marcos';
  RAISE NOTICE 'Serviços: 10';
  RAISE NOTICE 'Agendamentos: %', v_count;
  RAISE NOTICE 'Despesas: 10';
  RAISE NOTICE 'Clientes: 15';
  RAISE NOTICE 'Satisfação: 5 respostas';
  RAISE NOTICE 'Combos: 2';
  RAISE NOTICE 'Pacotes: 1 (com 1 venda)';
  RAISE NOTICE 'Assinatura: 1 (com 2 assinantes)';
  RAISE NOTICE 'Cupom: NAREGUA10 (10%% off)';
  RAISE NOTICE 'Promoção: 1 broadcast enviado';
  RAISE NOTICE 'Lista espera: 2 walk-ins';
  RAISE NOTICE 'Produtos: 5 (estoque)';
  RAISE NOTICE '════════════════════════════════════════════';
END $$;
