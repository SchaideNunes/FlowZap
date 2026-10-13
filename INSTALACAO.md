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
git clone https://github.com/SchaideNunes/FlowZap.git FlowZap
```

O sistema fica em `C:\FlowZap`. Use uma pasta fixa: o atalho e a inicialização automática apontam para ela.

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

## Atualizar o sistema depois

Com as duas janelas do FlowZap fechadas, rode no Prompt de Comando:

```bat
cd C:\FlowZap
git pull
```

Depois abra o `iniciar_sede.bat` de novo. Se a atualização trouxer dependências novas, rode `npm install` dentro de `backend` e de `frontend` antes de iniciar.

## Regra importante: só uma máquina-sede

O sistema só pode estar iniciado (com o `iniciar_sede.bat`) em **um** computador por vez. Dois computadores iniciados ao mesmo tempo com o mesmo `.env` disputam o envio das mesmas cobranças. Depois de instalar na loja, não inicie mais o sistema na máquina de desenvolvimento apontando para o mesmo banco.

Outras pessoas e outros aparelhos usam o painel online ou, na mesma rede da loja, o endereço mostrado por `scripts\obter_ip_local.bat`.

## O que foi conferido neste guia

Conferido em uma pasta limpa, em 13/10/2026: clonar o repositório, instalar as dependências do backend e do painel, configurar o `.env`, subir os dois serviços e entrar no painel com o login. Também foram conferidos o aviso de `.env` ausente e o script que mostra o IP da rede.

Não foi executado de ponta a ponta: a leitura do QR Code em uma máquina nova, o `instalar_agendador_windows.bat` e o `criar_atalho_desktop.bat` (foram reescritos e revisados, mas rodá-los criaria uma tarefa agendada e um atalho de verdade). Faça esses três com atenção na primeira instalação.
