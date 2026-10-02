-- ==============================================================================
-- FlowZap - Migração: Tabela de Contas a Pagar / Credores (Quem Devemos)
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para criar o controle de quem devemos:

CREATE TABLE IF NOT EXISTS contas_a_pagar (
    id BIGSERIAL PRIMARY KEY,
    nome_credor TEXT NOT NULL,
    descricao TEXT,
    valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
    data_vencimento DATE,
    pago BOOLEAN NOT NULL DEFAULT false,
    data_pagamento DATE,
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_pago ON contas_a_pagar(pago);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_vencimento ON contas_a_pagar(data_vencimento);

-- Trigger de atualização de timestamp
DROP TRIGGER IF EXISTS set_atualizado_em_contas_a_pagar ON contas_a_pagar;
CREATE TRIGGER set_atualizado_em_contas_a_pagar
BEFORE UPDATE ON contas_a_pagar
FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

-- Inserir os registros iniciais da planilha do lojista (CRISTE e JOSA)
INSERT INTO contas_a_pagar (nome_credor, valor, pago, observacoes)
VALUES 
    ('CRISTE (PARCELADO)', 7500.00, false, 'Importado da planilha'),
    ('JOSA', 1000.00, false, 'Importado da planilha')
ON CONFLICT DO NOTHING;
