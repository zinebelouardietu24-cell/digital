@echo off
chcp 65001 >nul
title Jumeau numerique - Demarrage de la demo
cd /d "%~dp0"

echo ============================================================
echo   JUMEAU NUMERIQUE - CIRCUIT DE BROYAGE (ENSEM / JESA)
echo ============================================================
echo.

REM --- 1. Docker Desktop -------------------------------------------------
docker info >nul 2>&1
if errorlevel 1 (
    echo [1/4] Demarrage de Docker Desktop...
    if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
    ) else (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    )
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 goto wait_docker
)
echo [1/4] Docker est pret.

REM --- 2. Services du jumeau (broker, Neo4j, backend, publieur, site) ---
echo [2/4] Lancement des services du jumeau numerique...
docker compose up -d
if errorlevel 1 (
    echo.
    echo ERREUR : docker compose n'a pas pu demarrer. Voir les messages ci-dessus.
    pause
    exit /b 1
)

REM --- 3. Node-RED (chaine KEPServerEX -> OPC UA -> MQTT) ---------------
where node-red >nul 2>&1
if not errorlevel 1 (
    echo [3/4] Lancement de Node-RED, fenetre reduite...
    start "Node-RED" /min cmd /c node-red
) else (
    echo [3/4] Node-RED non trouve : la demo utilisera la relecture des historiques.
)

REM --- 4. Attente de l'API puis ouverture du site ------------------------
echo [4/4] Attente du backend...
:wait_api
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:8000/docs -TimeoutSec 2).StatusCode } catch { 0 }" | findstr /b "200" >nul
if errorlevel 1 goto wait_api

start "" http://localhost:5173
echo.
echo ============================================================
echo   Site ouvert : http://localhost:5173
echo   Compte de demo : engineer / engineer123
echo   Node-RED       : http://localhost:1880
echo   API (Swagger)  : http://localhost:8000/docs
echo.
echo   Pour tout arreter : double-cliquer sur arreter_demo.bat
echo ============================================================
pause
