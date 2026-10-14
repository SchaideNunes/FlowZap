-- ==============================================================================
-- FlowZap - Migração: Observações da venda
-- ==============================================================================
-- Execute no SQL Editor do Supabase. Anotação interna de cada venda, só para consulta no
-- painel: não entra nas mensagens enviadas ao cliente.
-- Sem esta migração o sistema funciona normalmente; só não salva observações.

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS observacoes TEXT;
