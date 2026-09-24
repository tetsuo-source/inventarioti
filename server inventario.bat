@echo off
title Servidor IT Dashboard
echo Iniciando Servidor de Inventario IT...
cd C:\inventario-it 
start /min node server.js
exit
pause