#!/bin/bash
# Auto-start setup for OpenAgent Proxy

AGENT_PLIST="$HOME/Library/LaunchAgents/com.openagent.proxy.plist"
NODE_BIN=$(which node 2>/dev/null || echo "/usr/local/bin/node")

echo "OpenAgent Proxy — Auto-start Setup"
echo "==================================="

if [ -f "$AGENT_PLIST" ]; then
  echo "Auto-start already installed."
  echo "To remove: launchctl unload $AGENT_PLIST && rm $AGENT_PLIST"
  exit 0
fi

# Detect node path
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN=$(node -e "console.log(process.execPath)" 2>/dev/null)
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
    <string>cd $(pwd) && node server.js</string>
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

echo "Done! Proxy will start automatically after each login/restart."
echo "Agent: $AGENT_PLIST"
echo ""
echo "Start manually: node server.js"
echo "Remove auto-start: launchctl unload $AGENT_PLIST && rm $AGENT_PLIST"