-- ==============================================================================
-- FLOW-ZAP: Setup Completo do Banco de Dados (Supabase / PostgreSQL)
-- ==============================================================================
-- Para um projeto Supabase NOVO: cole este arquivo inteiro no SQL Editor e execute.
-- Reúne schema.sql + migration_parcelas.sql + migration_contas_a_pagar.sql e ativa
-- RLS em todas as tabelas. Pode ser executado mais de uma vez sem duplicar nada.
-- Os usuários de login NÃO são criados aqui (nenhuma senha fica no repositório).
-- ==============================================================================

-- 1. Tabela de Usuários (Autenticação para o dono e o sócio)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Clientes (Dados cadastrais)
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de Vendas (Cobranças recorrentes ou parceladas por cliente)
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

-- 4. Tabela de Histórico de Mensagens
CREATE TABLE IF NOT EXISTS historico_mensagens (
    id BIGSERIAL PRIMARY KEY,
    venda_id BIGINT NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (
        tipo IN ('lembrete_3d', 'lembrete_2d', 'lembrete_1d', 'vencido', 'confirmacao_manual')
    ),
    data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_envio TEXT NOT NULL CHECK (status_envio IN ('enviado', 'falha')),
    mensagem TEXT,
    detalhes JSONB
);

-- 5. Tabela de Contas a Pagar / Credores (Quem Devemos)
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

-- 5.1. Status da Máquina-Sede (uma única linha: sinal de vida, estado do WhatsApp e última rotina)
CREATE TABLE IF NOT EXISTS sede_status (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    estado_whatsapp TEXT NOT NULL DEFAULT 'close',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultima_rotina_data DATE,
    ultimo_backup_em TIMESTAMPTZ
);
ALTER TABLE sede_status ADD COLUMN IF NOT EXISTS ultimo_backup_em TIMESTAMPTZ;

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

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_pago ON contas_a_pagar(pago);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_vencimento ON contas_a_pagar(data_vencimento);

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

DROP TRIGGER IF EXISTS set_atualizado_em_contas_a_pagar ON contas_a_pagar;
CREATE TRIGGER set_atualizado_em_contas_a_pagar
BEFORE UPDATE ON contas_a_pagar
FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

-- 8. Visualização resumida para o Dashboard (respeita o RLS de quem consulta)
CREATE OR REPLACE VIEW view_resumo_dashboard
WITH (security_invoker = true) AS
SELECT
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'pendente') AS total_pendentes,
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual IN ('avisado_3d', 'avisado_1d')) AS total_avisados,
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'vencido') AS total_vencidos,
    COUNT(*) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'pago') AS total_pagos,
    COALESCE(SUM(v.valor) FILTER (WHERE v.ativo = true), 0) AS valor_total_mensal,
    COALESCE(SUM(v.valor) FILTER (WHERE v.ativo = true AND v.status_mes_atual = 'pago'), 0) AS valor_total_recebido
FROM vendas v;

-- 9. Row Level Security: bloqueia o acesso pelas chaves públicas (anon/publishable).
-- O backend usa a chave service_role, que ignora o RLS, então nada muda para o sistema.
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_a_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE sede_status ENABLE ROW LEVEL SECURITY;

-- Configurações: mensagens personalizadas e liga/desliga do envio automático (linha única)
CREATE TABLE IF NOT EXISTS configuracoes (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    envio_automatico BOOLEAN NOT NULL DEFAULT true,
    mensagens JSONB NOT NULL DEFAULT '{}'::jsonb,
    chave_pix TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS chave_pix TEXT;

DROP TRIGGER IF EXISTS set_atualizado_em_configuracoes ON configuracoes;
CREATE TRIGGER set_atualizado_em_configuracoes
BEFORE UPDATE ON configuracoes
FOR EACH ROW EXECUTE FUNCTION trigger_set_atualizado_em();

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Backup: alinha os contadores de id depois de uma restauração
CREATE OR REPLACE FUNCTION flowzap_ajustar_sequencias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM setval(pg_get_serial_sequence('clientes', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM clientes), 1));
    PERFORM setval(pg_get_serial_sequence('vendas', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM vendas), 1));
    PERFORM setval(pg_get_serial_sequence('historico_mensagens', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM historico_mensagens), 1));
    PERFORM setval(pg_get_serial_sequence('contas_a_pagar', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM contas_a_pagar), 1));
END;
$$;

-- Só o backend (service_role) pode chamar
REVOKE ALL ON FUNCTION flowzap_ajustar_sequencias() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION flowzap_ajustar_sequencias() TO service_role;
