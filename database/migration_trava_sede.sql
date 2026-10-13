-- ==============================================================================
-- FlowZap - Migração: Trava de sede única
-- ==============================================================================
-- Execute no SQL Editor do Supabase. Registra qual instalação é a máquina-sede, para que
-- só ela envie cobranças. Uma segunda máquina iniciada com o mesmo banco fica só como
-- painel até alguém escolher, nela, "usar este computador como sede".
-- Sem esta migração o sistema funciona como antes, sem a proteção.

ALTER TABLE sede_status ADD COLUMN IF NOT EXISTS sede_id TEXT;
ALTER TABLE sede_status ADD COLUMN IF NOT EXISTS sede_nome TEXT;
