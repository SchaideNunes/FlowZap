@echo off
chcp 65001 > nul
title Flow-Zap - Obter IP da Máquina Sede

echo ========================================================
echo   FLOW-ZAP - IP da Rede Local da Máquina Sede
echo ========================================================
echo.
echo Use um dos endereços abaixo no navegador da Máquina Secundária:
echo.

powershell -Command "Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host '  ==>  http://' + $_.IPAddress + ':5173' -ForegroundColor Green }"

echo.
echo ========================================================
echo Pressione qualquer tecla para fechar.
pause > nul
