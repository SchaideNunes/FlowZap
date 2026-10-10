# Diretrizes & Regras do Projeto Flow-Zap (CLAUDE.md)

Este documento define o conjunto mandatório de regras de arquitetura, qualidade de código, design, segurança e operação do projeto **Flow-Zap**. Qualquer agente de IA ou desenvolvedor atuando neste repositório **DEVE** seguir integralmente estas diretrizes sem exceção.

---

## 1. Visão Geral do Sistema

O **Flow-Zap** é um sistema financeiro web e motor autônomo de gestão de cobranças recorrentes e parceladas via WhatsApp (integrado diretamente ao WhatsApp pela biblioteca Baileys, sem Docker). O projeto foi desenhado para operação híbrida:
- **Operação Local / Rede Interna**: Máquina-sede executando o backend Node (conexão WhatsApp via Baileys, cron diário e fila anti-ban), acessível na rede local pelo notebook do sócio. Não usa Docker.
- **Operação Cloud / Serverless**: Frontend em React 19 (Vite) e Backend Express em TypeScript preparados para deploy multi-serviços na Vercel com banco em nuvem gerenciado no Supabase (PostgreSQL).

---

## 2. Regras Globais de Engenharia & Qualidade

### 2.1. Strict TDD & Red-Green-Refactor
- **Regra de Ouro:** Nenhuma nova rota, serviço, cálculo ou mutação deve ser implementada sem antes escrever testes automatizados que falham (*Red*).
- **Ciclo:** Teste falhando -> Implementação mínima para passar (*Green*) -> Refatoração com garantia de qualidade (*Refactor*).
- **Cobertura:** 100% de testes passando (`npm test` no backend com Vitest). Nenhuma funcionalidade é considerada concluída sem suíte de testes íntegra.
- **Arquitetura de Testes:** Testes unitários com mocks para banco/gateway de WhatsApp e testes de integração de fluxo de cobrança e datas.

### 2.2. Conventional Commits Estritos
Todos os commits do repositório devem seguir o padrão Conventional Commits com mensagens atômicas e em português ou inglês padronizado:
- `feat:` Nova funcionalidade para o usuário ou API.
- `fix:` Correção de bug ou erro em produção/desenvolvimento.
- `test:` Adição ou ajuste de testes unitários/integração.
- `refactor:` Alteração de código sem mudança de comportamento externo.
- `style:` Ajustes puramente estéticos (CSS, formatação, espaçamento).
- `perf:` Melhoria comprovada de performance ou bundle.
- `docs:` Alterações em documentações (`README.md`, `CLAUDE.md`, `ROADMAP.md`).
- `chore:` Tarefas de manutenção de build, scripts ou dependências.

### 2.3. Security by Design
- **Segredo Zero em Git:** NUNCA comitar arquivos `.env`, segredos, API keys, tokens de serviço do Supabase ou segredos de JWT. Arquivos `.env` permanecem sempre no `.gitignore`.
- **Prevenção contra SQL Injection:** Proibida interpolação direta de strings em queries. Todas as chamadas ao Supabase/PostgreSQL devem utilizar consultas parametrizadas via cliente oficial.
- **Validação de Schemas:** Todo payload de entrada (rotas POST/PUT/PATCH, query params) DEVE ser rigorosamente validado através de esquemas **Zod** antes de atingir as camadas de serviço.
- **Criptografia & Autenticação:**
  - Senhas sempre com hash seguro via `bcryptjs` (salt rounds padrão).
  - Rotas autenticadas obrigatoriamente protegidas pelo middleware `authMiddleware` via Bearer JWT.
  - Sanitização de URLs de entrada e saída.

### 2.4. Clean Architecture & Tipagem Estrita
A organização do backend deve manter uma separação clara e unidirecional de responsabilidades:
1. **Controllers (`src/controllers/`)**: Recebem a requisição HTTP, acionam a validação Zod, invocam os serviços e retornam a resposta formatada. Não contêm lógica de negócio direta nem chamadas SQL.
2. **Services (`src/services/`)**: Implementam a lógica de negócio pura (cálculos de datas, disparos, regras de parcelamento, fila de mensagens). Dependem de interfaces de repositórios.
3. **Repositories (`src/repositories/`)**: Implementações de acesso a dados (Supabase) separadas por interfaces (`*.repository.interface.ts`). Permitem mock completo nos testes sem necessidade de banco real ativo.
4. **DTOs & Schemas (`src/schemas/`)**: Contratos de dados estritos validados com Zod e inferência de tipos TypeScript (`z.infer<typeof schema>`).
5. **Tipagem Estrita:** TypeScript com `noImplicitAny: true`, `strict: true`. Nunca usar `any` desnecessário; sempre tratar valores nulos e indefinidos (`null | undefined`).

---

## 3. Diretrizes de Frontend & Design Anti-AI

### 3.1. Identidade Visual (A&V Store) & Design Anti-AI
- **Não ao Genérico:** Proibido utilizar templates clichês de IA (gradientes, brilhos/glow, hover scales exagerados ou cores decorativas sem significado).
- **Marca em preto e branco**, tirada da logo do cliente (`frontend/public/logo.webp`; original em `frontend/src/assets/brand/`). Interface escura e minimalista.
  - Superfícies: `--bg-main #0a0a0a`, `--bg-card #141414`, `--bg-inset #0f0f0f`, `--bg-raised #262626`; linhas finas `rgba(255,255,255,0.09)`.
  - Texto: `--text-main #f5f5f5`, `--text-muted #a8a8a8`, `--text-dim #858585` (todos com contraste AA sobre as superfícies).
  - **Ação principal da tela:** botão branco com texto preto (`.btn-primary`), **uma por tela**. As demais usam contorno (`.btn-secondary`); confirmar pagamento usa `.btn-pay`.
- **Cor só para status.** São as únicas cores da interface, validadas para daltonismo e contraste:
  - **Verde (`--success #5ee08f`)**: pago, recebido, conectado.
  - **Âmbar (`--warning #f5a524`)**: avisado, a vencer, atenção.
  - **Vermelho (`--danger #f06a6a`)**: vencido, erro, exclusão.
  - A cor nunca vai sozinha: sempre com rótulo ou ícone. Valores numéricos usam a cor do texto; o estado aparece em um ponto colorido (`.status-dot`) ao lado do rótulo.
  - Azul, roxo e outros tons decorativos não fazem parte da paleta.
- **Sem cores fixas nos componentes:** usar sempre as variáveis de `frontend/src/index.css` (`var(--success)`, `rgba(var(--danger-rgb), 0.12)` etc.).
- **Componentes compartilhados:** `components/ui/PageHeader`, `StatTile` e `EmptyState`; formatação em `utils/format.ts` (`formatBRL`, `formatDateBR`, `todayISO`).
- **Tipografia:** Google Fonts aplicadas:
  - **Inter**: Para dados tabulares, textos corridos, badges e inputs (máxima legibilidade).
  - **Outfit**: Para títulos (`h1`, `h2`), métricas de KPI e cabeçalhos de destaque.
- **Micro-interações:** Transições suaves de 150ms a 250ms com curva `ease-out`. Bordas sutis com transparência (`rgba(255,255,255,0.08)`).
- **Performance:** Imagens e ícones em SVG ou WebP comprimidos.

### 3.2. Responsividade Híbrida (Desktop vs Mobile)
- **Telas Desktop / Notebook (>=768px):**
  - Visualização em **Planilha Estilo Excel** preenchendo ~90vw horizontalmente.
  - Colunas alinhadas, badges de status legíveis e botões de ação rápida ("Marcar como Pago", "Editar", "Excluir").
- **Telas Smartphone (<768px):**
  - **Visão em Cartões Fintech Mobile-First (estilo Nubank/Inter)**: Ao invés de tabelas cortadas horizontalmente, o layout se transforma em cards táteis otimizados para o polegar, com valores em destaque, data de vencimento e botões de toque largo (mínimo 44px de altura).
  - **Navegação na base da tela**: as abas viram uma barra inferior fixa, ao alcance do polegar.
  - Tabelas sem cartões próprios usam a classe `.stack-table` com `data-label` em cada `<td>` (cada linha vira um cartão).
  - **Nenhuma tela pode ter rolagem horizontal** da página, em nenhuma largura.
- **Resiliência e Tolerância a Falhas:**
  - O frontend DEVE conter um componente `ErrorBoundary` em volta da árvore de rotas.
  - Todo consumo de erro da API deve usar o utilitário `extractErrorMessage()` para prevenir que objetos de resposta acionem o erro React #31 (*Objects are not valid as a React child*).

---

## 4. Políticas de Mensageria & WhatsApp Anti-Ban

O motor de cobrança segue rigorosamente as melhores práticas para proteção contra bloqueios de números no WhatsApp:

1. **Fila Sequencial (FIFO):**
   - Mensagens nunca são disparadas de forma assíncrona concorrente em lote.
   - Cada mensagem aguarda a conclusão da anterior.
2. **Jitter Aleatório (Intervalo Variável):**
   - Entre cada disparo sucessivo, o sistema aplica um atraso aleatório configurável (padrão entre 8 e 20 segundos) para simular comportamento humano.
3. **Simulação de Digitação Humana (`composing`):**
   - Antes do envio do texto, o sistema envia o estado `composing` ("digitando...") por 3 segundos, sinalizando atividade humana para os servidores da Meta.
4. **Saudações Dinâmicas:**
   - O `TemplateService` rotaciona aleatoriamente saudações no início das mensagens ("Olá", "Oi", "Bom dia", "Boa tarde"), impedindo que todas as mensagens possuam o mesmo hash de texto idêntico.
5. **Fila que Espera, Não Falha:**
   - Se o WhatsApp estiver desconectado, a fila aguarda a reconexão em vez de registrar falha.
   - Números sem conta no WhatsApp (`onWhatsApp`) nunca recebem envio; o erro é registrado no histórico.
6. **Prevenção de Duplicidade:**
   - O sistema audita cada envio na tabela `historico_mensagens`. Uma cobrança nunca recebe o mesmo tipo de lembrete mais de uma vez dentro do mesmo ciclo mensal.

---

## 5. Regras de Negócio do Domínio Financeiro

### 5.1. Clientes e Vendas Independentes
- Um cliente pode possuir múltiplos contratos ou planos simultâneos (ex: plano familiar + plano individual).
- Cada venda possui seu próprio valor mensal, dia de vencimento (1 a 31), modalidade (recorrente mensal ou parcelada com/sem juros) e status (`ativo`, `pausado`, `encerrado`).
- O encerramento ou pausa de uma venda não altera o cadastro de outras vendas do mesmo cliente.

### 5.2. Ciclos Mensais e "Marcar como Pago"
- Ao marcar uma venda como paga:
  - O sistema calcula a data do próximo vencimento somando exatamente 1 mês (`avancarProximoMes()`).
  - O cálculo considera de forma determinística meses de 28, 29 (ano bissexto), 30 e 31 dias. Se uma venda vence no dia 31 e o próximo mês tem 30 dias, o vencimento é ajustado para o dia 30.
  - O status de pagamento é reiniciado para pendente para o novo ciclo.
  - Como a venda segue na lista já no ciclo seguinte, o pagamento fica registrado em `historico_mensagens` (`confirmacao_manual`, com valor, vencimento e parcela pagos em `detalhes`) e aparece na aba **Pagos** de "Clientes e vendas" (`GET /api/vendas/pagamentos`).
  - **Desfazer pagamento** (`POST /api/vendas/pagamentos/:id/desfazer`, botão na aba Pagos): só o pagamento mais recente de cada venda, e só os que têm o retrato da parcela em `detalhes`. A venda volta para a parcela, o vencimento e o status de antes (`detalhes.status`) e o registro do pagamento é apagado.
  - Para vendas parceladas, o número da parcela atual é incrementado (ex: de 2/12 para 3/12) e, ao atingir o total, a venda é automaticamente marcada como quitada.

### 5.3. Janela de Avisos (3 avisos + aviso final)
Os disparos são filtrados para clientes ativos e pendentes de pagamento. Dentro da janela de 3 dias que antecede o vencimento o cliente recebe **um aviso por dia**; uma venda cadastrada já dentro da janela recebe os avisos dos dias que restam:
1. `lembrete_3d`: 3 dias antes do vencimento.
2. `lembrete_2d`: 2 dias antes do vencimento.
3. `lembrete_1d`: 1 dia antes do vencimento.
4. `vencido`: aviso final ("ultimato"), no dia do vencimento (ou depois, se ainda não enviado), uma única vez.

**Configurações editáveis pelo usuário** (tela de Notificações, tabela `configuracoes` de linha única, `GET/PUT /api/configuracoes`, ver `database/migration_configuracoes.sql`):
- **Texto de cada aviso:** as mensagens padrão ficam em `DEFAULT_TEMPLATES` (`template.service.ts`); o usuário pode sobrescrever cada uma usando as variáveis `{saudacao}`, `{nome}`, `{produto}`, `{valor}`, `{vencimento}`, `{pix}` e `{referencia}`. `{pix}` vem da chave Pix cadastrada na mesma tela (`configuracoes.chave_pix`, ver `database/migration_chave_pix.sql`) e sai vazio quando não há chave; as mensagens padrão não usam `{pix}`. Texto vazio volta para o padrão; variável desconhecida é recusada pelo Zod. `{saudacao}` é obrigatória em toda mensagem personalizada (regra anti-ban da saudação dinâmica).
- **Envio automático:** com `envio_automatico = false` a rotina diária e a recuperação ao ligar o computador não enviam nada; o disparo manual continua. Sem a tabela, vale o padrão (ligado, mensagens padrão).

Cada tipo é enviado no máximo uma vez por ciclo (histórico de 20 dias antes do vencimento). Alterar os tipos exige ajustar a constraint `historico_mensagens_tipo_check` no banco (ver `database/migration_lembrete_2d.sql`).

### 5.4. Contas a Pagar (Quem Devemos)
- Gestão completa de despesas da empresa e dos sócios.
- Atributos obrigatórios: descrição, credor, valor, data de vencimento, categoria e status (`pendente` ou `pago`).
- Integração no Dashboard com cálculo automático do **Balanço Líquido** (Total a Receber - Total a Pagar).

---

## 6. Padrões de Deploy, Build & Monorepo

### 6.1. Deploy Multi-Serviços na Vercel
O projeto adota o modelo oficial de múltiplos serviços em um único projeto Vercel (`vercel.json`):
- `services.backend`:
  - `root: "backend"`
  - `framework: "express"`
  - Entrada pré-empacotada em `backend/app.js`.
- `services.frontend`:
  - `root: "frontend"`
  - `framework: "vite"`
- Rewrites principais:
  - `/api/(.*)` -> direcionado para o serviço `backend`.
  - `/(.*)` -> direcionado para o serviço `frontend`.

### 6.2. Bundle Backend Híbrido (`backend/app.js`)
- Para evitar problemas de dependências externas ausentes no runtime serverless (`Cannot find module 'express'`), o backend possui o script de build `backend/build.mjs` com **esbuild**.
- O esbuild gera um arquivo único (`backend/app.js`) contendo todas as dependências puras embutidas com exportação compatível com CommonJS e ESM.
- `npm run build` roda **apenas** o esbuild (`build.mjs`) e apaga `dist/`. Nunca recolocar o `tsc` nesse script: a Vercel passa a executar o `dist/app.js` (que chama o `express` de fora) em vez do bundle. A checagem de tipos é `npm run typecheck`.
- **O Baileys nunca pode entrar no grafo de imports de `src/app.ts`** (é o ponto de entrada do bundle da Vercel). Ele é carregado só por `src/index.ts` (máquina-sede), via `createApp({ whatsAppGateway })`. Na Vercel o gateway é `UnavailableWhatsAppGateway` (WhatsApp sempre "desconectado").
- Serviços e controllers dependem da interface `IWhatsAppGateway`, nunca de uma biblioteca de envio concreta.
- A sessão do WhatsApp fica em `backend/.whatsapp-auth/` (ou `WHATSAPP_AUTH_DIR`), contém credenciais e jamais pode ser versionada.
- O arquivo `backend/src/config/supabase.ts` implementa inicialização tolerante a falhas (fallback inicial) para que a ausência temporária de variáveis de ambiente no container não provoque encerramento do processo no boot.

### 6.3. Backup e Proteção dos Dados
O banco fica no plano gratuito do Supabase (sem backup automático, e o projeto é pausado após dias sem uso), então o sistema guarda as próprias cópias:
- **Backup diário automático na máquina-sede:** `BackupService.startAutomatic()` (chamado só em `src/index.ts`) grava um arquivo por dia em `backend/backups/` (ou `BACKUP_DIR`, que pode apontar para uma pasta sincronizada com a nuvem) e mantém os 30 mais recentes (`BACKUP_KEEP`). A pasta contém dados de clientes e **nunca é versionada**.
- **Banco vazio não sobrescreve nada:** se o banco vier vazio e já houver backups, o do dia não é gravado e os antigos não são apagados.
- **Backup manual pelo painel** (Visão geral): `GET /api/backup` devolve o arquivo completo (.json) e o frontend gera o relatório em PDF (`utils/backup-export.ts`, com `jspdf` carregado sob demanda). `GET /api/backup/status` informa o último backup.
- **A tabela `usuarios` não entra no backup** (senhas). Depois de uma perda total os logins são recriados à parte.
- **Restauração (máquina-sede):** `npm run backup:restaurar -- <arquivo>` mostra o conteúdo sem alterar nada; com `--confirmar` regrava os dados pelo id (não apaga o que foi criado depois). Em banco novo: rodar `database/setup_completo.sql` antes. `database/migration_backup.sql` cria a coluna `sede_status.ultimo_backup_em` e a função `flowzap_ajustar_sequencias()`.
- O sinal de vida da sede (a cada minuto) mantém o projeto do Supabase em uso enquanto o computador da loja está ligado.

---

## 7. Checklist para Qualquer Modificação de Código

Antes de submeter qualquer alteração neste repositório, certifique-se:
1. [ ] Escreveu os testes antes de codificar a funcionalidade (TDD).
2. [ ] Todos os testes passaram com sucesso (`npm test` dentro de `backend`).
3. [ ] O frontend compilou sem erros de tipagem (`npm run build` dentro de `frontend`).
4. [ ] O bundle do backend foi atualizado se houve mudança no backend (`node build.mjs`).
5. [ ] Nenhuma chave secreta, token ou arquivo `.env` foi incluído no commit.
6. [ ] A mensagem do commit segue o formato Conventional Commits (`feat:`, `fix:`, etc.).
7. [ ] A interface mantém os padrões anti-AI de alta legibilidade e responsividade mobile-first.
