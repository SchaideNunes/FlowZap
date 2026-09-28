@echo off
chcp 65001 > nul
title Flow-Zap - Criador de Atalho na Área de Trabalho

echo ========================================================
echo   FLOW-ZAP - Criação de Atalho na Área de Trabalho
echo ========================================================
echo.

set /p MAQUINA="Esta é a Máquina Sede (S) ou a Máquina Secundária/Notebook (N)? [S/N]: "

if /i "%MAQUINA%"=="N" (
    echo.
    set /p IP_SEDE="Digite o IP da Máquina Sede (ex: 192.168.1.100): "
    set TARGET_URL=http://%IP_SEDE%:5173
) else (
    set TARGET_URL=http://localhost:5173
)

echo.
echo Criando atalho apontando para: %TARGET_URL%

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'FlowZap - Cobranças.url')); $s.TargetPath = '%TARGET_URL%'; $s.Save()"

if %errorlevel% equ 0 (
    echo [SUCESSO] Atalho "FlowZap - Cobranças" criado na sua Área de Trabalho!
) else (
    echo [ERRO] Ocorreu uma falha ao criar o atalho.
)

echo.
pause
