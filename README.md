# OpenAgent — Chrome Extension

Browser assistant powered by OpenRouter. Chat about any webpage, automate actions, navigate pages with natural language, and automatically save your conversations to Obsidian.

## Screenshots

<p float="left">
  <img src="docs/screenshot1.png" width="200"/>
  <img src="docs/screenshot2.png" width="200"/>
  <img src="docs/screenshot3.png" width="200"/>
</p>

## Features

- **Chat with AI** about the current page context
- **Browser automation** (click, type, scroll, navigate)
- **Obsidian integration** — save notes directly to your vault
  - Toggle button in header to enable auto-save mode
  - Auto-save appends entire conversation to a single note per session
  - Manual notes created with `vault_write` get their own `.md` files
  - Notes saved directly to vault root (no hidden folders)
- **Side panel UI** with theme support (dark/light + 14 color presets)
- **Multi-language** (English, Polish)
- **OpenRouter integration** for model selection

## Obsidian Setup

1. Open the extension → **Settings**
2. Find the **Obsidian Vault** section (expand it)
3. Enter your vault path, e.g.:
   - macOS: `/Users/you/Library/Mobile Documents/iCloud~md~obsidian/Documents/my-vault`
   - Windows: `C:\Users\you\Documents\Obsidian\my-vault`
   - Linux: `/home/you/Documents/my-vault`
4. Click the **Obsidian icon** in the header to enable auto-save
5. Conversations are saved as `openagent-{page}-{date}-{time}.md` directly in your vault

## Auto-start Proxy

The proxy server needs to be running for the extension to work. Run the setup script once:

```bash
cd proxy
chmod +x setup-autostart.sh
./setup-autostart.sh
```

After this, the proxy will start automatically after every login or restart (macOS LaunchAgent). No need to manually run it again.

To remove auto-start:
```bash
launchctl unload ~/Library/LaunchAgents/com.openagent.proxy.plist
rm ~/Library/LaunchAgents/com.openagent.proxy.plist
```

## Setup

### 1. Install the extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this directory

### 2. Start the proxy

```bash
cd proxy
npm install
npm start
```

The proxy runs at `http://localhost:8787` and forwards requests to OpenRouter.

### 3. Get an API key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/keys](https://openrouter.ai/keys)
3. Open the extension, go to **Settings**, paste the API key
4. Select a model and start chatting

## Project Structure

```
├── manifest.json          # Chrome extension manifest
├── background.js         # Service worker
├── content.js           # Content script (FAB + page automation)
├── sidepanel.*          # Side panel UI
├── mic-permission.html  # Microphone permission flow
├── offscreen.*          # Offscreen document
├── proxy/               # Local proxy server (Express)
│   └── server.js
├── icons/               # Extension icons
└── _locales/            # i18n strings (57 languages)
```

## Keyboard Shortcut

Default: `Alt+Shift+O` to open the side panel (configurable in `chrome://extensions/shortcuts`).

## License

MIT
