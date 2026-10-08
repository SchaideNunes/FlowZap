# Roadmap do Projeto Flow-Zap

Este documento apresenta o mapeamento completo do ciclo de vida do **Flow-Zap**: detalhando todas as funcionalidades **já desenvolvidas e testadas com sucesso**, bem como as **próximas etapas planejadas**, prioridades técnicas e diretrizes de evolução do sistema.

---

## 📊 Status Atual do Projeto

- **Versão:** 1.2.0
- **Metodologia de Engenharia:** 100% TDD (Test-Driven Development)
- **Suíte de Testes:** 25 arquivos de testes, 161 testes unitários e de integração passando com 100% de sucesso (`Vitest`).
- **Arquitetura:** Clean Architecture no Backend (Node.js + Express + TypeScript + Zod) + React 19 SPA no Frontend (Vite + TypeScript).
- **Banco de Dados:** PostgreSQL em nuvem gerenciado via Supabase.
- **WhatsApp:** Baileys integrado ao backend na máquina-sede (sem Docker), atrás da interface `IWhatsAppGateway`.
- **Hospedagem & Deploy:** Híbrido (Rede Local com máquina-sede + Vercel Multi-Services Cloud).

---

## ✅ 1. O Que Já Foi Feito (Funcionalidades Concluídas)

### 1.1. Infraestrutura, Banco de Dados & Segurança
- [x] **Schema Relacional PostgreSQL no Supabase**:
  - Tabela `usuarios` (perfis de Dono e Sócio com senhas hash `bcryptjs`).
  - Tabela `clientes` (nome, telefone com máscara, e-mail, status ativo/inativo, observações).
  - Tabela `vendas` (vínculo com cliente, valor mensal, dia de vencimento de 1 a 31, modalidade recorrente vs parcelada, número de parcelas, juros, status de pagamento).
  - Tabela `historico_mensagens` (auditoria detalhada de cada disparo enviado com tipo, timestamp e status de entrega).
  - Tabela `contas_a_pagar` (gestão completa de despesas e credores).
- [x] **Segurança & Autenticação JWT**:
  - Hash seguro de senhas com `bcryptjs`.
  - Emissão e verificação de tokens Bearer JWT com expiração configurável.
  - Middleware `authMiddleware` protegendo todas as rotas de API privadas.
  - Contexto de autenticação global no frontend (`AuthContext`) com persistência em `localStorage` e renovação limpa de sessão.
- [x] **Sanitização & Resiliência do Banco de Dados**:
  - Sanitização automática de URLs do Supabase (remoção de barras extras e caminhos residuais).
  - Tratamento tolerante a falhas na inicialização do cliente Supabase para impedir travamento do container caso as variáveis de ambiente ainda não tenham sido configuradas.

### 1.2. Motor de Cobrança Autônomo & Políticas Anti-Ban
- [x] **Cálculo Determinístico de Ciclos & Datas (`date-calculator`)**:
  - Suporte completo a meses de 28, 29 (anos bissextos), 30 e 31 dias.
  - Lógica do botão **"Marcar como Pago"**: avanço determinístico de exatamente 1 mês (`avancarProximoMes()`) sem quebrar vendas criadas em dias como 31 de janeiro ou 29 de fevereiro.
- [x] **Motor de Lembretes com Janela de 3 Avisos (`ReminderService`)**:
  - Um aviso por dia nos 3 dias antes do vencimento: `lembrete_3d`, `lembrete_2d` e `lembrete_1d`. Uma venda que entra na janela depois recebe só os avisos dos dias que restam.
  - Aviso final ("ultimato") no vencimento (`vencido`), uma única vez.
  - **Prevenção de Duplicidade:** O motor consulta a tabela `historico_mensagens` e nunca envia o mesmo tipo de lembrete duas vezes dentro do mesmo ciclo (janela de 20 dias antes do vencimento) e lembra em memória o que já enviou, mesmo que a gravação do histórico falhe.
- [x] **Proteções Anti-Ban WhatsApp de Última Geração (`MessageQueueService`)**:
  - **Fila Sequencial FIFO:** Mensagens processadas uma a uma, impedindo rajadas simultâneas.
  - **Jitter Aleatório:** Atraso dinâmico de 8 a 20 segundos entre cada envio consecutivo.
  - **Simulação de Digitação (`composing`):** Disparo de status "digitando..." por 3 segundos antes do envio para emular comportamento humano.
  - **Rotação de Saudações Dinâmicas:** `TemplateService` rotaciona aberturas ("Olá", "Oi", "Bom dia", "Boa tarde") para impedir que mensagens para clientes diferentes tenham o mesmo hash de texto.
- [x] **Agendador Diário & Disparo Manual sob Demanda**:
  - Tarefa diária automática via `node-cron` executando às 09:00 na máquina-sede.
  - Botão de **"Disparo Manual de Hoje"** na interface com tela de confirmação e listagem prévia de todos os clientes que receberão lembretes.
- [x] **Integração direta com o WhatsApp (Baileys)**:
  - Substituiu a Evolution API: sem Docker, Postgres ou Redis. Reconexão automática com espera crescente, fila que aguarda reconexão e verificação de número com WhatsApp antes do envio.
  - Modal na interface com visualização do **QR Code do WhatsApp** em tempo real e detecção automática de conexão ativa.
  - Sessão do número salva em `backend/.whatsapp-auth`; sessão encerrada pelo celular apaga a sessão e pede novo QR.

### 1.3. Gestão de Clientes, Vendas & Modalidade Parcelada
- [x] **Cadastro e Gestão de Clientes**:
  - Máscara rígida de telefone brasileiro com DDI +55 e 11 dígitos `(DDD) 9XXXX-XXXX`.
  - Validação estrita de contratos de entrada com esquemas Zod.
- [x] **Vendas Recorrentes e Parceladas**:
  - Suporte a vendas recorrentes mensais contínuas.
  - Suporte a vendas parceladas com limite até 12x (ou personalizado), valor por parcela e cálculo opcional de juros.
  - Avanço automático do contador de parcelas (ex: 1/12 -> 2/12) até a liquidação completa da venda.
- [x] **Histórico de Auditoria & Notificações**:
  - Aba de **Notificações & Disparos** exibindo histórico dos envios realizados.
  - Atalho de baixa rápida com 1 clique para marcar como pago direto da lista de notificações.

### 1.4. Contas a Pagar (Quem Devemos) & Balanço Financeiro
- [x] **Módulo Completo de Contas a Pagar**:
  - Tabela, rotas, controller, schema e testes unitários/integração para despesas da empresa e sócios.
  - Separação na interface em aba dedicada **"Quem Devemos"**.
  - Ações de criação, edição, exclusão e botão de liquidação ("Marcar como Pago").
- [x] **Dashboard com Visão de Balanço Integrado**:
  - Card 1: Total a Receber no Mês (Receitas).
  - Card 2: Total a Pagar no Mês (Despesas).
  - Card 3: Saldo Líquido Previsto (A Receber - A Pagar).
  - Indicadores de clientes inadimplentes e cobranças do dia.

### 1.5. UI/UX Fintech & Responsividade Híbrida
- [x] **Planilha Estilo Excel (Desktop/Notebook >=768px)**:
  - Layout expandido ocupando 90vw horizontalmente para visualização de alta densidade de dados com contraste aprimorado.
  - Alinhamento de colunas, cores de status dinâmicas e botões de ação compactos.
- [x] **Modo Cartões Fintech Mobile-First (Smartphones <768px)**:
  - Transformação da tabela em cartões individuais verticais em estilo app bancário (Nubank/Inter).
  - Tipografia de valores em destaque, tags coloridas de status e botões de toque com tamanho mínimo de 44px de altura.
- [x] **Design Anti-AI**:
  - Tema escuro profundo com paleta de cores luminosas e funcionais (verde esmeralda, âmbar, vermelho carmim, ciano).
  - Google Fonts: **Inter** para dados e tabelas; **Outfit** para títulos e números em destaque.
  - Micro-interações suaves de 150-250ms com curva `ease-out`.
- [x] **Resiliência de Frontend**:
  - `ErrorBoundary` envolvendo a aplicação React para prevenir travamento completo da tela.
  - Utilitário `extractErrorMessage()` tratando erros de API e evitando o erro minificado React #31.

### 1.6. Deploy & Distribuição
- [x] **Scripts de Automação Local (Máquina-Sede & Notebook)**:
  - `scripts/iniciar_sede.bat`: Inicialização automatizada de containers e servidores.
  - `scripts/obter_ip_local.bat`: Identificação rápida do IP local para conexão do notebook na mesma rede Wi-Fi.
  - `scripts/criar_atalho_desktop.bat`: Criação de atalhos diretos na Área de Trabalho.
  - `scripts/instalar_agendador_windows.bat`: Registro no Agendador de Tarefas do Windows para inicialização automática no login.
- [x] **Deploy Multi-Serviços na Vercel**:
  - Arquivo [`vercel.json`](file:///d:/Trabalho/Flow-Zap/vercel.json) configurado com o modelo oficial de múltiplos serviços (`backend` Express + `frontend` Vite).
  - Script de empacotamento com `esbuild` gerando [`backend/app.js`](file:///d:/Trabalho/Flow-Zap/backend/app.js) híbrido (CommonJS + ESM) com todas as dependências embutidas, eliminando erros de módulos ausentes no AWS Lambda/Vercel Serverless.
  - Deploy da aplicação compilada com sucesso na Vercel.

---

## 🚀 2. O Que Ainda Precisa Ser Feito (Backlog Priorizado)

Abaixo estão listadas as próximas melhorias, organizadas por ordem de prioridade técnica e impacto de negócio.

---

### 🔴 Prioridade 1: Ativação e Homologação Final em Produção na Vercel
- [x] **Variáveis de Ambiente no Painel Vercel**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `JWT_SECRET` configuradas; painel e API de cadastro no ar.
- [x] **Arquitetura "Vercel só painel, envios só na sede"** (sem mensalidade de nuvem para o envio):
  - Todo envio e o cron rodam exclusivamente na máquina-sede. O painel da Vercel consulta, cadastra e marca como pago (tudo via Supabase), mas não envia: o botão de disparo e o QR Code ficam ocultos e a API recusa o disparo (409).
  - Rotina ao ligar: se o computador estava desligado às 09:00, a sede executa a rotina do dia ao iniciar (`SchedulerService.runCatchUpIfNeeded`), protegida pelo anti-duplicidade.
  - Indicador "Sede online/offline": a sede grava um sinal de vida a cada minuto e o estado do WhatsApp na tabela `sede_status`, exibidos no painel online.
- [x] **`database/migration_sede_status.sql` executada** (tabela `sede_status`).
- [ ] **Executar `database/migration_lembrete_2d.sql` no Supabase** (aceita o tipo `lembrete_2d` no histórico). Obrigatória antes de disparar com a regra nova: sem ela o aviso de 2 dias é enviado, mas o histórico não é gravado.
- [ ] **Teste real de envio**: conectar um chip de teste, enviar para outro número e validar QR Code, reconexão (reiniciar, cair a internet, desconectar pelo celular) e a janela de avisos.
- [ ] **Salvaguardas anti-ban adicionais**: limite diário de mensagens, opção de sair da lista ("responda SAIR") e aquecimento gradual do número.
- [ ] **Homologação Ponta a Ponta na URL da Vercel**:
  - Realizar login com as credenciais do Dono e do Sócio diretamente no domínio de produção.
  - Validar criação de cliente, alteração de status e confirmação de pagamento.

---

### 🟡 Prioridade 2: Pagamentos PIX & Mensagens Automatizadas Aprimoradas
- [ ] **Chave PIX Copia-e-Cola no Lembrete do WhatsApp**:
  - Adicionar campo no cadastro de configurações para definir a Chave PIX padrão (CPF, CNPJ, Telefone ou Chave Aleatória) e o Nome do Titular.
  - Incluir automaticamente a linha "Chave PIX Copia-e-Cola:" formatada na mensagem do WhatsApp para facilitar o pagamento pelo cliente com 1 toque.
- [ ] **Geração de QR Code PIX Estático / Dinâmico**:
  - Adicionar suporte à geração do payload EMV do Banco Central (PIX Copia e Cola) direto no backend.
  - Opção de enviar a imagem do QR Code PIX como anexo pelo WhatsApp.
- [ ] **Envio de Comprovante / Recibo de Quitação**:
  - Ao clicar em "Marcar como Pago", disparar uma mensagem opcional de confirmação para o WhatsApp do cliente agradecendo pelo pagamento e informando o próximo vencimento.

---

### 🟡 Prioridade 3: Relatórios Financeiros, Exportação & Métricas Avançadas
- [ ] **Exportação para Planilha Excel (.xlsx) e CSV**:
  - Botão de exportar lista de clientes, vendas ativas e cobranças pendentes para arquivo `.xlsx` compatível com Excel.
  - Botão de exportar extrato completo de Contas a Pagar para conciliação contábil.
- [ ] **Filtros Avançados & Busca Dinâmica**:
  - Filtro por mês/ano de competência nas telas de Clientes e Contas a Pagar.
  - Filtro por faixa de dias de atraso (ex: Atrasados há mais de 5 dias, 15 dias ou 30 dias).
  - Filtro por credor/categoria em Contas a Pagar.
- [ ] **Gráficos e Indicadores Visuais no Dashboard**:
  - Gráfico de barras com faturamento realizado vs previsto para os próximos 6 meses.
  - Gráfico de pizza com proporção de receitas recorrentes vs parceladas.
  - Taxa percentual de adimplência do mês corrente.

---

### 🟢 Prioridade 4: Webhooks Reversos & Interação com o Cliente
- [ ] **Webhook de Resposta do Cliente no WhatsApp**:
  - Tratamento no backend das mensagens recebidas pelo Baileys (evento `messages.upsert`).
  - Identificar mensagens de clientes com palavras-chave (ex: "paguei", "comprovante", "boleto").
  - Exibir alerta ou badge no painel sinalizando: "Cliente X respondeu à cobrança".
- [ ] **Disparo Manual Personalizado por Cliente**:
  - Botão na linha de cada cliente para enviar um lembrete imediato com texto editável na hora, sem depender da rotina geral matinal.

---

### 🟢 Prioridade 5: Auditoria, Perfis de Acesso & Segurança Avançada
- [ ] **Registro de Auditoria por Usuário (Dono vs Sócio)**:
  - Adicionar colunas `criado_por` e `atualizado_por` nas tabelas `vendas`, `clientes` e `contas_a_pagar`.
  - Exibir no histórico quem foi o sócio que deu baixa no pagamento ou excluiu um registro.
- [ ] **Recuperação de Senha & Troca no Painel**:
  - Tela de edição de perfil para permitir que cada sócio altere sua senha de acesso diretamente pelo sistema.
- [ ] **Autenticação em Dois Fatores (2FA / OTP)**:
  - Envio de código OTP opcional no WhatsApp do administrador para autorizar novos logins a partir de computadores desconhecidos.

---

## 📈 3. Tabela Comparativa de Evolução

| Funcionalidade | Status | Ambiente | Complexidade |
| :--- | :---: | :---: | :---: |
| CRUD de Clientes & Validação Zod | Concluído ✅ | Local & Nuvem | Baixa |
| Cobranças Recorrentes & Parceladas | Concluído ✅ | Local & Nuvem | Média |
| Avanço Inteligente de Ciclo (+1 Mês) | Concluído ✅ | Local & Nuvem | Média |
| Fila FIFO com Jitter e Anti-Ban | Concluído ✅ | Local & Nuvem | Alta |
| Rotina Diária Automática (Cron 09h) | Concluído ✅ | Local (Sede) | Média |
| Módulo Contas a Pagar (Quem Devemos) | Concluído ✅ | Local & Nuvem | Média |
| Planilha Excel 90vw (Desktop) | Concluído ✅ | Local & Nuvem | Média |
| Cartões Fintech Mobile-First (<768px) | Concluído ✅ | Local & Nuvem | Média |
| Bundle Backend Híbrido com esbuild | Concluído ✅ | Nuvem (Vercel) | Alta |
| Variáveis de Ambiente no Painel Vercel | **Próximo Passo ⏳** | Nuvem (Vercel) | Baixa |
| Gateway WhatsApp Remoto (Túnel/VPS) | **Próximo Passo ⏳** | Nuvem | Média |
| PIX Copia-e-Cola nas Mensagens | **Planejado 📋** | Local & Nuvem | Baixa |
| Exportação para Excel (.xlsx) | **Planejado 📋** | Local & Nuvem | Média |
| Webhook de Resposta do Cliente | **Planejado 📋** | Local & Nuvem | Alta |
| Auditoria de Ações por Sócio | **Planejado 📋** | Local & Nuvem | Média |

---

## 📌 4. Diretrizes de Continuidade

Qualquer nova funcionalidade a ser implementada deve respeitar rigorosamente as diretrizes documentadas em [`CLAUDE.md`](file:///d:/Trabalho/Flow-Zap/CLAUDE.md):
1. **Escrever testes antes do código (TDD)**.
2. **Manter 100% dos testes passando** antes de qualquer commit.
3. **Não alterar a paleta refinada dark nem violar o design mobile-first**.
4. **Nunca expor segredos no repositório**.
5. **Recompilar o bundle `backend/app.js` (`node build.mjs`) sempre que houver alterações no backend**.
