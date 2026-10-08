# Flow-Zap: Sistema de Cobrança Recorrente via WhatsApp

Sistema web autônomo para gerenciamento de cobranças mensais recorrentes de clientes com lembretes automáticos e seguros enviados via WhatsApp (biblioteca Baileys, sem Docker).

Projetado com arquitetura distribuída para permitir acesso simultâneo a partir de duas máquinas (computador de mesa e notebook) através de banco em nuvem gerenciado (Supabase - Plano Gratuito) e motor de envio executado na máquina designada como sede.

---

## 🌟 Principais Recursos

1. **Gestão de Clientes e Vendas Independentes**:
   - Cada cliente pode ter múltiplos planos/cobranças simultâneas, cada uma com seu próprio valor mensal e dia de vencimento (1 a 31).
   - Encerramento ou pausa de cobranças individuais sem desativar o cadastro do cliente.
2. **Ciclos Mensais Automáticos & Confirmação de Pagamento**:
   - Botão **"Marcar como Pago"** individual por cobrança: avança automaticamente a data de vencimento em +1 mês (tratando meses com 28, 29, 30 ou 31 dias) e reseta o status para pendente.
   - Histórico completo de eventos auditado (`historico_mensagens`).
3. **Disparos Automáticos & Botão de Disparo Manual**:
   - **Rotina Automática (node-cron)**: Roda diariamente às 09:00 na máquina-sede.
   - **Disparo Manual de Hoje**: Permite disparar sob demanda (ex: se o computador esteve desligado no horário agendado) com tela de confirmação e pré-visualização de todos os destinatários antes de enviar.
   - **Momentos dos Lembretes**:
     - 3 dias antes do vencimento (`lembrete_3d`)
     - 1 dia antes do vencimento (`lembrete_1d`)
     - No dia do vencimento (`vencido`)
   - **Prevenção de Duplicidade**: Nunca envia a mesma notificação duas vezes no mesmo ciclo.
4. **Proteções Anti-Ban WhatsApp de Última Geração**:
   - **Fila Sequencial (FIFO)**: Mensagens nunca são enviadas simultaneamente.
   - **Jitter Aleatório**: Intervalo dinâmico de 8 a 20 segundos entre cada envio.
   - **Simulação de Digitação (`composing`)**: O WhatsApp mostra "digitando..." por 3 segundos antes do envio, emulando ação humana.
   - **Saudações Dinâmicas**: Rotação de palavras de abertura para evitar assinaturas estáticas de bot.
5. **Acesso em Rede Local (Host & Notebook)**:
   - Acesso local via `http://localhost:5173` na máquina-sede.
   - Acesso em qualquer dispositivo na mesma rede local via `http://<IP_DA_SEDE>:5173`.
6. **Autenticação Dupla (Dono & Sócio)**:
   - Dois logins individuais protegidos por senhas com hash Bcrypt e tokens JWT.
7. **Inicialização Automática com o Windows**:
   - Tarefa configurada no Agendador de Tarefas do Windows para ligar os serviços silenciosamente ao fazer logon.

---

## 🏗️ Stack Tecnológica & Arquitetura

- **Backend**: Node.js + Express + TypeScript (Clean Architecture: Controllers, Services, Repositories, DTOs com Zod)
- **Frontend**: React 19 + TypeScript + Vite + Design System sob medida (Google Fonts Outfit & Inter, paleta refinada slate/emerald, micro-interações 150-250ms)
- **Banco de Dados**: Supabase (PostgreSQL em Nuvem - Gratuito)
- **WhatsApp**: Baileys integrado ao backend (sessão salva em pasta local, reconexão automática, sem Docker)
- **Testes**: Vitest (100% TDD - 123 testes unitários e de integração passando)

---

## 📋 Guia de Instalação e Configuração

### Passo 1: Configuração do Supabase (Banco de Dados)
1. Acesse [supabase.com](https://supabase.com) e crie um projeto gratuito.
2. No menu lateral esquerdo, vá em **SQL Editor**.
3. Abra e copie todo o conteúdo de [`database/setup_completo.sql`](database/setup_completo.sql) e clique em **Run** (cria todas as tabelas, com RLS ativado). Se o banco já existia antes da tabela `sede_status`, rode apenas [`database/migration_sede_status.sql`](database/migration_sede_status.sql).
4. Os logins do Dono e do Sócio são criados à parte, com senha em hash bcrypt, direto no banco (não ficam no repositório).
5. Em **Project Settings** > **API**, copie a **Project URL** e a chave **service_role**.

### Passo 2: Configuração das Variáveis de Ambiente
Crie o arquivo `.env` na raiz do projeto copiando o modelo:
```bash
cp .env.example .env
```
Preencha com suas chaves:
```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
JWT_SECRET=uma_chave_jwt_muito_segura_com_mais_de_32_caracteres_aleatorios_12345
```

### Passo 3: Iniciar o Sistema na Máquina Sede
Basta dar dois cliques no script:
```bash
scripts\iniciar_sede.bat
```
Ou manualmente via terminal:
```bash
# Em um terminal: Backend
cd backend && npm run dev

# Em outro terminal: Frontend
cd frontend && npm run dev
```

### Passo 4: Conectar o WhatsApp
1. Abra o painel no navegador: `http://localhost:5173`.
2. Entre com o seu login.
3. Clique no botão de QR Code no topo da tela.
4. Abra o WhatsApp no celular: **Aparelhos conectados** > **Conectar aparelho** e leia o QR Code.
5. Pronto! A sessão fica salva em `backend/.whatsapp-auth` e o sistema se reconecta sozinho após quedas e reinicializações. Só é preciso ler o QR Code de novo se o aparelho for desconectado pelo celular.

---

## ☁️ Painel Online (Vercel) e Máquina-Sede

Os **envios de WhatsApp e o cron das 09:00 rodam somente no computador da loja (sede)**. O painel publicado na Vercel funciona como acesso remoto: consultar clientes, vendas e histórico, cadastrar e marcar pagamentos. Nele, o botão de disparo e o QR Code não aparecem, e um indicador mostra se a sede está **online/offline** e se o WhatsApp está conectado.

- O computador da loja precisa estar ligado e com internet para os lembretes saírem.
- Se ele ligar depois das 09:00, a rotina do dia é executada automaticamente ao iniciar.

---

## 💻 Acesso a Partir do Notebook (Segunda Máquina)

1. Na **máquina-sede**, execute `scripts\obter_ip_local.bat` para descobrir o IP local (ex: `192.168.1.50`).
2. No **notebook/segunda máquina**, abra o navegador e acesse:
   ```
   http://192.168.1.50:5173
   ```
3. Ambos podem usar o sistema simultaneamente, cadastrar clientes e confirmar pagamentos em tempo real!

---

## ⚡ Atalhos na Área de Trabalho & Inicialização com o Windows

- **Criar Atalho na Área de Trabalho**:
  Execute `scripts\criar_atalho_desktop.bat` (funciona tanto na sede quanto no notebook).
- **Iniciar Sozinho ao Ligar a Máquina Sede**:
  Execute `scripts\instalar_agendador_windows.bat` como Administrador para cadastrar a tarefa no Agendador de Tarefas do Windows.

---

## 🧪 Suíte de Testes Automatizados (TDD)

Para rodar todos os testes unitários e de integração:
```bash
cd backend
npm test
```
Para ver o relatório de cobertura de código:
```bash
npm run test:coverage
```
