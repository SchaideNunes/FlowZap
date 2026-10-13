@echo off
rem Script somente em ASCII de proposito: com acentos + "chcp 65001" o cmd do Windows
rem le o arquivo na posicao errada e "come" letras de alguns comandos.
title Flow-Zap - Inicializador da Maquina Sede

echo ========================================================
echo   FLOW-ZAP - Sistema de Cobranca Recorrente WhatsApp
echo   Iniciando servicos na Maquina Sede...
echo ========================================================
echo.

cd /d "%~dp0\.."

rem 0. Conferencias da primeira vez: Node instalado, configuracao e dependencias
where node > nul 2> nul
if errorlevel 1 goto sem_node

if exist ".env" goto env_ok
if exist "backend\.env" goto env_ok
goto sem_env
:env_ok

if exist "backend\node_modules" goto backend_ok
echo Primeira vez: instalando as dependencias do backend. Pode levar alguns minutos...
pushd backend
call npm install --no-audit --no-fund
if errorlevel 1 goto falha_instalacao
popd
:backend_ok

if exist "frontend\node_modules" goto frontend_ok
echo Primeira vez: instalando as dependencias do painel. Pode levar alguns minutos...
pushd frontend
call npm install --no-audit --no-fund
if errorlevel 1 goto falha_instalacao
popd
:frontend_ok

rem 1. Backend (API + conexao WhatsApp + agendador diario)
echo [1/2] Iniciando Backend, Motor de Agendamento e conexao WhatsApp...
start "FlowZap Backend" /min cmd /c "cd backend && npm run dev"
echo [OK] Backend rodando em background na porta 3001.
echo.

rem 2. Frontend (painel)
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
