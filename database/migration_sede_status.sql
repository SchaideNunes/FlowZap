-- ==============================================================================
-- FlowZap - Migração: Status da Máquina-Sede
-- ==============================================================================
-- Execute no SQL Editor do Supabase. Cria uma tabela de UMA linha onde a máquina-sede
-- grava (a cada minuto) que está ligada e em que estado está o WhatsApp, e a data da
-- última rotina diária de cobrança. O painel hospedado na nuvem usa isso para mostrar
-- "Sede online/offline". O sistema funciona sem esta tabela; apenas não mostra o indicador.

CREATE TABLE IF NOT EXISTS sede_status (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    estado_whatsapp TEXT NOT NULL DEFAULT 'close',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultima_rotina_data DATE
);

-- Bloqueia o acesso pelas chaves públicas (o backend usa a service_role, que ignora o RLS)
ALTER TABLE sede_status ENABLE ROW LEVEL SECURITY;
