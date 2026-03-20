-- ══════════════════════════════════════════════════════════════
-- NaRegua — Seed: Barbearia Modelo (dados demo 30 dias)
-- Rodar no Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Garantir que colunas schedule/break existem (podem ter sido adicionadas fora do setup.sql)
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS schedule jsonb;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS break_start time;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS break_end time;

DO $$
DECLARE
  v_owner_id uuid;
  v_shop_id uuid;
  v_renan_id uuid;
  v_kaio_id uuid;
  v_lucas_id uuid;
  v_svc_corte uuid;
  v_svc_barba uuid;
  v_svc_cortebarba uuid;
  v_svc_pigmenta uuid;
  v_svc_sobrancelha uuid;
  v_svc_noivo uuid;
  v_day date;
  v_dow int; -- day of week (0=dom, 1=seg ... 6=sab)
  v_hour int;
  v_minute int;
  v_ts timestamptz;
  v_barber_id uuid;
  v_service_id uuid;
  v_svc_name text;
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
  v_clients text[];
  v_phones text[];
BEGIN
  -- ══════════ 0. Owner ID ══════════
  SELECT id INTO v_owner_id FROM auth.users WHERE email = 'duam-rt@hotmail.com';
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Usuário duam-rt@hotmail.com não encontrado em auth.users';
  END IF;

  -- ══════════ 1. Limpar dados existentes da demo (idempotente) ══════════
  DELETE FROM expenses WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM payments WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM appointments WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM services WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM barbers WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM subscriptions WHERE barbershop_id IN (SELECT id FROM barbershops WHERE slug = 'modelo-naregua');
  DELETE FROM barbershops WHERE slug = 'modelo-naregua';

  -- ══════════ 2. Barbershop ══════════
  INSERT INTO barbershops (owner_id, name, slug, city, phone, plan, opening_time, closing_time, interval_min, days_open, plan_expires_at, paid_until)
  VALUES (v_owner_id, 'Barbearia Modelo NaRegua', 'modelo-naregua', 'Jupi-PE', '(87) 99876-5432', 'profissional',
          '08:00', '19:00', 30, '{1,2,3,4,5,6}', now() + interval '90 days', (current_date + 90))
  RETURNING id INTO v_shop_id;

  -- Subscription
  INSERT INTO subscriptions (barbershop_id, plan, expires_at, active)
  VALUES (v_shop_id, 'profissional', now() + interval '90 days', true);

  -- ══════════ 3. Barbers ══════════
  -- Renan: Seg-Sab (1-6), 08-19, pausa 12-13
  INSERT INTO barbers (barbershop_id, name, commission_pct, working_days, working_start, working_end, active, schedule)
  VALUES (v_shop_id, 'Renan', 40, '{1,2,3,4,5,6}', '08:00', '19:00', true,
    '{"1":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"2":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"3":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"4":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"5":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"},"6":{"start":"08:00","end":"19:00","break_start":"12:00","break_end":"13:00"}}'::jsonb)
  RETURNING id INTO v_renan_id;

  -- Kaio: Seg-Sex (1-5), 09-18, pausa 13-14
  INSERT INTO barbers (barbershop_id, name, commission_pct, working_days, working_start, working_end, active, schedule)
  VALUES (v_shop_id, 'Kaio', 40, '{1,2,3,4,5}', '09:00', '18:00', true,
    '{"1":{"start":"09:00","end":"18:00","break_start":"13:00","break_end":"14:00"},"2":{"start":"09:00","end":"18:00","break_start":"13:00","break_end":"14:00"},"3":{"start":"09:00","end":"18:00","break_start":"13:00","break_end":"14:00"},"4":{"start":"09:00","end":"18:00","break_start":"13:00","break_end":"14:00"},"5":{"start":"09:00","end":"18:00","break_start":"13:00","break_end":"14:00"}}'::jsonb)
  RETURNING id INTO v_kaio_id;

  -- Lucas: Ter-Sab (2-6), 08-17, pausa 12-13
  INSERT INTO barbers (barbershop_id, name, commission_pct, working_days, working_start, working_end, active, schedule)
  VALUES (v_shop_id, 'Lucas', 35, '{2,3,4,5,6}', '08:00', '17:00', true,
    '{"2":{"start":"08:00","end":"17:00","break_start":"12:00","break_end":"13:00"},"3":{"start":"08:00","end":"17:00","break_start":"12:00","break_end":"13:00"},"4":{"start":"08:00","end":"17:00","break_start":"12:00","break_end":"13:00"},"5":{"start":"08:00","end":"17:00","break_start":"12:00","break_end":"13:00"},"6":{"start":"08:00","end":"17:00","break_start":"12:00","break_end":"13:00"}}'::jsonb)
  RETURNING id INTO v_lucas_id;

  -- ══════════ 4. Services ══════════
  INSERT INTO services (barbershop_id, name, price, duration_min, blocks_all_day, active)
  VALUES (v_shop_id, 'Corte', 35, 30, false, true) RETURNING id INTO v_svc_corte;

  INSERT INTO services (barbershop_id, name, price, duration_min, blocks_all_day, active)
  VALUES (v_shop_id, 'Barba', 25, 20, false, true) RETURNING id INTO v_svc_barba;

  INSERT INTO services (barbershop_id, name, price, duration_min, blocks_all_day, active)
  VALUES (v_shop_id, 'Corte + Barba', 50, 45, false, true) RETURNING id INTO v_svc_cortebarba;

  INSERT INTO services (barbershop_id, name, price, duration_min, blocks_all_day, active)
  VALUES (v_shop_id, 'Pigmentação', 60, 40, false, true) RETURNING id INTO v_svc_pigmenta;

  INSERT INTO services (barbershop_id, name, price, duration_min, blocks_all_day, active)
  VALUES (v_shop_id, 'Sobrancelha', 15, 15, false, true) RETURNING id INTO v_svc_sobrancelha;

  INSERT INTO services (barbershop_id, name, price, duration_min, blocks_all_day, active)
  VALUES (v_shop_id, 'Dia do Noivo', 120, 120, true, true) RETURNING id INTO v_svc_noivo;

  -- ══════════ 5. Clients pool ══════════
  v_clients := ARRAY[
    'João Pedro', 'Mateus Silva', 'Gabriel Santos', 'Lucas Oliveira', 'Davi Souza',
    'Arthur Lima', 'Bernardo Costa', 'Heitor Alves', 'Enzo Ferreira', 'Lorenzo Pereira',
    'Rafael Gomes', 'Theo Ribeiro', 'Miguel Rocha', 'Henrique Dias', 'Samuel Martins',
    'Pedro Henrique', 'Guilherme Nunes', 'Benício Araújo', 'Cauã Mendes', 'Felipe Barros',
    'Vinícius Cardoso', 'Bruno Correia', 'Thiago Nascimento', 'Diego Moreira', 'Anderson Teixeira',
    'Marcos Paulo', 'Léo Batista', 'Caio Ramos', 'Gustavo Freitas', 'Ricardo Monteiro',
    'Fernando Pinto', 'Rodrigo Vieira', 'Wellington Cruz', 'Alex Carvalho', 'Danilo Lopes'
  ];
  v_phones := ARRAY[
    '(87) 99812-3401', '(87) 99823-4502', '(87) 99834-5603', '(87) 99845-6704', '(87) 99856-7805',
    '(87) 99867-8906', '(87) 99878-9007', '(87) 99889-0108', '(87) 99890-1209', '(87) 99801-2310',
    '(87) 99812-3411', '(87) 99823-4512', '(87) 99834-5613', '(87) 99845-6714', '(87) 99856-7815',
    '(87) 99867-8916', '(87) 99878-9017', '(87) 99889-0118', '(87) 99890-1219', '(87) 99801-2320',
    '(87) 99812-3421', '(87) 99823-4522', '(87) 99834-5623', '(87) 99845-6724', '(87) 99856-7825',
    '(87) 99867-8926', '(87) 99878-9027', '(87) 99889-0128', '(87) 99890-1229', '(87) 99801-2330',
    '(87) 99812-3431', '(87) 99823-4532', '(87) 99834-5633', '(87) 99845-6734', '(87) 99856-7835'
  ];

  -- ══════════ 6. Appointments (~200 over 30 days) ══════════
  v_day := '2026-02-16'::date;

  WHILE v_day <= '2026-03-18'::date LOOP
    v_dow := EXTRACT(DOW FROM v_day)::int; -- 0=dom

    -- Skip domingo
    IF v_dow = 0 THEN
      v_day := v_day + 1;
      CONTINUE;
    END IF;

    -- Target ~7-8 appointments per working day (26 working days * ~7.7 ≈ 200)
    v_appt_target := 6 + floor(random() * 4)::int; -- 6 to 9

    FOR i IN 1..v_appt_target LOOP
      -- Pick barber based on day availability + proportional
      v_rand := random();
      IF v_dow = 1 THEN -- segunda: só Renan e Kaio
        IF v_rand < 0.55 THEN v_barber_id := v_renan_id;
        ELSE v_barber_id := v_kaio_id; END IF;
      ELSIF v_dow = 6 THEN -- sábado: só Renan e Lucas
        IF v_rand < 0.55 THEN v_barber_id := v_renan_id;
        ELSE v_barber_id := v_lucas_id; END IF;
      ELSE -- ter-sex: todos
        IF v_rand < 0.40 THEN v_barber_id := v_renan_id;
        ELSIF v_rand < 0.70 THEN v_barber_id := v_kaio_id;
        ELSE v_barber_id := v_lucas_id; END IF;
      END IF;

      -- Pick service (weighted)
      v_rand := random();
      IF v_rand < 0.40 THEN
        v_service_id := v_svc_corte; v_svc_name := 'Corte'; v_duration := 30; v_price := 35;
      ELSIF v_rand < 0.55 THEN
        v_service_id := v_svc_barba; v_svc_name := 'Barba'; v_duration := 20; v_price := 25;
      ELSIF v_rand < 0.80 THEN
        v_service_id := v_svc_cortebarba; v_svc_name := 'Corte + Barba'; v_duration := 45; v_price := 50;
      ELSIF v_rand < 0.90 THEN
        v_service_id := v_svc_pigmenta; v_svc_name := 'Pigmentação'; v_duration := 40; v_price := 60;
      ELSIF v_rand < 0.95 THEN
        v_service_id := v_svc_sobrancelha; v_svc_name := 'Sobrancelha'; v_duration := 15; v_price := 15;
      ELSE
        v_service_id := v_svc_noivo; v_svc_name := 'Dia do Noivo'; v_duration := 120; v_price := 120;
      END IF;

      -- Pick hour (avoid breaks)
      -- Determine valid start hour based on barber
      LOOP
        IF v_barber_id = v_kaio_id THEN
          v_hour := 9 + floor(random() * 8)::int; -- 9 to 16
          IF v_hour >= 13 AND v_hour < 14 THEN CONTINUE; END IF; -- skip break
        ELSIF v_barber_id = v_lucas_id THEN
          v_hour := 8 + floor(random() * 8)::int; -- 8 to 15
          IF v_hour >= 12 AND v_hour < 13 THEN CONTINUE; END IF; -- skip break
        ELSE -- Renan
          v_hour := 8 + floor(random() * 10)::int; -- 8 to 17
          IF v_hour >= 12 AND v_hour < 13 THEN CONTINUE; END IF; -- skip break
        END IF;
        EXIT; -- valid hour found
      END LOOP;

      v_minute := (floor(random() * 2) * 30)::int; -- 0 or 30

      v_ts := (v_day || ' ' || lpad(v_hour::text, 2, '0') || ':' || lpad(v_minute::text, 2, '0') || ':00-03')::timestamptz;

      -- Status based on date
      IF v_day > '2026-03-18'::date THEN
        -- future (won't happen with our range)
        v_rand2 := random();
        IF v_rand2 < 0.6 THEN v_status := 'confirmed'; ELSE v_status := 'pending'; END IF;
      ELSIF v_day >= '2026-03-16'::date THEN
        -- last 2-3 days: mix of confirmed/pending/done
        v_rand2 := random();
        IF v_rand2 < 0.45 THEN v_status := 'confirmed';
        ELSIF v_rand2 < 0.75 THEN v_status := 'pending';
        ELSIF v_rand2 < 0.90 THEN v_status := 'done';
        ELSE v_status := 'cancelled'; END IF;
      ELSE
        -- past: 70% done, 10% cancelled, 5% no_show, 15% confirmed/pending
        v_rand2 := random();
        IF v_rand2 < 0.74 THEN v_status := 'done';
        ELSIF v_rand2 < 0.84 THEN v_status := 'cancelled';
        ELSIF v_rand2 < 0.89 THEN v_status := 'no_show';
        ELSIF v_rand2 < 0.95 THEN v_status := 'confirmed';
        ELSE v_status := 'pending'; END IF;
      END IF;

      -- Payment for done
      v_price_paid := NULL;
      v_payment := NULL;
      IF v_status = 'done' THEN
        v_price_paid := v_price;
        v_rand2 := random();
        IF v_rand2 < 0.40 THEN v_payment := 'pix';
        ELSIF v_rand2 < 0.70 THEN v_payment := 'dinheiro';
        ELSE v_payment := 'cartao'; END IF;
      END IF;

      -- Pick client
      v_rand := floor(random() * 35)::int + 1;
      v_client_name := v_clients[v_rand];
      v_client_phone := v_phones[v_rand];

      INSERT INTO appointments (barbershop_id, barber_id, service_id, client_name, client_phone, scheduled_at, status, price_paid, payment_method, created_at)
      VALUES (v_shop_id, v_barber_id, v_service_id, v_client_name, v_client_phone, v_ts, v_status, v_price_paid, v_payment, v_ts - interval '1 day' * (random() * 3)::int);

      v_count := v_count + 1;
    END LOOP;

    v_day := v_day + 1;
  END LOOP;

  RAISE NOTICE 'Appointments created: %', v_count;

  -- ══════════ 7. Expenses (15 over 30 days) ══════════

  -- Aluguel (1x/mês)
  INSERT INTO expenses (barbershop_id, description, amount, date, category)
  VALUES
    (v_shop_id, 'Aluguel março', 800, '2026-03-05', 'aluguel'),
    (v_shop_id, 'Aluguel fevereiro', 800, '2026-02-05', 'aluguel');

  -- Energia
  INSERT INTO expenses (barbershop_id, description, amount, date, category)
  VALUES
    (v_shop_id, 'Conta de energia fev', 185.40, '2026-02-20', 'energia'),
    (v_shop_id, 'Conta de energia mar', 172.60, '2026-03-15', 'energia');

  -- Água
  INSERT INTO expenses (barbershop_id, description, amount, date, category)
  VALUES
    (v_shop_id, 'Conta de água fev/mar', 62.30, '2026-03-10', 'agua');

  -- Produtos
  INSERT INTO expenses (barbershop_id, description, amount, date, category)
  VALUES
    (v_shop_id, 'Gilette descartável (cx 50)', 45.00, '2026-02-18', 'produtos'),
    (v_shop_id, 'Shampoo profissional 1L', 38.90, '2026-02-22', 'produtos'),
    (v_shop_id, 'Cera modeladora (6 un)', 72.00, '2026-02-28', 'produtos'),
    (v_shop_id, 'Óleo pós-barba', 29.90, '2026-03-02', 'produtos'),
    (v_shop_id, 'Talco barbeiro', 22.50, '2026-03-05', 'produtos'),
    (v_shop_id, 'Loção pré-barba', 34.00, '2026-03-08', 'produtos'),
    (v_shop_id, 'Pente e escova kit', 55.00, '2026-03-12', 'produtos'),
    (v_shop_id, 'Gilette descartável (cx 50)', 45.00, '2026-03-16', 'produtos');

  -- Marketing
  INSERT INTO expenses (barbershop_id, description, amount, date, category)
  VALUES
    (v_shop_id, 'Impulsionamento Instagram', 80.00, '2026-02-25', 'marketing'),
    (v_shop_id, 'Banner lona fachada', 150.00, '2026-03-03', 'marketing');

  RAISE NOTICE 'Seed completo! Shop: %, Barbers: 3, Services: 6, Expenses: 15', v_shop_id;
END $$;
