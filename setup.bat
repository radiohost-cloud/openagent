@echo off
setlocal enabledelayedexpansion

echo OpenAgent Setup
echo ===============
echo.

set "EXTENSION_DIR=%~dp0"
set "EXTENSION_DIR=%EXTENSION_DIR:~0,-1%"
set "PROXY_DIR=%EXTENSION_DIR%\proxy"

REM ─── Proxy auto-start ───────────────────────────────────
echo Installing proxy auto-start...
schtasks /create /tn "OpenAgentProxy" /tr "node \"%PROXY_DIR%\server.js\"" /sc ONLOGON /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   [OK] Proxy auto-start (Task Scheduler)
) else (
  echo   [--] Task Scheduler not available - proxy needs manual start
)

REM ─── Find Chrome ──────────────────────────────────────────
set "CHROME_PATH="
where chrome >nul 2>&1 && set "CHROME_PATH=chrome"
if not defined CHROME_PATH (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME_PATH (
  if exist "%ProgramFiles (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles (x86)%\Google\Chrome\Application\chrome.exe"
)

REM ─── Open Chrome extensions page ─────────────────────────
echo.
echo Opening Chrome extension page...
if defined CHROME_PATH (
  start "" "%CHROME_PATH%" "chrome://extensions/"
) else (
  echo   Could not find Chrome. Please open Chrome manually and go to chrome://extensions/
)

REM ─── Copy extension folder path to clipboard ──────────────
echo | set /p="Extension folder: %EXTENSION_DIR%" | clip
echo   Extension folder path copied to clipboard.

REM ─── Start proxy ──────────────────────────────────────────
echo.
cd /d "%PROXY_DIR%"
start "OpenAgent Proxy" node server.js
echo   Proxy running at http://localhost:8787

echo.
echo ============================================
echo NEXT STEP - takes 10 seconds:
echo   1. In Chrome, enable "Developer mode" (top right)
echo   2. Click "Load unpacked"
echo   3. Paste clipboard path or navigate to: %EXTENSION_DIR%
echo   4. Select the folder and click "Select Folder"
echo ============================================
echo.
echo Press any key to open this folder in Explorer...
pause > nul
explorer "%EXTENSION_DIR%"