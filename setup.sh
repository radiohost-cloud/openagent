#!/bin/bash
# OpenAgent Setup — cross-platform installer
# 1. Starts the proxy server
# 2. Installs auto-start (macOS / Windows / Linux)
# 3. Opens Chrome extension page

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_DIR="$EXTENSION_DIR/proxy"

echo "OpenAgent Setup"
echo "==============="
echo ""

# Detect OS
case "$(uname -s)" in
  Darwin*)
    echo "[ macOS ]"
    # Install LaunchAgent for proxy auto-start
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

    # Open Chrome extensions page
    open "chrome://extensions/"
    echo ""
    echo "→ In Chrome: enable 'Developer mode', click 'Load unpacked', select this folder."
    ;;

  Linux*)
    echo "[ Linux ]"
    # Install systemd user service
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

    xdg-open "chrome://extensions/" 2>/dev/null || true
    echo ""
    echo "→ In Chrome: enable 'Developer mode', click 'Load unpacked', select this folder."
    ;;

  MINGW*|MSYS*|CYGWIN*)
    echo "[ Windows ]"
    # Install Task Scheduler for proxy auto-start
    TASK_NAME="OpenAgentProxy"
    SCHEDULE_TYPE="ONLOGON"

    schtasks /create /tn "$TASK_NAME" /tr "node \"$PROXY_DIR\\server.js\"" /sc "$SCHEDULE_TYPE" /f 2>/dev/null || {
      echo "Task Scheduler failed — proxy will only start when you run the bat file."
    }

    start "" "chrome://extensions/"
    echo ""
    echo "→ In Chrome: enable 'Developer mode', click 'Load unpacked', select the extension folder."
    echo "→ Run the proxy: double-click start-proxy.bat or run the cmd above manually."
    ;;
esac

# Start proxy now
echo ""
echo "Starting proxy server..."
cd "$PROXY_DIR"
node server.js &
echo "Proxy running at http://localhost:8787"
echo ""
echo "Done! Open Chrome extension page and load this folder as unpacked."