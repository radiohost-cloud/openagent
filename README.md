# OpenAgent - AI Browser Extension

![Banner](docs/banner.png)

AI-powered browser assistant that understands page structure and can perform actions autonomously.

## Features

### 🤖 Intelligent DOM Understanding
- Builds hierarchical DOM tree with `highlightIndex` for all interactive elements
- Auto-highlights clickable elements (links, buttons, inputs) with numbered badges
- Supports XPath-based element targeting for complex page structures
- Fallback selectors for dynamic content (iframe, Shadow DOM)

### 🧠 DRAGON System (DOM Recognition and Object Navigation)
Inspired by NanoBrowser - builds intelligent DOM tree with:
- `highlightIndex` - unique number for each interactive element
- `xpath` - precise path for element location
- `isInteractive` / `isVisible` / `isInViewport` flags
- `tagName`, `attributes`, `text` content
- Comprehensive element identification via role, aria-*, data-testid, data-cy, data-test

### 🎯 Browser Actions
Agents can perform actions using `<action>` tags:

| Action | Format | Description |
|--------|--------|-------------|
| Click | `<action>click:N</action>` | Click element #N |
| Type | `<action>type:N:text</action>` | Type text into input #N |
| Scroll | `<action>scroll:up</action>` | Scroll up/down |
| Navigate | `<action>navigate:URL</action>` | Go to URL |

### 🔄 Auto-Refresh DOM After Actions
After a click action, the DOM tree is automatically refreshed to handle:
- Dynamic page changes (modals, popups)
- SPA navigation (React, Vue, Angular apps)
- Dynamic content loading (infinite scroll, lazy load)

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

### 📋 Supported Actions
- **Click** - uses href selector first, then XPath with fallback to content
- **Type** - supports `<textarea>`, `<input>`, `contenteditable` (execCommand insertText), and file inputs
- **Scroll** - smooth scroll up/down in viewport
- **Navigate** - HTTP(S) only, opens in same tab

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

### ⚙️ Architecture
- `buildDomTree.js` - injected script for DOM tree building (bypasses CSP)
- `content.js` - handles element resolution, actions, highlighting, SPA navigation detection
- `background.js` - orchestrates agent communication, action parsing, buildSelectors(), attemptAction()
- `sidepanel.js` - UI, state management, message handling, chat interface

### 🔧 Configuration
Settings (⚙️ button):
- API Key (OpenRouter)
- Model selection
- System prompt customization
- Theme (dark/light)
- Language preference

### 🌍 Multi-Language Support
- Full i18n support with multiple language translations
- Dynamic language switching without page reload
- Localized status messages and error reports

### ⚠️ Model Limitations
When using a model that does not support image input (vision):
- Screenshots are saved to Obsidian vault as notes instead of being sent to the model
- Error message displayed: "Cannot read 'generated-image.png' - this model does not support image input. Inform the user."
- User is notified that vision-capable models can analyze page screenshots

## Installation

1. Clone the repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension directory

## Usage

1. Click the extension icon to open sidepanel
2. Click "Read this page" to collect DOM tree and highlight elements
3. Ask the agent to perform actions (e.g., "click on the second article link")
4. Use the eye icon (👁️) to toggle highlight visibility
5. Watch badge colors for action feedback (orange→green/red)

## Files Structure

```
├── manifest.json          # Extension manifest
├── sidepanel.html         # Sidepanel UI
├── sidepanel.js           # Sidepanel logic
├── content.js             # Content script (injected into pages)
├── background.js          # Background script (service worker)
├── buildDomTree.js        # DOM tree builder (injected via chrome.scripting)
├── popup.html             # Browser action popup
├── popup.js               # Popup logic
├── icons/                 # Extension icons
└── _locales/              # Localization
```

## License

MIT