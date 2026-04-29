@echo off
setlocal enabledelayedexpansion

echo OpenAgent Setup
echo ===============
echo.

set "EXTENSION_DIR=%~dp0"
set "EXTENSION_DIR=%EXTENSION_DIR:~0,-1%"
set "PROXY_DIR=%EXTENSION_DIR%\proxy"
set "TEMP_DIR=%TEMP%\openagent_setup"

REM ─── Check Node.js ──────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  for /f "delims=" %%v in ('node --version 2^>nul') do echo [OK] Node.js found: %%v
  goto :proxy_setup
)

echo Node.js not found. Downloading and installing...
echo.

REM Create temp dir
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

REM Download Node.js LTS installer (64-bit)
set "NODE_URL=https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi"
set "NODE_MSI=%TEMP_DIR%\node.msi"

echo Downloading Node.js (v22 LTS, ~35MB)...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%'"

if not exist "%NODE_MSI%" (
  echo [FAIL] Download failed. Try installing Node.js manually from nodejs.org
  echo Press any key to continue anyway...
  pause > nul
  goto :proxy_setup
)

echo Installing Node.js (silent, may take 1-2 minutes)...
msiexec /i "%NODE_MSI%" /quiet /norestart

REM Wait for node to appear in PATH (up to 60s)
set "NODE_FOUND=0"
for /L %%i in (1,1,30) do (
  timeout /t 2 /nobreak > nul
  where node >nul 2>&1
  if !ERRORLEVEL! EQU 0 (
    set "NODE_FOUND=1"
    goto :node_done
  )
)
:node_done

REM Cleanup
del "%NODE_MSI%" 2>nul
rmdir "%TEMP_DIR%" 2>nul

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [FAIL] Node.js installation failed.
  echo Please install manually from: https://nodejs.org
  echo Press any key to continue anyway...
  pause > nul
) else (
  for /f "delims=" %%v in ('node --version 2^>nul') do echo [OK] Node.js installed: %%v
)

:proxy_setup
REM ─── Proxy auto-start ────────────────────────────────────────
echo.
echo Installing proxy auto-start...
schtasks /create /tn "OpenAgentProxy" /tr "node \"%PROXY_DIR%\server.js\"" /sc ONLOGON /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   [OK] Proxy will start on every login
) else (
  echo   [--] Task Scheduler not available - run setup.bat to start proxy manually
)

REM ─── Find Chrome ─────────────────────────────────────────────
set "CHROME_PATH="
where chrome >nul 2>&1 && set "CHROME_PATH=chrome"
if not defined CHROME_PATH (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
  if exist "%ProgramFiles (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles (x86)%\Google\Chrome\Application\chrome.exe"
)

REM ─── Open Chrome extensions page ────────────────────────────
echo.
if defined CHROME_PATH (
  start "" "%CHROME_PATH%" "chrome://extensions/"
) else (
  start chrome://extensions/
  echo   Chrome not found — opened chrome://extensions/ anyway. Install Chrome from google.com/chrome
)

REM ─── Copy extension path to clipboard ───────────────────────
echo %EXTENSION_DIR% | clip
echo   Extension folder path copied to clipboard.

REM ─── Start proxy ─────────────────────────────────────────────
echo.
cd /d "%PROXY_DIR%"
start "OpenAgent Proxy" node server.js
echo   Proxy running at http://localhost:8787

echo.
echo ===============================================================
echo NEXT STEP — takes 10 seconds:
echo.
echo   1. In Chrome, enable "Developer mode" (top right toggle)
echo   2. Click "Load unpacked"
echo   3. Press Ctrl+V to paste the folder path (or navigate manually)
echo   4. Select the extension folder and click "Select Folder"
echo ===============================================================
echo.
echo Press any key to open extension folder in Explorer...
pause > nul
explorer "%EXTENSION_DIR%"