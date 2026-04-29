@echo off
setlocal enabledelayedexpansion

echo OpenAgent Setup
echo ===============
echo.

set "EXTENSION_DIR=%~dp0"
set "EXTENSION_DIR=%EXTENSION_DIR:~0,-1%"
set "PROXY_DIR=%EXTENSION_DIR%\proxy"

REM Create Windows auto-start via Task Scheduler
echo Installing proxy auto-start...
schtasks /create /tn "OpenAgentProxy" /tr "node \"%PROXY_DIR%\server.js\"" /sc ONLOGON /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Proxy auto-start installed (Task Scheduler).
) else (
  echo Could not install auto-start — run this bat to start the proxy manually.
)

REM Open Chrome extensions page
start chrome://extensions/

echo.
echo Starting proxy server...
cd /d "%PROXY_DIR%"
start "OpenAgent Proxy" node server.js

echo.
echo Proxy running at http://localhost:8787
echo Done! Open Chrome, enable Developer mode, click Load unpacked, select this folder.
pause