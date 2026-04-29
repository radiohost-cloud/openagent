#!/bin/bash
# Auto-start setup for OpenAgent Proxy

cd "$(dirname "$0")" || exit 1

AGENT_PLIST="$HOME/Library/LaunchAgents/com.openagent.proxy.plist"
PROXY_DIR="$(pwd)"

echo "OpenAgent Proxy — Auto-start Setup"
echo "==================================="
echo "Proxy directory: $PROXY_DIR"

if [ -f "$AGENT_PLIST" ]; then
  echo "Auto-start already installed."
  echo "To remove: launchctl unload $AGENT_PLIST && rm $AGENT_PLIST"
  exit 0
fi

cat > "$AGENT_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.openagent.proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>cd $PROXY_DIR && node server.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
EOF

launchctl bootstrap gui/$(id -u) "$AGENT_PLIST" 2>/dev/null
launchctl start com.openagent.proxy 2>/dev/null

echo ""
echo "Done! Proxy will start automatically after each login/restart."
echo "To start manually: cd $PROXY_DIR && node server.js"
echo "To remove auto-start: launchctl unload $AGENT_PLIST && rm $AGENT_PLIST"