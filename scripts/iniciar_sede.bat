@echo off
rem Script somente em ASCII de proposito: com acentos + "chcp 65001" o cmd do Windows
rem le o arquivo na posicao errada e "come" letras de alguns comandos.

rem O cmd le o .bat aos pedacos enquanto executa. Como a atualizacao abaixo pode reescrever
rem este arquivo, o script roda a partir de uma copia temporaria.
if /i "%~1"=="--copia" goto inicio
set "FZ_PASTA=%~dp0.."
set "FZ_SEM_ATUALIZAR="
copy /y "%~f0" "%TEMP%\flowzap_iniciar_sede.bat" > nul 2> nul
if errorlevel 1 goto sem_copia
"%TEMP%\flowzap_iniciar_sede.bat" --copia
:sem_copia
rem Sem a copia, roda daqui mesmo, mas sem atualizar
set "FZ_SEM_ATUALIZAR=1"
:inicio

title Flow-Zap - Inicializador da Maquina Sede

echo ========================================================
echo   FLOW-ZAP - Sistema de Cobranca Recorrente WhatsApp
echo   Iniciando servicos na Maquina Sede...
echo ========================================================
echo.

cd /d "%FZ_PASTA%"

rem 0. Conferencias da primeira vez: Node instalado, configuracao e dependencias
where node > nul 2> nul
if errorlevel 1 goto sem_node

if exist ".env" goto env_ok
if exist "backend\.env" goto env_ok
goto sem_env
:env_ok

rem 1. Atualizacao automatica: so quando esta copia esta no ramo "producao" (a da loja).
rem    Sem internet, sem Git ou com qualquer falha, inicia a versao que ja esta aqui.
set "FZ_DEPS_BACKEND="
set "FZ_DEPS_FRONTEND="
if defined FZ_SEM_ATUALIZAR goto atualizacao_fim
where git > nul 2> nul
if errorlevel 1 goto atualizacao_fim
set "FZ_RAMO="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "FZ_RAMO=%%b"
if /i not "%FZ_RAMO%"=="producao" goto atualizacao_fim

rem Arquivo do sistema alterado nesta maquina: nao mexe (.env e pastas de dados ficam fora do Git)
git diff --quiet HEAD -- 2> nul
if errorlevel 1 goto atualizacao_alterado

echo Procurando atualizacao...
rem Nunca parar pedindo usuario ou senha (repositorio privado sem token salvo)
set "GIT_TERMINAL_PROMPT=0"
set "GCM_INTERACTIVE=never"
set "FZ_ANTES="
for /f "delims=" %%h in ('git rev-parse HEAD') do set "FZ_ANTES=%%h"
git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=20 fetch --quiet origin producao 2> nul
if errorlevel 1 goto atualizacao_sem_rede
git merge --ff-only --quiet origin/producao > nul 2> nul
if errorlevel 1 goto atualizacao_falhou
set "FZ_DEPOIS="
for /f "delims=" %%h in ('git rev-parse HEAD') do set "FZ_DEPOIS=%%h"
if "%FZ_ANTES%"=="%FZ_DEPOIS%" goto atualizacao_em_dia

echo [OK] Sistema atualizado para a versao mais recente.
git diff --quiet %FZ_ANTES% HEAD -- backend/package.json backend/package-lock.json
if errorlevel 1 set "FZ_DEPS_BACKEND=1"
git diff --quiet %FZ_ANTES% HEAD -- frontend/package.json frontend/package-lock.json
if errorlevel 1 set "FZ_DEPS_FRONTEND=1"
goto atualizacao_fim

:atualizacao_em_dia
echo [OK] O sistema ja esta na versao mais recente.
goto atualizacao_fim
:atualizacao_sem_rede
echo [AVISO] Nao foi possivel procurar atualizacao (sem internet ou sem acesso). Iniciando a versao atual.
goto atualizacao_fim
:atualizacao_falhou
echo [AVISO] A atualizacao nao foi aplicada. Iniciando a versao atual.
goto atualizacao_fim
:atualizacao_alterado
echo [AVISO] Ha arquivos do sistema alterados neste computador. A atualizacao automatica foi pulada.
:atualizacao_fim
echo.

rem 2. Dependencias: na primeira vez e quando uma atualizacao muda a lista
if not exist "backend\node_modules" goto instalar_backend
if defined FZ_DEPS_BACKEND goto instalar_backend
goto backend_ok
:instalar_backend
echo Instalando as dependencias do backend. Pode levar alguns minutos...
pushd backend
call npm install --no-audit --no-fund
if errorlevel 1 goto falha_instalacao
popd
:backend_ok

if not exist "frontend\node_modules" goto instalar_frontend
if defined FZ_DEPS_FRONTEND goto instalar_frontend
goto frontend_ok
:instalar_frontend
echo Instalando as dependencias do painel. Pode levar alguns minutos...
pushd frontend
call npm install --no-audit --no-fund
if errorlevel 1 goto falha_instalacao
popd
:frontend_ok

rem 3. Backend (API + conexao WhatsApp + agendador diario)
echo [1/2] Iniciando Backend, Motor de Agendamento e conexao WhatsApp...
start "FlowZap Backend" /min cmd /c "cd backend && npm run dev"
echo [OK] Backend rodando em background na porta 3001.
echo.

rem 4. Frontend (painel)
echo [2/2] Iniciando Frontend Web...
start "FlowZap Frontend" /min cmd /c "cd frontend && npm run dev"
echo [OK] Frontend rodando na porta 5173.
echo.

echo ========================================================
echo   Todos os servicos foram iniciados!
echo.
echo   - Acesso local: http://localhost:5173
echo   - Para acessar de outra maquina, use o IP local desta maquina:
echo.
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host ('     http://' + $_.IPAddress + ':5173') -ForegroundColor Green }"
echo.
echo ========================================================
rem ping em vez de timeout: o timeout falha quando o script roda sem teclado (ex.: pelo VS Code)
ping -n 6 127.0.0.1 > nul
exit

:sem_node
echo [ERRO] O Node.js nao esta instalado neste computador.
echo Instale a versao LTS em https://nodejs.org e abra este arquivo de novo.
echo.
pause
exit /b 1

:sem_env
echo [ERRO] Falta o arquivo de configuracao ".env" na pasta do sistema.
echo Copie o arquivo .env para esta pasta:
echo   %CD%
echo.
pause
exit /b 1

:falha_instalacao
popd
echo [ERRO] Nao foi possivel instalar as dependencias. Confira a internet e tente de novo.
echo.
pause
exit /b 1
