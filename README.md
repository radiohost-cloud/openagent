# OpenAgent - AI Browser Extension

![Banner](docs/banner.png)

AI-powered browser assistant that understands page structure and can perform actions autonomously.

<p float="left">
  <img src="docs/screenshot9.png" width="200"/>
  <img src="docs/screenshot5.png" width="200"/>
  <img src="docs/screenshot6.png" width="200"/>
  <img src="docs/screenshot8.png" width="200"/>
  <img src="docs/screenshot7.png" width="200"/>
  <img src="docs/screenshot1.png" width="200"/>
  <img src="docs/screenshot2.png" width="200"/>
  <img src="docs/screenshot3.png" width="200"/>
  <img src="docs/screenshot4.png" width="200"/>
</p>

---

## Features

### 💬 Chat & Memory
- **Chat about any page** — AI understands the content of the current webpage
- **Persistent memory** — AI remembers context from previous conversations, even across different pages and sessions. Key facts and summaries are stored locally in IndexedDB
- **Chat history** — save, resume, and delete conversations; continue them and append messages to the current thread
- **Auto-refresh context** — page context updates automatically when you switch tabs or navigate; cached data shown instantly, refreshed in background

### 📸 Screenshot
- **Screenshot capture** — take a screenshot and send it to vision-capable models (Claude, GPT-4o, Gemini, etc.) for visual analysis
- Vision support auto-detected from OpenRouter API

### 🌐 Navigation & Search
- **Universal address input** — type any URL or domain name directly in the chat field to navigate; works on blank/new tab pages and start pages
- **Quick search shortcuts:**
  - `/g query` — Google
  - `/y query` — YouTube
  - `/x query` — X.com
  - `/w query` — Wikipedia
  - `/r query` — Reddit
  - `/gh query` — GitHub
  - `/d query` — DuckDuckGo
  - `/o query` — Obsidian vault (searches your vault notes)
  - `/i intent text` — update session intent without sending a message (useful for refining the AI's focus mid-conversation)

### 🤖 Browser Automation
- **Intelligent link clicking** — the AI receives a numbered list of all links on the page. Simply say "click link 3", "go to first link", or use any language: "pierwszy link", "clique sur le lien", "den ersten Link" — the AI understands and clicks the right link
- **Action tags** — the AI responds with action tags that are automatically executed:
  - `<action>click:N</action>` — click link or button number N
  - `<action>hover:N</action>` — hover over element N (reveals dropdowns, tooltips)
  - `<action>scroll:up</action>` or `<action>scroll:down</action>` — scroll the page
  - `<action>scroll_to:N</action>` — scroll element N into view
  - `<action>navigate:URL</action>` — go to a URL
  - `<action>type:N:text</action>` — type text into input field N
  - `<action>select:N:value</action>` — select option by value in dropdown N
  - `<action>drag:SOURCE:TARGET</action>` — drag element SOURCE to TARGET
  - `<action>go_back</action>` — navigate back in history
  - `<action>refresh</action>` — reload the current page
- **Multilingual** — works in any language (Polish, English, German, French, Spanish, Russian, etc.)

### 🌐 Web Search
- **Intelligent web search** — toggle Web Search in Settings to give the agent access to real-time information
- The AI autonomously decides when to search (news, weather, current events, live scores, stock prices, etc.) via tool calling
- **Multiple search providers** supported:
  - **OpenRouter** — uses built-in server-side search, no extra API key needed (requires OpenRouter endpoint)
  - **Brave Search** — privacy-focused search, requires [Brave Search API key](https://brave.com/search/api/)
  - **SerpAPI** — Google search results, requires [SerpAPI key](https://serpapi.com/)
  - **Tavily** — AI-optimized search with answer summaries, requires [Tavily API key](https://tavily.com/)
- Results include citations and are processed by the model in context
- Visual indicator on the input field shows when Web Search is active (accent color glow)

### 📁 Obsidian Integration
- **Auto-save conversations** — every message is automatically appended to a session note in your vault
- **Session notes** — notes are named after the website domain and date (e.g. `github-com-2026-05-01.md`)
- **Vault awareness** — the AI knows it's connected to Obsidian and can read/write notes on demand
- **History resume** — restored conversations sync back to their vault notes automatically
- **Remote access** — works over Local REST API, no need to have Obsidian open on the same machine
- **Requires:** Obsidian desktop app + [Local REST API plugin](https://obsidian.md/plugins?id=obsidian-local-rest-api)

#### Intent Field

Each session note includes an `intent` field in the YAML frontmatter. This is a short summary of your conversation purpose — auto-generated from your first message but also manually settable.

- **Auto-generated** — The first message you send is automatically extracted (up to 200 characters) and saved as `intent:` in the note's frontmatter. For example, sending *"How do I use git rebase?"* creates `intent: How do I use git rebase`
- **Update with /i** — Type `/i your new intent` in the chat to overwrite the intent without sending a message. The note updates immediately and the AI sees the new intent in context
- **Persists across appends** — Within a session, subsequent messages append to the note without changing intent. The `/i` command is the only way to change it during conversation
- **Obsidian filters** — Since `intent` is a frontmatter field, you can filter and search your vault by it (e.g., Dataview queries: `TABLE intent FROM "obsidian" WHERE intent`) to find notes by topic across your vault

Example frontmatter:
```yaml
---
url: github.com
model: anthropic/claude-3.5-sonnet
provider: openrouter
date: 2026-05-03
intent: How do I use git rebase
urls:
  - https://github.com/git/git
tags: [openagent, github-com, openrouter, claude-3-5-sonnet]
---
```

### 🧠 DRAGON System (DOM Recognition and Object Navigation)
Inspired by NanoBrowser - builds intelligent DOM tree with:
- `highlightIndex` - unique number for each interactive element
- `xpath` - precise path for element location
- `isInteractive` / `isVisible` / `isInViewport` flags
- `tagName`, `attributes`, `text` content
- Comprehensive element identification via role, aria-*, data-testid, data-cy, data-test

### 🤖 Intelligent DOM Understanding
- Builds hierarchical DOM tree with `highlightIndex` for all interactive elements
- Auto-highlights clickable elements (links, buttons, inputs) with numbered badges
- Supports XPath-based element targeting for complex page structures
- Fallback selectors for dynamic content (iframe, Shadow DOM)

### 👁️ Highlight Toggle
- Click the eye icon (👁️) in the header to show/hide element highlights
- Highlights are hidden by default - click to reveal
- Works for both highlights (borders) and badges (numbers)
- Toggle button in header (eye icon with eye-slash SVG)

### ✨ Visual Feedback & Error Recovery
- **Badge States**: Real-time color feedback during actions:
  - 🟠 Orange (loading) - action in progress
  - 🟢 Green (success) - action completed successfully
  - 🔴 Red (error) - action failed
- **Error Recovery**: Multiple selector fallbacks for reliable element targeting:
  1. href selector (for links)
  2. id attribute
  3. data-testid / data-cy / data-test
  4. role + aria-label
  5. class name
  6. XPath (full or simplified)
- **Action Verification**: `verifyAction()` confirms element state before/after actions
- **Page State Hash**: `computePageStateHash()` detects DOM changes for verification

### 🔄 Auto-Refresh DOM After Actions
After a click action, the DOM tree is automatically refreshed to handle:
- Dynamic page changes (modals, popups)
- SPA navigation (React, Vue, Angular apps)
- Dynamic content loading (infinite scroll, lazy load)

### 🔍 Enhanced Interactive Element Detection
Expanded selectors for comprehensive element coverage:
- Standard: `a[href]`, `button`, `input:not([type="hidden"])`, `textarea`, `select`
- ARIA roles: `menuitem`, `option`, `checkbox`, `radio`, `switch`, `tab`, `textbox`, `searchbox`, `combobox`
- Attributes: `[role="button"]`, `[role="link"]`, `[contenteditable="true]`, `[tabindex]`, `[onclick]`, `[data-click]`, `[ng-click]`
- Special: `details > summary`, `label[for]`, `summary`, `menuitem`, `option`, `area`
- Visibility checks: display, visibility, opacity, offsetWidth/offsetHeight, hidden attribute

### 🌐 Multi-Site Compatibility
Tested on:
- Gmail (reply composition, text input in contenteditable)
- Google Sheets (cell input)
- Twitter/X (tweet composition)
- Terminal emulators (xterm.js)
- News sites with dynamic content
- Complex SPAs with React/Vue/Angular

### ⚠️ Model Limitations
When using a model that does not support image input (vision):
- Screenshots are saved to Obsidian vault as notes instead of being sent to the model
- Error message displayed: "Cannot read 'generated-image.png' - this model does not support image input. Inform the user."
- User is notified that vision-capable models can analyze page screenshots

### 🎨 Customization
- **14 color presets** — dark and light themes
- **Adjustable font size** — small, medium, large
- **Multi-language UI** — English, Polski, Español, Français, Deutsch, Русский

### 🔌 API Endpoint
- **Customizable API endpoint** — use any OpenAI-compatible API provider
- Set your **API Base URL** in Settings (default: `https://openrouter.ai/api/v1`)
- Works with OpenRouter, local LLMs (Ollama, LM Studio, vLLM), OpenAI, and any provider supporting the `/v1/chat/completions` format
- Model list auto-fetches from the configured endpoint `/models`
- OpenRouter-specific features (built-in web search, provider routing) enabled automatically when using the OpenRouter endpoint

### 🔧 System Prompt (Customization)

You can fully customize the AI's behavior by setting a custom system prompt in **Settings → System Prompt**.

The AI already knows its role by default, but a custom prompt lets you:
- Change its primary focus (e.g., Obsidian-focused note-taking assistant)
- Add domain-specific instructions (e.g., "Always cite sources", "Format code blocks with language tags")
- Define response style and structure

**Vault tools** (available automatically when Obsidian is connected):

| Tool | Usage | Description |
|------|-------|-------------|
| Read notes | `<vault_read query="search terms" />` | Search vault for `.md` files matching the query |
| Write session | `<vault_write>content</vault_write>` | Append to the current session note |
| Write note | `<vault_write filename="topic.md">content</vault_write>` | Create a new `.md` note |

Session notes are automatically saved per conversation and named after the website domain + date (e.g. `github-com-2026-05-01.md`). The AI receives full vault instructions whenever the vault is connected, regardless of your custom prompt.

Leave the system prompt empty to use the default built-in prompt. The AI will always receive page context, memory, and vault capabilities regardless of your custom prompt.

---

## Installation

1. Clone the repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension directory
6. (Optional) Set a keyboard shortcut in `chrome://extensions/shortcuts`

## Setup

1. Click the extension icon in the toolbar, or use the keyboard shortcut
2. Click **Settings** (gear icon)
3. Enter your API key (e.g., [OpenRouter API key](https://openrouter.ai/keys)) — or configure a custom endpoint for other providers
4. Pick a model from the dropdown and start chatting

### Obsidian Setup

1. Install the [Local REST API plugin](https://obsidian.md/plugins?id=obsidian-local-rest-api) in Obsidian
2. Enable the plugin in Obsidian settings
3. In OpenAgent settings, expand **Obsidian Vault**
4. Enter:
   - **Vault name** — subfolder path within your vault (e.g. `/obsidian`, no trailing slash — or leave empty for root)
   - **API URL** — `http://127.0.0.1:27124` (default)
   - **API Token** — from the Local REST API plugin settings
5. Click **Test connection** — green "Connected" means it's working
6. The vault button in the toolbar turns purple when connected

---

## How It Works

The extension analyzes the current webpage and sends the page content to the AI along with your message. The AI can:

- Read page content
- Execute browser actions (click, type, scroll, navigate)
- Write notes directly to your Obsidian vault
- Remember context from previous conversations (stored locally in your browser)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Open side panel` | Configurable in `chrome://extensions/shortcuts` |

---

## Project Structure

```
openagent/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (API calls, routing, action execution)
├── content.js             # Content script (page context, DOM automation, link collection)
├── sidepanel.html         # Side panel UI
├── sidepanel.js           # Side panel logic
├── sidepanel.css          # Side panel styles
├── buildDomTree.js        # DOM tree builder (injected via chrome.scripting, bypasses CSP)
├── db.js                  # IndexedDB wrapper (conversations, memory)
├── memory.js              # Memory extraction & matching
├── icons/                 # Extension icons
└── _locales/              # i18n translations
```

## License

MIT