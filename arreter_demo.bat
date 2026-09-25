@echo off
chcp 65001 >nul
title Jumeau numerique - Arret de la demo
cd /d "%~dp0"
echo Arret des services du jumeau numerique...
docker compose stop
taskkill /fi "WINDOWTITLE eq Node-RED*" /t /f >nul 2>&1
echo.
echo Services arretes. Les donnees (historien, Neo4j, broker) sont conservees.
pause
