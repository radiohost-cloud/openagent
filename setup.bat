@echo off
setlocal enabledelayedexpansion

echo OpenAgent Setup
echo ===============
echo.

set "EXTENSION_DIR=%~dp0"
set "EXTENSION_DIR=%EXTENSION_DIR:~0,-1%"
set "PROXY_DIR=%EXTENSION_DIR%\proxy"
set "DESKTOP=%USERPROFILE%\Desktop"

REM ─── Proxy auto-start ───────────────────────────────────
echo Installing proxy auto-start...
schtasks /create /tn "OpenAgentProxy" /tr "node \"%PROXY_DIR%\server.js\"" /sc ONLOGON /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   - Proxy auto-start installed (Task Scheduler).
) else (
  echo   - Task Scheduler failed — proxy needs manual start.
)

REM ─── Create Chrome shortcut with extension loaded ───────
echo Creating Chrome shortcut...

set "CHROME_PATH="
where chrome >nul 2>&1 && set "CHROME_PATH=chrome"
if not defined CHROME_PATH (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

set "SHORTCUT_PATH=%DESKTOP%\OpenAgent (with extension).lnk"
set "PS_SCRIPT=%TEMP%\create_shortcut.ps1"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%PS_SCRIPT%"
echo Set oFS = CreateObject("Scripting.FileSystemObject") >> "%PS_SCRIPT%"
echo strDesktop = oWS.SpecialFolders("Desktop") >> "%PS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut("%SHORTCUT_PATH%") >> "%PS_SCRIPT%"
echo oLink.TargetPath = "%CHROME_PATH%" >> "%PS_SCRIPT%"
echo oLink.Arguments = "--load-extension=%EXTENSION_DIR%" >> "%PS_SCRIPT%"
echo oLink.Description = "OpenAgent Chrome Extension" >> "%PS_SCRIPT%"
echo oLink.Save >> "%PS_SCRIPT%"
cscript //B "%PS_SCRIPT%"
del "%PS_SCRIPT%"

if exist "%SHORTCUT_PATH%" (
  echo   - Chrome shortcut created on Desktop.
) else (
  echo   - Could not create shortcut.
)

REM ─── Start proxy ────────────────────────────────────────
echo.
echo Starting proxy server...
cd /d "%PROXY_DIR%"
start "OpenAgent Proxy" node server.js

REM ─── Open Chrome with extension ─────────────────────────
if defined CHROME_PATH (
  start "" "%CHROME_PATH%" "--load-extension=%EXTENSION_DIR%"
  echo   - Chrome opened with extension loaded.
)

echo.
echo Done!
if exist "%SHORTCUT_PATH%" (
  echo   Shortcut on Desktop: "OpenAgent (with extension)"
  echo   Double-click it to launch Chrome with the extension.
) else (
  echo   Open Chrome, enable Developer mode, click Load unpacked, select this folder.
)
echo   Proxy running at http://localhost:8787
echo.
pause