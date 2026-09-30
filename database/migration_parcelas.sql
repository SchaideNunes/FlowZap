-- ============================================================================
-- FlowZap - Migração: Suporte a Parcelamento, Juros e Controle de Parcelas
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para adicionar as colunas de parcelas:

ALTER TABLE vendas 
ADD COLUMN IF NOT EXISTS valor_total NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS taxa_juros NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_parcelas INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parcela_atual INTEGER DEFAULT 1;

-- Comentários das colunas
COMMENT ON COLUMN vendas.valor_total IS 'Valor total da compra antes ou com juros';
COMMENT ON COLUMN vendas.taxa_juros IS 'Taxa percentual de juros aplicada (opcional)';
COMMENT ON COLUMN vendas.total_parcelas IS 'Quantidade total de parcelas (1 = à vista, >1 = parcelado, NULL = recorrente contínuo)';
COMMENT ON COLUMN vendas.parcela_atual IS 'Número da parcela atual em aberto';
