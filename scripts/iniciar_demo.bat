@echo off
rem Script somente em ASCII de proposito: com acentos + "chcp 65001" o cmd do Windows
rem le o arquivo na posicao errada e "come" letras de alguns comandos.
title Flow-Zap - Demonstracao

echo ========================================================
echo   FLOW-ZAP - Demonstracao com dados ficticios
echo   Nao usa o banco de verdade e nao envia nada pelo WhatsApp.
echo ========================================================
echo.

cd /d "%~dp0\.."

where node > nul 2> nul
if errorlevel 1 goto sem_node

if exist "backend\node_modules" goto backend_ok
echo Primeira vez: instalando as dependencias do backend...
pushd backend
call npm install --no-audit --no-fund
if errorlevel 1 goto falha_instalacao
popd
:backend_ok

if exist "frontend\node_modules" goto frontend_ok
echo Primeira vez: instalando as dependencias do painel...
pushd frontend
call npm install --no-audit --no-fund
if errorlevel 1 goto falha_instalacao
popd
:frontend_ok

rem Portas proprias (3191 e 5191): roda ao lado do sistema de verdade sem conflito
start "FlowZap Demo API" /min cmd /c "cd backend && npm run demo"
start "FlowZap Demo Painel" /min cmd /c "cd frontend && npm run demo"

echo Abrindo o painel em http://localhost:5191 ...
echo Login: demo@flowzap.dev / demo1234 (ja vem preenchido)
echo Para encerrar, feche as janelas "FlowZap Demo API" e "FlowZap Demo Painel".
rem ping em vez de timeout: o timeout falha quando o script roda sem teclado
ping -n 8 127.0.0.1 > nul
start "" "http://localhost:5191"
exit

:sem_node
echo [ERRO] O Node.js nao esta instalado neste computador.
echo Instale a versao LTS em https://nodejs.org e abra este arquivo de novo.
echo.
pause
exit /b 1

:falha_instalacao
popd
echo [ERRO] Nao foi possivel instalar as dependencias. Confira a internet e tente de novo.
echo.
pause
exit /b 1
