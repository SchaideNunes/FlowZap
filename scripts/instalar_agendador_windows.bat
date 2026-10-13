@echo off
rem Script somente em ASCII de proposito: com acentos + "chcp 65001" o cmd do Windows
rem le o arquivo na posicao errada e "come" letras de alguns comandos.
title Flow-Zap - Inicializacao Automatica com o Windows

echo ========================================================
echo   FLOW-ZAP - Configuracao de Inicializacao Automatica
echo ========================================================
echo.
echo Este script cadastra o FlowZap no Agendador de Tarefas do Windows
echo para iniciar sozinho quando alguem entrar no Windows nesta maquina.
echo.

set "SCRIPT_PATH=%~dp0iniciar_sede.bat"

echo Registrando a tarefa "FlowZap_AutoStart"...
schtasks /create /tn "FlowZap_AutoStart" /tr "\"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if errorlevel 1 goto falhou
echo.
echo ========================================================
echo [SUCESSO] Tarefa registrada.
echo Sempre que alguem entrar no Windows nesta maquina,
echo o FlowZap inicia sozinho em segundo plano.
echo ========================================================
goto fim

:falhou
echo.
echo [ERRO] Nao foi possivel registrar a tarefa.
echo Dica: clique com o botao direito neste arquivo e escolha
echo "Executar como administrador".

:fim
echo.
pause
