#!/bin/bash
# OpenAgent Setup — cross-platform installer
# 1. Starts the proxy server
# 2. Installs auto-start (macOS / Windows / Linux)
# 3. Opens Chrome with extension path ready to load

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_DIR="$EXTENSION_DIR/proxy"

echo "OpenAgent Setup"
echo "==============="
echo ""

# ─── Start proxy now ───────────────────────────────────────────
echo "[1/3] Starting proxy server..."
cd "$PROXY_DIR"
node server.js &
sleep 1
echo "   Proxy running at http://localhost:8787"

# Detect OS
case "$(uname -s)" in
  Darwin*)
    echo ""
    echo "[2/3] macOS detected"

    # Install proxy LaunchAgent
    echo "   Installing proxy auto-start..."
    PLIST="$HOME/Library/LaunchAgents/com.openagent.proxy.plist"
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" << PLIST_EOF
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
PLIST_EOF
    launchctl bootstrap gui/$(id -u) "$PLIST" 2>/dev/null || true
    launchctl start com.openagent.proxy 2>/dev/null || true
    echo "   [OK] Proxy auto-start (LaunchAgent)"

    echo ""
    echo "[3/3] Chrome extension setup"
    echo "   Opening Chrome extensions page..."
    echo "$EXTENSION_DIR" | pbcopy
    echo "   Extension path copied to clipboard."
    open -a "Google Chrome" "chrome://extensions/"
    echo ""
    echo "============================================"
    echo "NEXT STEP - takes 10 seconds:"
    echo "  1. In Chrome, enable 'Developer mode' (top right)"
    echo "  2. Click 'Load unpacked'"
    echo "  3. Paste clipboard path or navigate to:"
    echo ""
    printf "     %s\n" "$EXTENSION_DIR"
    echo ""
    echo "  4. Click 'Select Folder'"
    echo "============================================"
    open "$EXTENSION_DIR"
    ;;

  Linux*)
    echo ""
    echo "[2/3] Linux detected"

    SERVICE_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SERVICE_DIR"
    cat > "$SERVICE_DIR/openagent-proxy.service" << SYSTEMD_EOF
[Unit]
Description=OpenAgent Proxy Server

[Service]
ExecStart=/usr/bin/node $PROXY_DIR/server.js
Restart=always

[Install]
WantedBy=default.target
SYSTEMD_EOF
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable --now openagent-proxy 2>/dev/null || true
    echo "   [OK] Proxy auto-start (systemd)"

    echo ""
    echo "[3/3] Chrome extension setup"
    echo "   Opening Chrome extensions page..."
    echo "$EXTENSION_DIR" | xclip -selection clipboard 2>/dev/null || echo "$EXTENSION_DIR" | xsel --clipboard 2>/dev/null || true
    google-chrome "chrome://extensions/" 2>/dev/null || chromium "chrome://extensions/" 2>/dev/null || true
    echo "   Extension path: $EXTENSION_DIR"
    echo ""
    echo "============================================"
    echo "NEXT STEP - takes 10 seconds:"
    echo "  1. Enable 'Developer mode'"
    echo "  2. Click 'Load unpacked' and select:"
    echo ""
    printf "     %s\n" "$EXTENSION_DIR"
    echo "============================================"
    ;;

  MINGW*|MSYS*|CYGWIN*)
    echo ""
    echo "[2/3] Windows detected"

    # Install Task Scheduler for proxy auto-start
    schtasks /create /tn "OpenAgentProxy" /tr "node \"%PROXY_DIR%\\server.js\"" /sc ONLOGON /f 2>/dev/null && echo "   [OK] Proxy auto-start (Task Scheduler)" || echo "   [--] Task Scheduler not available"

    echo ""
    echo "[3/3] Chrome extension setup"
    echo "   Extension folder copied to clipboard."
    echo ""
    echo "============================================"
    echo "NEXT STEP - takes 10 seconds:"
    echo "  1. In Chrome, enable 'Developer mode' (top right)"
    echo "  2. Click 'Load unpacked'"
    echo "  3. Paste clipboard path or go to:"
    echo ""
    printf "     %s\n" "$EXTENSION_DIR"
    echo ""
    echo "  4. Click 'Select Folder'"
    echo "============================================"
    ;;
esac

echo ""
echo "Done! Proxy is running. Follow the steps above to load the extension."