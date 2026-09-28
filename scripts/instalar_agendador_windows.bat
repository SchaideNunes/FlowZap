@echo off
chcp 65001 > nul
title Flow-Zap - Instalação no Agendador de Tarefas do Windows

echo ========================================================
echo   FLOW-ZAP - Configuração de Inicialização Automática
echo ========================================================
echo.
echo Este script cadastra o FlowZap no Agendador de Tarefas do Windows
echo para iniciar automaticamente ao fazer logon na Máquina Sede.
echo.

set SCRIPT_PATH=%~dp0iniciar_sede.bat

echo Registrando tarefa "FlowZap_AutoStart"...
schtasks /create /tn "FlowZap_AutoStart" /tr "\"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo [SUCESSO] Tarefa registrada com êxito!
    echo Sempre que você ligar ou entrar no Windows nesta máquina,
    echo o FlowZap iniciará sozinho em segundo plano.
    echo ========================================================
) else (
    echo.
    echo [ERRO] Não foi possível registrar a tarefa.
    echo Dica: Execute este arquivo clicando com botão direito e "Executar como Administrador".
)

echo.
pause
