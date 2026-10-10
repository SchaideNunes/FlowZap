-- ==============================================================================
-- FlowZap - Migração: Chave Pix nas mensagens
-- ==============================================================================
-- Execute no SQL Editor do Supabase. Guarda a chave Pix da loja, usada pela variável
-- {pix} no texto dos avisos. Sem esta coluna o sistema funciona, mas não salva a chave.

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS chave_pix TEXT;
