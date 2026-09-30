-- ==============================================================================
-- FLOW-ZAP: Schema do Banco de Dados PostgreSQL (Supabase)
-- Sistema de Cobrança Recorrente via WhatsApp
-- ==============================================================================

-- 1. Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Usuários (Autenticação para o dono e o sócio)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de Clientes (Dados cadastrais)
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de Vendas (Cobranças recorrentes individuais por cliente)
CREATE TABLE IF NOT EXISTS vendas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    descricao TEXT,
    valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
    valor_total NUMERIC(10, 2),
    taxa_juros NUMERIC(5, 2) DEFAULT 0,
    total_parcelas INTEGER DEFAULT 1,
    parcela_atual INTEGER DEFAULT 1,
    status_mes_atual TEXT NOT NULL DEFAULT 'pendente' CHECK (
        status_mes_atual IN ('pendente', 'avisado_3d', 'avisado_1d', 'vencido', 'pago')
    ),
    data_vencimento_atual DATE NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabela de Histórico de Mensagens
CREATE TABLE IF NOT EXISTS historico_mensagens (
    id BIGSERIAL PRIMARY KEY,
    venda_id BIGINT NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (
        tipo IN ('lembrete_3d', 'lembrete_1d', 'vencido', 'confirmacao_manual')
    ),
    data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_envio TEXT NOT NULL CHECK (status_envio IN ('enviado', 'falha')),
    mensagem TEXT,
    detalhes JSONB
);

-- 6. Índices para Otimização de Consultas e do Cron Diário
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON clientes(whatsapp);

CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_ativo ON vendas(ativo);
CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status_mes_atual);
CREATE INDEX IF NOT EXISTS idx_vendas_data_vencimento ON vendas(data_vencimento_atual);
CREATE INDEX IF NOT EXISTS idx_vendas_cron_busca ON vendas(ativo, status_mes_atual, data_vencimento_atual);

CREATE INDEX IF NOT EXISTS idx_historico_venda_id ON historico_mensagens(venda_id);
CREATE INDEX IF NOT EXISTS idx_historico_tipo_data ON historico_mensagens(venda_id, tipo, data_envio);

-- 7. Função e Triggers para atualizar o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION trigger_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_atualizado_em_usuarios ON usuarios;
CREATE TRIGGER set_atualizado_em_usuarios
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

DROP TRIGGER IF EXISTS set_atualizado_em_clientes ON clientes;
CREATE TRIGGER set_atualizado_em_clientes
BEFORE UPDATE ON clientes
FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

DROP TRIGGER IF EXISTS set_atualizado_em_vendas ON vendas;
CREATE TRIGGER set_atualizado_em_vendas
BEFORE UPDATE ON vendas
FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

-- 8. Visualização resumida para o Dashboard (Opcional, rápida e eficiente)
CREATE OR REPLACE VIEW view_resumo_dashboard AS
SELECT
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'pendente') AS total_pendentes,
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual IN ('avisado_3d', 'avisado_1d')) AS total_avisados,
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'vencido') AS total_vencidos,
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'pago') AS total_pagos,
    COALESCE(SUM(v.valor) FILTER (WHERE v.ativo = true), 0) AS valor_total_mensal,
    COALESCE(SUM(v.valor) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'pago'), 0) AS valor_total_recebido
FROM vendas v;
