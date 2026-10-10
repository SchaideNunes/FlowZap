-- ==============================================================================
-- FlowZap - Migração: Configurações (mensagens personalizadas e envio automático)
-- ==============================================================================
-- Execute no SQL Editor do Supabase. Cria uma tabela de UMA linha com:
--   envio_automatico: liga/desliga o envio diário feito pela máquina-sede
--   mensagens: textos escritos pelo usuário para cada aviso (vazio = mensagem padrão)
-- O sistema funciona sem esta tabela (envio automático ligado e mensagens padrão);
-- apenas não consegue salvar alterações na tela de Notificações.

CREATE TABLE IF NOT EXISTS configuracoes (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    envio_automatico BOOLEAN NOT NULL DEFAULT true,
    mensagens JSONB NOT NULL DEFAULT '{}'::jsonb,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_atualizado_em_configuracoes ON configuracoes;
CREATE TRIGGER set_atualizado_em_configuracoes
BEFORE UPDATE ON configuracoes
FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

-- Bloqueia o acesso pelas chaves públicas (o backend usa a service_role, que ignora o RLS)
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
