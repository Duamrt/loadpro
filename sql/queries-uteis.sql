-- ══════════════════════════════════════════
-- NAREGUA — QUERIES ÚTEIS DO DIA A DIA
-- Salvar local. Copiar e colar no SQL Editor quando precisar.
-- ══════════════════════════════════════════


-- ── BUSCAR BARBEARIA POR NOME ────────────────────
SELECT id, name, slug, city, phone, plan, paid_until, owner_id
FROM barbershops WHERE name ILIKE '%NOME_AQUI%';


-- ── VER DADOS COMPLETOS DE UMA BARBEARIA ─────────
SELECT
  b.name as barbearia, b.slug, b.city, b.plan, b.paid_until,
  b.owner_password_hint as senha_dono,
  u.email as login_dono,
  br.name as barbeiro, br.phone as tel_barbeiro, br.is_owner,
  br.user_id IS NOT NULL as vinculado, br.password_hint as senha_barbeiro
FROM barbershops b
LEFT JOIN auth.users u ON u.id = b.owner_id
LEFT JOIN barbers br ON br.barbershop_id = b.id
WHERE b.name ILIKE '%NOME_AQUI%';


-- ── MARCAR BARBEIRO COMO DONO ────────────────────
UPDATE barbers SET is_owner = true
WHERE phone = 'TELEFONE_AQUI'
AND barbershop_id = 'ID_BARBEARIA_AQUI';


-- ── LIMPAR DADOS DE TESTE DE UMA BARBEARIA ───────
-- (mantém barbearia, barbeiros e serviços)
DELETE FROM payments WHERE barbershop_id = 'ID_AQUI';
DELETE FROM appointments WHERE barbershop_id = 'ID_AQUI';
DELETE FROM expenses WHERE barbershop_id = 'ID_AQUI';
DELETE FROM stock_movements WHERE barbershop_id = 'ID_AQUI';
DELETE FROM products WHERE barbershop_id = 'ID_AQUI';


-- ── EXCLUIR BARBEARIA COMPLETA (CASCATA) ─────────
-- CUIDADO: apaga TUDO, irreversível
DELETE FROM payments WHERE barbershop_id = 'ID_AQUI';
DELETE FROM appointments WHERE barbershop_id = 'ID_AQUI';
DELETE FROM expenses WHERE barbershop_id = 'ID_AQUI';
DELETE FROM stock_movements WHERE barbershop_id = 'ID_AQUI';
DELETE FROM products WHERE barbershop_id = 'ID_AQUI';
DELETE FROM services WHERE barbershop_id = 'ID_AQUI';
DELETE FROM barbers WHERE barbershop_id = 'ID_AQUI';
DELETE FROM subscriptions WHERE barbershop_id = 'ID_AQUI';
DELETE FROM barbershops WHERE id = 'ID_AQUI';


-- ── LISTAR TODOS OS CLIENTES (RESUMO) ────────────
SELECT
  b.name, b.slug, b.city, b.plan, b.paid_until,
  u.email as login,
  (SELECT count(*) FROM barbers WHERE barbershop_id = b.id AND active = true) as barbeiros,
  (SELECT count(*) FROM appointments WHERE barbershop_id = b.id) as agendamentos
FROM barbershops b
LEFT JOIN auth.users u ON u.id = b.owner_id
ORDER BY b.created_at DESC;


-- ── CONTAR AGENDAMENTOS POR BARBEARIA ────────────
SELECT b.name, count(a.id) as total,
  count(*) FILTER (WHERE a.status = 'done') as atendidos,
  count(*) FILTER (WHERE a.status = 'no_show') as faltas
FROM barbershops b
LEFT JOIN appointments a ON a.barbershop_id = b.id
GROUP BY b.id, b.name ORDER BY total DESC;


-- ── TROCAR EMAIL DO DONO ─────────────────────────
-- Passo 1: Criar novo user (fazer pelo signup do site)
-- Passo 2: Pegar ID do novo user
SELECT id FROM auth.users WHERE email = 'NOVO_EMAIL_AQUI';
-- Passo 3: Vincular
UPDATE barbershops SET owner_id = 'NOVO_USER_ID' WHERE id = 'ID_BARBEARIA';
