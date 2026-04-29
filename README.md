# OpenAgent — Chrome Extension

Browser assistant powered by OpenRouter. Chat about any webpage, automate actions, navigate pages with natural language.

## Features

- Chat with AI about the current page context
- Browser automation (click, type, scroll, navigate)
- Side panel UI with theme support (dark/light + presets)
- Multi-language (English, Polish)
- OpenRouter integration for model selection

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
