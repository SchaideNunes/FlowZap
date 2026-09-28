-- ==============================================================================
-- FLOW-ZAP: Seed de Usuários (AEV Celulares)
-- Execute este script no SQL Editor do Supabase se precisar recriar os usuários
-- Email: aevcelulares@outlook.com
-- Senha: AEVStore@123
-- ==============================================================================

-- Inserir usuário principal (AEV Celulares)
INSERT INTO usuarios (nome, email, senha_hash, ativo)
VALUES (
    'AEV Celulares',
    'aevcelulares@outlook.com',
    -- Hash real para 'AEVStore@123' gerado pelo bcrypt
    '$2a$10$n1VF8FhsWGEkCMdF0UK4bOBYLRUdpH43QwRy.dMCX3n08j.1jDPjO',
    true
)
ON CONFLICT (email) DO UPDATE
SET senha_hash = EXCLUDED.senha_hash,
    nome = EXCLUDED.nome;
