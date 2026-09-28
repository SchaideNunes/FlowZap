-- ==============================================================================
-- FLOW-ZAP: Seed de Usuários Iniciais (Dono e Sócio)
-- Execute este script no SQL Editor do Supabase após rodar o schema.sql
-- Senha padrão temporária para ambos: FlowZap@2026 (trocar no primeiro acesso)
-- Hash bcrypt gerado com 10 salt rounds: $2b$10$wE0vA9XjW9BvK9T3C2X3q.8kU21sJd1WkPZ0x7a8qf2W6V9QyK.iK (exemplo)
-- Também há um script interativo de seed no backend (npm run seed:users)
-- ==============================================================================

-- Inserir usuário 1 (Dono)
INSERT INTO usuarios (nome, email, senha_hash, ativo)
VALUES (
    'Dono da Empresa',
    'admin@flowzap.com',
    -- Hash para 'FlowZap@2026' gerado pelo bcrypt
    '$2a$12$NqR5c483hB2fRrqdF0gZt.85k41Z336xU0G9TsmU84s/yHh1N5b.e',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Inserir usuário 2 (Sócio / Amigo)
INSERT INTO usuarios (nome, email, senha_hash, ativo)
VALUES (
    'Sócio / Parceiro',
    'socio@flowzap.com',
    -- Hash para 'FlowZap@2026' gerado pelo bcrypt
    '$2a$12$NqR5c483hB2fRrqdF0gZt.85k41Z336xU0G9TsmU84s/yHh1N5b.e',
    true
)
ON CONFLICT (email) DO NOTHING;
