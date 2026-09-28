# Flow-Zap: Sistema de Cobrança Recorrente via WhatsApp

Sistema autônomo para pequenos empresários gerenciarem cobranças mensais recorrentes de clientes, com envio de lembretes automáticos e seguros via WhatsApp (Evolution API).

## 🚀 Arquitetura Geral

- **Banco de Dados**: Supabase (PostgreSQL Gerenciado na Nuvem - Plano Gratuito).
  - Permite que ambas as máquinas (desktop e notebook) acessem e modifiquem os mesmos dados com consistência total.
- **Motor de Automação (Backend + WhatsApp + Cron)**:
  - Roda continuamente na **máquina-sede**.
  - Node.js + Express + TypeScript com arquitetura limpa (Controllers, Services, Repositories, DTOs).
  - Testes automatizados (TDD com Vitest).
- **Gateway WhatsApp**:
  - Evolution API v2 em container Docker com volume persistente para a sessão multi-device.
  - Mecanismos anti-ban: jitter/delay randômico entre mensagens (8 a 20s), simulação de presença humana ("digitando..."), fila sequencial e templates dinâmicos.
- **Frontend**:
  - React + TypeScript + Vite.
  - Acessível localmente (`localhost:5173`) na máquina-sede e via rede local (`http://<IP_DA_SEDE>:5173`) na segunda máquina.
- **Autenticação**:
  - Sistema com suporte aos 2 logins (dono e sócio/parceiro), senhas com hash Bcrypt e tokens JWT.

---

## 📂 Estrutura de Diretórios

```
Flow-Zap/
├── backend/                  # API REST, agendador, serviços de cobrança e WhatsApp
│   ├── src/
│   │   ├── controllers/      # Controladores HTTP
│   │   ├── services/         # Regras de negócio, filas e anti-ban
│   │   ├── repositories/     # Acesso a dados (Supabase/Postgres)
│   │   ├── schemas/          # Validações Zod (DTOs)
│   │   ├── middleware/       # Autenticação JWT e tratamento de erros
│   │   └── config/           # Variáveis de ambiente e clientes
│   ├── Dockerfile
│   └── package.json
├── frontend/                 # Painel Web responsivo
│   ├── src/
│   ├── index.html
│   └── package.json
├── database/                 # Modelagem e migrações SQL
│   ├── schema.sql            # Script DDL completo para o Supabase
│   └── seed_users.sql        # Criação inicial dos dois usuários
├── docker-compose.yml        # Orquestração do Evolution API e serviços
├── .env.example              # Modelo de variáveis de ambiente
└── README.md
```

---

## 🛠️ Passo a Passo para Configuração Inicial (Etapa 1)

### 1. Criar o Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto gratuito.
2. No menu lateral esquerdo, vá em **SQL Editor**.
3. Copie todo o conteúdo do arquivo [`database/schema.sql`](file:///d:/Trabalho/Flow-Zap/database/schema.sql) e clique em **Run**.
4. Em seguida, copie o conteúdo de [`database/seed_users.sql`](file:///d:/Trabalho/Flow-Zap/database/seed_users.sql) e clique em **Run**.
5. No Supabase, vá em **Project Settings** -> **API**:
   - Copie a **Project URL** (ex: `https://xyz.supabase.co`).
   - Copie a chave **service_role** (Secret Key).

### 2. Configurar o `.env`
Crie um arquivo `.env` na raiz do projeto (e/ou em `backend/.env`) copiando de `.env.example` e inserindo suas credenciais:
```bash
cp .env.example .env
```

### 3. Subir a Evolution API via Docker
Na máquina-sede:
```bash
docker compose up -d evolution-api
```
A Evolution API estará pronta na porta `8080`.
