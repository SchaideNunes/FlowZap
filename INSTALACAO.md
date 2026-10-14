# Instalação no computador da loja (máquina-sede)

Este guia é para quem vai instalar o Flow-Zap no computador que fica na loja. É essa máquina que conecta o WhatsApp e envia as cobranças. O painel online (`https://flowzap-seven.vercel.app`) não precisa de instalação: basta o link e o login.

Tempo estimado: 20 a 30 minutos, com internet.

## O que levar

- O arquivo `.env` do projeto (fica na raiz, ao lado deste guia). Ele contém as chaves do banco de dados. Leve em um pendrive ou envie pelo próprio acesso remoto; não mande por WhatsApp nem por e-mail.
- O celular da loja, com o WhatsApp que vai enviar as cobranças.
- O e-mail e a senha de acesso ao painel.

## Passo a passo

### 1. Instalar o Node.js e o Git

- Node.js, versão LTS: <https://nodejs.org>
- Git: <https://git-scm.com/download/win>

Nos dois instaladores, as opções padrão servem. Depois de instalar, feche e abra de novo qualquer janela de terminal que já estivesse aberta.

### 2. Baixar o sistema

Abra o Prompt de Comando e rode:

```bat
cd C:\
git clone -b producao https://github.com/SchaideNunes/FlowZap.git FlowZap
```

O sistema fica em `C:\FlowZap`. Use uma pasta fixa: o atalho e a inicialização automática apontam para ela.

O `-b producao` é importante: é o ramo das versões liberadas para a loja, e é por ele que o sistema se atualiza sozinho (veja "Atualizações" mais abaixo).

**Se o repositório for privado:** o Git pede login ao clonar. Não entre com a sua conta do GitHub nesse computador. Antes, crie um token só para isso em GitHub > Settings > Developer settings > Fine-grained tokens, com acesso apenas ao repositório `FlowZap` e a permissão "Contents: Read-only". Quando o Git pedir login, escolha "Token" e cole. O Windows guarda o token e as atualizações passam a usá-lo. Se um dia o token vencer ou for apagado, o sistema continua funcionando, só deixa de se atualizar (aparece um aviso ao iniciar).

### 3. Colocar o arquivo de configuração

Copie o arquivo `.env` para dentro de `C:\FlowZap` (a pasta que tem `backend`, `frontend` e `scripts`).

### 4. Iniciar

Dê dois cliques em `C:\FlowZap\scripts\iniciar_sede.bat`.

Na primeira vez ele instala as dependências sozinho, o que leva cerca de um minuto. Depois abre duas janelas minimizadas ("FlowZap Backend" e "FlowZap Frontend"), que precisam ficar abertas enquanto o sistema estiver em uso.

Se faltar algo, o próprio script avisa:

- "O Node.js não está instalado": volte ao passo 1.
- "Falta o arquivo de configuração .env": volte ao passo 3.

### 5. Conectar o WhatsApp da loja

1. Abra `http://localhost:5173` no navegador e entre com o login.
2. Clique no indicador de WhatsApp, no topo da tela, para abrir o QR Code.
3. No celular da loja: WhatsApp > Aparelhos conectados > Conectar aparelho, e leia o QR Code.

A sessão fica salva em `C:\FlowZap\backend\.whatsapp-auth`. Só é preciso ler o QR Code de novo se o aparelho for desconectado pelo celular.

### 6. Deixar pronto para o dia a dia

- **Iniciar junto com o Windows:** clique com o botão direito em `scripts\instalar_agendador_windows.bat` e escolha "Executar como administrador".
- **Atalho na área de trabalho:** rode `scripts\criar_atalho_desktop.bat` e responda `S`.
- **Não deixar o computador suspender:** em Configurações > Sistema > Energia, coloque "Suspender" em "Nunca". O envio diário é às 09:00; se a máquina estiver desligada nesse horário, o sistema envia quando for ligada.
- **Backup fora do computador (recomendado):** o sistema grava uma cópia diária em `C:\FlowZap\backend\backups`. Para que ela vá também para a nuvem, acrescente ao `.env` uma linha apontando para uma pasta sincronizada, por exemplo `BACKUP_DIR=C:\Users\NOME\OneDrive\FlowZap-backups`, e inicie o sistema de novo.

## Conferir se deu certo

- O topo do painel mostra "WhatsApp conectado".
- No painel online, o indicador mostra "Sede online".
- Na Visão geral, o bloco "Backup dos dados" mostra "Em dia" depois de alguns minutos.

## Atualizações

O computador da loja se atualiza sozinho. Toda vez que o `iniciar_sede.bat` roda (ao entrar no Windows ou pelo atalho), ele procura uma versão nova no ramo `producao`, baixa e, se a lista de dependências mudou, reinstala antes de iniciar. Na loja ninguém precisa fazer nada além de reiniciar o computador ou o sistema.

A atualização nunca impede o sistema de iniciar:

- Sem internet, sem acesso ao repositório ou com qualquer falha, inicia a versão que já está instalada, com um aviso.
- Se algum arquivo do sistema foi alterado à mão nesse computador, a atualização é pulada, com aviso, para não apagar a alteração. O `.env`, a sessão do WhatsApp e os backups ficam fora do Git e não contam.
- Só atualiza a cópia que está no ramo `producao`. Num computador de desenvolvimento (ramo `main`) não faz nada.

Para atualizar na hora, sem esperar o próximo início, feche as duas janelas do FlowZap e abra o `iniciar_sede.bat` de novo.

### Como liberar uma versão (para quem desenvolve)

O `main` é o ramo de trabalho; a loja só recebe o que for para o `producao`. Depois de conferir uma versão no `main`:

1. Se ela precisa de uma migração nova em `database/`, rode o SQL no Supabase **antes** de liberar.
2. Libere com `git push origin main:producao`.

Na próxima vez que o sistema da loja iniciar, ele já estará na versão nova.

**Voltar para uma versão anterior:** a loja só aceita avançar, então a volta é manual. Rode `git push --force origin <commit>:producao` e, no computador da loja (por acesso remoto), `git fetch` seguido de `git reset --hard origin/producao` dentro de `C:\FlowZap`.

## Regra importante: só uma máquina-sede

Só um computador envia as cobranças. O sistema protege isso sozinho: o primeiro computador a ser iniciado vira a sede, e um segundo que seja iniciado com o mesmo `.env` funciona só como painel, com um aviso no topo da tela dizendo qual computador é a sede.

Para trocar de sede (por exemplo, ao instalar na loja depois de ter testado em outra máquina), abra o painel **no computador novo** e use o botão "Usar este computador como sede" que aparece nesse aviso. Em até um minuto o computador antigo para de enviar. Depois, leia o QR Code com o celular da loja.

Essa proteção depende de o arquivo `database/migration_trava_sede.sql` ter sido executado no Supabase. Sem ele, o sistema funciona como antes e não há proteção: nesse caso, não inicie o sistema em duas máquinas com o mesmo banco.

Outras pessoas e outros aparelhos usam o painel online ou, na mesma rede da loja, o endereço mostrado por `scripts\obter_ip_local.bat`.

## O que foi conferido neste guia

Conferido em uma pasta limpa, em 13/10/2026: clonar o repositório, instalar as dependências do backend e do painel, configurar o `.env`, subir os dois serviços e entrar no painel com o login. Também foram conferidos o aviso de `.env` ausente e o script que mostra o IP da rede.

Não foi executado de ponta a ponta: a leitura do QR Code em uma máquina nova, o `instalar_agendador_windows.bat` e o `criar_atalho_desktop.bat` (foram reescritos e revisados, mas rodá-los criaria uma tarefa agendada e um atalho de verdade). Faça esses três com atenção na primeira instalação.

A atualização automática foi conferida em 14/10/2026, numa simulação com uma cópia do repositório: já em dia, versão nova sem e com dependência nova, o próprio script sendo reescrito pela atualização, arquivo alterado na máquina, sem internet e depois com a internet de volta, e o ramo `main` (não atualiza).
