# OpenAgent — Chrome Extension

AI-powered browser assistant. Chat about any webpage, automate browser actions, and save notes directly to Obsidian — all without leaving your current tab.

## Screenshots

<p float="left">
  <img src="docs/screenshot1.png" width="200"/>
  <img src="docs/screenshot2.png" width="200"/>
  <img src="docs/screenshot3.png" width="200"/>
  <img src="docs/screenshot4.png" width="200"/>
  <img src="docs/screenshot5.png" width="200"/>
</p>

## Features

- **Chat about any page** — AI understands the content of the current webpage
- **Browser automation** — instruct the AI to click, type, scroll, or navigate
- **Obsidian integration** — save notes to your vault using the File System Access API
  - Toggle auto-save to append your entire conversation to a session note
  - Notes saved as `.md` files directly to your vault root
  - **Requires Obsidian desktop app installed** for full functionality (search, backlinks, graph view)
- **Customizable UI** — 14 color presets, dark/light mode, adjustable font size
- **Multi-language** — English, Polish, Spanish, French, German, Russian
- **OpenRouter** — use any model from OpenRouter's model catalog

## Installation

1. Download or clone this repository
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right corner)
4. Click **Load unpacked**
5. Select this directory
6. (Optional) Set a keyboard shortcut in `chrome://extensions/shortcuts`

## Setup

1. Click the extension icon in the toolbar, or use the keyboard shortcut
2. Click **Settings** (gear icon)
3. Paste your [OpenRouter API key](https://openrouter.ai/keys)
4. Pick a model from the dropdown and start chatting

## How It Works

The extension analyzes the current webpage and sends the page content to the AI along with your message. The AI can read page content, execute browser actions (click, type, scroll, navigate), and write notes to your Obsidian vault.

### Vault & Notes

The vault uses the browser's File System Access API to write `.md` files directly to a folder you choose. The path is remembered across sessions. You need [Obsidian](https://obsidian.md) installed to use the notes with full features (search, backlinks, plugins, graph view).

To save a note manually, ask the AI to save something — it will write a `.md` file to your vault. Toggle auto-save in the header to append every conversation to a session file automatically.

## Keyboard Shortcuts

- **Open side panel** — configurable in `chrome://extensions/shortcuts`

## Project Structure

```
openagent/
├── manifest.json      # Extension manifest
├── background.js     # Service worker (API calls, routing)
├── content.js       # Content script (FAB, page automation)
├── sidepanel.*      # Side panel UI (chat, settings)
├── icons/           # Extension icons
├── docs/            # Screenshots
└── _locales/        # i18n (EN, PL, ES, FR, DE, RU)
```

## License

MIT
