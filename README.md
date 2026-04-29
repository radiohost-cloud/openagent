# OpenAgent — Chrome Extension

Browser assistant powered by OpenRouter. Chat about any webpage, automate actions, navigate pages with natural language, and save notes directly to Obsidian.

## Screenshots

<p float="left">
  <img src="docs/screenshot1.png" width="200"/>
  <img src="docs/screenshot2.png" width="200"/>
  <img src="docs/screenshot3.png" width="200"/>
</p>

## Features

- **Chat with AI** about the current page context
- **Browser automation** (click, type, scroll, navigate)
- **Obsidian integration** — save notes directly to your vault using File System Access API
  - The extension uses the File System Access API to write `.md` files directly to a folder
  - **Obsidian desktop app must be installed** for full functionality — the extension only saves files, it does not manage your vault or provide Obsidian features like search, backlinks, or plugins
  - Click the vault icon in the header to select your Obsidian vault folder
  - Toggle auto-save to append entire conversation to a single note per session
  - Manual notes created with `vault_write` get their own `.md` files
  - Notes saved directly to vault root (no hidden folders)
- **Side panel UI** with theme support (dark/light + 14 color presets)
- **Multi-language** (English, Polish)
- **OpenRouter integration** for model selection

## Installation

1. Download or clone this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select this directory

## Setup

1. Open the extension (click the toolbar icon or use `Alt+Shift+O`)
2. Go to **Settings**
3. Paste your [OpenRouter API key](https://openrouter.ai/keys)
4. Select a model and start chatting

## Obsidian Vault

> **Note:** This extension saves `.md` files to a folder of your choice. Full Obsidian experience (search, backlinks, plugins, graph view) requires [Obsidian](https://obsidian.md) to be installed and running.

1. Click the **vault icon** in the header (or go to Settings → Obsidian Vault)
2. Click **"Select folder"** and choose your Obsidian vault directory
3. The browser will remember your selection across sessions
4. Toggle auto-save to automatically append conversation to a note

## Keyboard Shortcut

Default: `Alt+Shift+O` to open the side panel (configurable in `chrome://extensions/shortcuts`).

## Project Structure

```
├── manifest.json      # Chrome extension manifest
├── background.js      # Service worker
├── content.js         # Content script (FAB + page automation)
├── sidepanel.*        # Side panel UI
├── offscreen.*        # Offscreen document
├── icons/             # Extension icons
├── _locales/          # i18n strings (EN, PL)
└── docs/              # Screenshots
```

## License

MIT