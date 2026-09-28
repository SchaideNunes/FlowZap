@echo off
chcp 65001 > nul
title Flow-Zap - Inicializador da Máquina Sede

echo ========================================================
echo   FLOW-ZAP - Sistema de Cobrança Recorrente WhatsApp
echo   Iniciando serviços na Máquina Sede...
echo ========================================================
echo.

cd /d "%~dp0\.."

:: 1. Iniciar Evolution API via Docker
echo [1/3] Verificando e iniciando Evolution API (Docker)...
docker compose up -d evolution-api
if %errorlevel% neq 0 (
    echo [AVISO] Falha ao iniciar Evolution API no Docker. Certifique-se de que o Docker Desktop esta aberto.
) else (
    echo [OK] Evolution API ativa na porta 8080.
)
echo.

:: 2. Iniciar Servidor Backend (Node.js + Express + Scheduler)
echo [2/3] Iniciando Backend & Motor de Agendamento...
start "FlowZap Backend" /min cmd /c "cd backend && npm run dev"
echo [OK] Backend rodando em background na porta 3001.
echo.

:: 3. Iniciar Frontend (Vite)
echo [3/3] Iniciando Frontend Web...
start "FlowZap Frontend" /min cmd /c "cd frontend && npm run dev"
echo [OK] Frontend rodando na porta 5173.
echo.

echo ========================================================
echo   Todos os serviços foram iniciados com sucesso!
echo.
echo   - Acesso local: http://localhost:5173
echo   - Para acessar da outra maquina, use o IP local desta maquina:
echo.
powershell -Command "Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host '     http://' + $_.IPAddress + ':5173' -ForegroundColor Green }"
echo.
echo ========================================================
timeout /t 5 > nul
exit
