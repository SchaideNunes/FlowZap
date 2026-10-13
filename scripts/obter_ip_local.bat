@echo off
rem Script somente em ASCII de proposito: com acentos + "chcp 65001" o cmd do Windows
rem le o arquivo na posicao errada e "come" letras de alguns comandos.
title Flow-Zap - IP da Maquina Sede

echo ========================================================
echo   FLOW-ZAP - IP da Rede Local da Maquina Sede
echo ========================================================
echo.
echo Use um dos enderecos abaixo no navegador da outra maquina:
echo.

powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host ('  ==>  http://' + $_.IPAddress + ':5173') -ForegroundColor Green }"

echo.
echo ========================================================
echo Pressione qualquer tecla para fechar.
pause > nul
