@echo off
rem Script somente em ASCII de proposito: com acentos + "chcp 65001" o cmd do Windows
rem le o arquivo na posicao errada e "come" letras de alguns comandos.
title Flow-Zap - Criador de Atalho na Area de Trabalho

echo ========================================================
echo   FLOW-ZAP - Criacao de Atalho na Area de Trabalho
echo ========================================================
echo.

set "TARGET_URL=http://localhost:5173"
set /p MAQUINA="Esta e a Maquina Sede (S) ou o Notebook (N)? [S/N]: "

rem O IP e pedido fora de um bloco "if ( )": dentro dele a variavel digitada sairia vazia
if /i not "%MAQUINA%"=="N" goto criar
echo.
set /p IP_SEDE="Digite o IP da Maquina Sede (ex: 192.168.1.100): "
set "TARGET_URL=http://%IP_SEDE%:5173"

:criar
echo.
echo Criando atalho apontando para: %TARGET_URL%

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'FlowZap - Cobrancas.url')); $s.TargetPath = '%TARGET_URL%'; $s.Save()"

if errorlevel 1 goto falhou
echo [SUCESSO] Atalho "FlowZap - Cobrancas" criado na Area de Trabalho.
goto fim

:falhou
echo [ERRO] Ocorreu uma falha ao criar o atalho.

:fim
echo.
pause
