#!/bin/bash
# OpenAgent Setup — cross-platform installer
# 1. Installs Node.js if missing
# 2. Starts the proxy server
# 3. Installs auto-start (macOS / Linux)
# 4. Opens Chrome extension page with instructions

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_DIR="$EXTENSION_DIR/proxy"
MISSING_NODE=""

echo "OpenAgent Setup"
echo "==============="
echo ""

# ─── Check / install Node.js ──────────────────────────────────
if command -v node >/dev/null 2>&1; then
  echo "[OK] Node.js found: $(node --version)"
else
  echo "Node.js not found. Installing..."

  case "$(uname -s)" in
    Darwin*)
      if command -v brew >/dev/null 2>&1; then
        echo "   Installing via Homebrew..."
        brew install node
      else
        echo "   Homebrew not found."
        MISSING_NODE="1"
        echo ""
        echo "  Download Node.js from: https://nodejs.org"
        echo "  After installing, re-run this script."
        exit 1
      fi
      ;;
    Linux*)
      if command -v apt-get >/dev/null 2>&1; then
        echo "   Installing via apt..."
        sudo apt-get install -y nodejs npm
      elif command -v dnf >/dev/null 2>&1; then
        echo "   Installing via dnf..."
        sudo dnf install -y nodejs npm
      elif command -v yum >/dev/null 2>&1; then
        echo "   Installing via yum..."
        sudo yum install -y nodejs npm
      elif command -v pacman >/dev/null 2>&1; then
        echo "   Installing via pacman..."
        sudo pacman -S --noconfirm nodejs npm
      else
        MISSING_NODE="1"
        echo "   No supported package manager found."
        echo ""
        echo "  Download Node.js from: https://nodejs.org"
        echo "  After installing, re-run this script."
        exit 1
      fi
      ;;
  esac

  if command -v node >/dev/null 2>&1; then
    echo "[OK] Node.js installed: $(node --version)"
  fi
fi

# ─── Start proxy ───────────────────────────────────────────────
echo ""
echo "Starting proxy server..."
cd "$PROXY_DIR"
node server.js &
echo "   Proxy running at http://localhost:8787"

# ─── Proxy auto-start ──────────────────────────────────────────
echo ""
echo "Installing proxy auto-start..."

case "$(uname -s)" in
  Darwin*)
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
    ;;

  Linux*)
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
    ;;
esac

# ─── Chrome extension setup ────────────────────────────────────
echo ""
echo "Opening Chrome extension page..."
echo "$EXTENSION_DIR" | pbcopy 2>/dev/null || true

case "$(uname -s)" in
  Darwin*)
    open -a "Google Chrome" "chrome://extensions/" 2>/dev/null || true
    ;;
  Linux*)
    google-chrome "chrome://extensions/" 2>/dev/null || chromium "chrome://extensions/" 2>/dev/null || xdg-open "chrome://extensions/" 2>/dev/null || true
    ;;
esac

echo ""
echo "============================================================="
echo "NEXT STEP — takes 10 seconds:"
echo ""
echo "  1. In Chrome, enable 'Developer mode' (top right toggle)"
echo "  2. Click 'Load unpacked'"
echo "  3. Navigate to the extension folder (path in clipboard)"
echo ""
printf "     %s\n" "$EXTENSION_DIR"
echo ""
echo "  4. Click 'Select Folder'"
echo "============================================================="
open "$EXTENSION_DIR"
echo ""
echo "Done!"