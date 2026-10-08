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
