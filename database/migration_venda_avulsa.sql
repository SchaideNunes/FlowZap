-- ==============================================================================
-- FlowZap - Migração: Venda para cliente sem cadastro
-- ==============================================================================
-- Execute no SQL Editor do Supabase. Permite registrar uma venda só com o nome de quem
-- comprou (sem cadastro de cliente). Essas vendas não recebem avisos pelo WhatsApp e podem
-- ser vinculadas a um cliente cadastrado depois.
-- Sem esta migração o sistema funciona normalmente; só não salva venda sem cadastro.

ALTER TABLE vendas ALTER COLUMN cliente_id DROP NOT NULL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_avulso TEXT;

-- Toda venda tem um cliente cadastrado ou um nome
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_cliente_ou_avulso_check;
ALTER TABLE vendas
    ADD CONSTRAINT vendas_cliente_ou_avulso_check CHECK (cliente_id IS NOT NULL OR cliente_avulso IS NOT NULL);
