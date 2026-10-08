-- ==============================================================================
-- FlowZap - Migração: aviso de 2 dias antes (janela de 3 avisos antes do vencimento)
-- ==============================================================================
-- Execute no SQL Editor do Supabase ANTES de usar o sistema com a nova regra.
-- O histórico de mensagens passa a aceitar o tipo 'lembrete_2d'. Sem esta migração o
-- aviso de 2 dias é enviado pelo WhatsApp, mas o banco recusa o registro no histórico.
--
-- Pode ser executada mais de uma vez.

-- Remove a regra antiga do campo "tipo" (qualquer que seja o nome gerado pelo banco)
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'historico_mensagens'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%tipo%'
    LOOP
        EXECUTE format('ALTER TABLE historico_mensagens DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE historico_mensagens
    ADD CONSTRAINT historico_mensagens_tipo_check CHECK (
        tipo IN ('lembrete_3d', 'lembrete_2d', 'lembrete_1d', 'vencido', 'confirmacao_manual')
    );
