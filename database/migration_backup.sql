-- ==============================================================================
-- FlowZap - Migração: Backup
-- ==============================================================================
-- Execute no SQL Editor do Supabase.
--   1. sede_status.ultimo_backup_em: data do último backup automático feito pela
--      máquina-sede (o painel online mostra essa data).
--   2. flowzap_ajustar_sequencias(): depois de restaurar um backup (que regrava as linhas
--      com os ids originais), alinha os contadores de id para os próximos cadastros.
-- O backup funciona sem esta migração; só não mostra a data no painel online, e a
-- restauração avisa que os contadores não foram ajustados.

ALTER TABLE sede_status ADD COLUMN IF NOT EXISTS ultimo_backup_em TIMESTAMPTZ;

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
