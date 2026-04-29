#!/bin/bash
# OpenAgent Setup — cross-platform installer
# 1. Starts the proxy server
# 2. Installs auto-start (macOS / Windows / Linux)
# 3. Installs Chrome extension with auto-load

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_DIR="$EXTENSION_DIR/proxy"

echo "OpenAgent Setup"
echo "==============="
echo ""

start_proxy_and_extension() {
  # Start proxy now
  cd "$PROXY_DIR"
  node server.js &
  echo "Proxy running at http://localhost:8787"
  echo ""
}

# Detect OS
case "$(uname -s)" in
  Darwin*)
    echo "[ macOS ]"

    # Install proxy LaunchAgent
    PLIST="$HOME/Library/LaunchAgents/com.openagent.proxy.plist"
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.openagent.proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>cd $PROXY_DIR && node server.js</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
EOF
    launchctl bootstrap gui/$(id -u) "$PLIST" 2>/dev/null || true
    launchctl start com.openagent.proxy 2>/dev/null || true
    echo "Proxy auto-start installed (LaunchAgent)."

    # Install Chrome auto-launcher with extension
    CHROME_APP=""
    if [ -d "/Applications/Google Chrome.app" ]; then
      CHROME_APP="/Applications/Google Chrome.app"
    fi

    if [ -n "$CHROME_APP" ]; then
      # Create a LaunchAgent that opens Chrome with extension every login
      APP_PLIST="$HOME/Library/LaunchAgents/com.openagent.chrome.plist"
      cat > "$APP_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.openagent.chrome</string>
  <key>ProgramArguments</key>
  <array>
    <string>open</string>
    <string>-a</string>
    <string>Google Chrome</string>
    <string>--args</string>
    <string>--load-extension=$EXTENSION_DIR</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
      launchctl bootstrap gui/$(id -u) "$APP_PLIST" 2>/dev/null || true
      echo "Chrome auto-start installed (extension will load on login)."
    fi

    # Open Chrome with extension now
    open -a "Google Chrome" --args "--load-extension=$EXTENSION_DIR" 2>/dev/null || true
    echo "Chrome opened with extension loaded."
    echo ""
    echo "→ Extension ID will be visible in chrome://extensions/"
    ;;

  Linux*)
    echo "[ Linux ]"

    SERVICE_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SERVICE_DIR"
    cat > "$SERVICE_DIR/openagent-proxy.service" << EOF
[Unit]
Description=OpenAgent Proxy Server

[Service]
ExecStart=/usr/bin/node $PROXY_DIR/server.js
Restart=always

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable --now openagent-proxy 2>/dev/null || true
    echo "Proxy auto-start installed (systemd)."

    # Open Chrome with extension
    google-chrome "--load-extension=$EXTENSION_DIR" 2>/dev/null || chromium "--load-extension=$EXTENSION_DIR" 2>/dev/null || {
      xdg-open "chrome://extensions/" 2>/dev/null || true
      echo "Could not auto-open Chrome. Open Chrome manually and load this folder as unpacked."
    }
    echo ""
    echo "→ In Chrome: enable 'Developer mode', click 'Load unpacked', select this folder."
    ;;

  MINGW*|MSYS*|CYGWIN*)
    echo "[ Windows ]"
    echo "(Run this script from Command Prompt or PowerShell)"
    echo ""

    # Install Task Scheduler for proxy auto-start
    schtasks /create /tn "OpenAgentProxy" /tr "node \"%PROXY_DIR%\\server.js\"" /sc ONLOGON /f 2>/dev/null || {
      echo "Task Scheduler failed — proxy needs manual start."
    }

    # Create Chrome shortcut with extension loaded
    CHROME_PATH=""
    where chrome >nul 2>&1 && CHROME_PATH="chrome"
    [ -z "$CHROME_PATH" ] && [ -f "%ProgramFiles%/Google/Chrome/Application/chrome.exe" ] && CHROME_PATH="%ProgramFiles%/Google/Chrome/Application/chrome.exe"
    [ -z "$CHROME_PATH" ] && [ -f "%LocalAppData%/Google/Chrome/Application/chrome.exe" ] && CHROME_PATH="%LocalAppData%/Google/Chrome/Application/chrome.exe"

    if [ -n "$CHROME_PATH" ]; then
      SHORTCUT="%USERPROFILE%\Desktop\OpenAgent (extension).lnk"
      PWSH_TMP="%TEMP%\oa_shortcut.ps1"
      echo 'Set oWS = CreateObject("WScript.Shell")' > "$PWSH_TMP"
      echo 'Set oLink = oWS.CreateShortcut("'"$SHORTCUT"'")' >> "$PWSH_TMP"
      echo 'oLink.TargetPath = "'"$CHROME_PATH"'"' >> "$PWSH_TMP"
      echo 'oLink.Arguments = "--load-extension='$EXTENSION_DIR'"' >> "$PWSH_TMP"
      echo 'oLink.Description = "OpenAgent"' >> "$PWSH_TMP"
      echo 'oLink.Save' >> "$PWSH_TMP"
      cscript //B "$PWSH_TMP"
      rm "$PWSH_TMP"
      echo "Chrome shortcut created on Desktop."

      # Open Chrome with extension now
      start "" "$CHROME_PATH" "--load-extension=$EXTENSION_DIR"
      echo "Chrome opened with extension."
    else
      start chrome://extensions/
      echo "Open Chrome manually, enable Developer mode, click Load unpacked."
    fi
    ;;
esac

start_proxy_and_extension
echo "Done!"