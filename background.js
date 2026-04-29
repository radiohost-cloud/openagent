// background.js - Chrome Extension Service Worker
// Bridges side panel UI, content scripts, and the local proxy server

const PROXY_URL = 'http://localhost:8787';
const AUTO_START_KEY = 'openagent_proxy_autostart_done';
const STORAGE_KEYS = {
  API_KEY: 'claude_api_key',
  MODEL: 'claude_model',
  PROVIDER: 'claude_provider',
  SYSTEM_PROMPT: 'claude_system_prompt',
  THEME: 'claude_theme',
  PRESET: 'claude_preset',
  LANGUAGE: 'claude_language',
  VAULT_PATH: 'openagent_vault_path',
  AUTO_VAULT: 'openagent_auto_vault',
};

// ─── Auto-inject content script on page load ───────────────────────────────────

// Track which tabs have been injected to avoid double-injection
const injectedTabs = new Set();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await injectIntoTab(activeInfo.tabId);
});

chrome.webNavigation?.onCompleted?.addListener(async (details) => {
  if (!details.frameId) {
    await injectIntoTab(details.tabId);
  }
}, { url: [{ schemes: ['http', 'https'] }] });

chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, async (tabs) => {
  for (const tab of tabs) {
    if (!injectedTabs.has(tab.id)) {
      await injectIntoTab(tab.id);
    }
  }
});

async function injectIntoTab(tabId) {
  if (!tabId || injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith('http')) {
      console.log('[OpenAgent] injectIntoTab: skipping non-http tab', tabId, tab.url);
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    console.log('[OpenAgent] injectIntoTab: injected into', tabId, tab.url);
  } catch (err) {
    console.log('[OpenAgent] injectIntoTab: failed', tabId, err.message);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getWebTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.log('[OpenAgent] getWebTab: no active tab');
    return null;
  }

  if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    console.log('[OpenAgent] getWebTab: using active tab', tab.id, tab.url);
    return tab;
  }

  const webTabs = await chrome.tabs.query({
    url: ['http://*/*', 'https://*/*'],
    windowId: tab.windowId,
  });

  console.log('[OpenAgent] getWebTab: active tab is', tab.url, '-> found', webTabs.length, 'web tabs');
  if (webTabs.length > 0) {
    const result = webTabs[0];
    console.log('[OpenAgent] getWebTab: using tab', result.id, result.url);
    return result;
  }

  return null;
}

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    // --- Settings ---
    'settings.load': () => loadSettings(),
    'settings.save': () => saveSettings(message.data),

    // --- Content Script Injection ---
    'inject.content': () => injectContentScript(),

    // --- Page Context ---
    'page.collect': () => sendToContentScript('page.collect'),
    'page.dom.snapshot': () => sendToContentScript('page.dom.snapshot'),
    'page.dom.perform': () => sendToContentScript('page.dom.perform', { steps: message.steps }),
    'page.navigate': () => sendNavigateAction(message.url),

    // --- Chat ---
    'prompt.send': () => handlePromptSend(message, sendResponse),
    'conversation.clear': () => ({ ok: true }),

    // --- Browser Context ---
    'context.tabs.list': () => listOpenTabs(),
    'context.history.search': () => searchHistory(message.query),

    // --- Streaming ---
    'stream.start': () => startStream(message, sendResponse),

    // --- Vault ---
    'vault.read': () => handleVaultRead(message),
    'vault.write': () => handleVaultWrite(message),

    // --- Auto Vault ---
    'autovault.load': () => loadAutoVault(),
    'autovault.save': () => saveAutoVault(message.enabled),

    // --- Proxy Auto-Start ---
    'proxy.start': () => startProxyServer(),
  };

  const handler = handlers[message.type];
  if (!handler) {
    return false;
  }

  const result = handler();
  if (result instanceof Promise) {
    result.then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (result !== undefined) {
    sendResponse(result);
  }
  return true;
});

// ─── Content Script Communication ──────────────────────────────────────────────

async function injectContentScript() {
  const tab = await getWebTab();
  if (!tab?.id) return { error: 'No active web page tab found' };
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    return { ok: true, tabId: tab.id };
  } catch (err) {
    // Already injected is fine
    return { ok: true, tabId: tab.id };
  }
}

async function sendToContentScript(type, payload) {
  const tab = await getWebTab();
  if (!tab?.id) return { error: 'No active web page tab found' };

  // Only inject if we can't send a message (script not loaded yet)
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type, ...payload });
    console.log('[OpenAgent] sendToContentScript', type, '-> ok:', result?.ok, 'error:', result?.error, 'url:', result?.rawCapture?.metadata?.url);
    return result;
  } catch (err) {
    // Script not injected yet — inject it and retry once
    console.log('[OpenAgent] sendMessage failed, injecting:', err.message);
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    } catch (e) {
      console.log('[OpenAgent] inject failed:', e.message);
    }
    try {
      const result = await chrome.tabs.sendMessage(tab.id, { type, ...payload });
      console.log('[OpenAgent] sendToContentScript', type, 'retry -> ok:', result?.ok, 'error:', result?.error);
      return result;
    } catch (e) {
      console.log('[OpenAgent] sendMessage retry failed:', e.message);
      return { error: `Cannot communicate with page. Try reloading the page.` };
    }
  }
}

async function sendNavigateAction(url) {
  const tab = await getWebTab();
  if (!tab?.id) return { error: 'No active web page tab found' };
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'page.navigate', command: { kind: 'navigate', url } });
  } catch (err) {
    return { error: `Cannot send to page: ${err.message}` };
  }
}

async function ensureContentScript(tabId, tabUrl) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    // Script may already be injected — this is fine
    console.debug('ensureContentScript:', err.message);
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function loadSettings() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.MODEL,
    STORAGE_KEYS.PROVIDER,
    STORAGE_KEYS.SYSTEM_PROMPT,
    STORAGE_KEYS.THEME,
    STORAGE_KEYS.PRESET,
    STORAGE_KEYS.LANGUAGE,
    STORAGE_KEYS.VAULT_PATH,
    STORAGE_KEYS.AUTO_VAULT,
  ]);
  return {
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    model: result[STORAGE_KEYS.MODEL] || '',
    provider: result[STORAGE_KEYS.PROVIDER] || 'openrouter',
    systemPrompt: result[STORAGE_KEYS.SYSTEM_PROMPT] || '',
    theme: result[STORAGE_KEYS.THEME] || 'dark',
    preset: result[STORAGE_KEYS.PRESET] || 'default',
    language: result[STORAGE_KEYS.LANGUAGE] || 'en',
    vaultPath: result[STORAGE_KEYS.VAULT_PATH] || '',
    autoVault: result[STORAGE_KEYS.AUTO_VAULT] || false,
  };
}

async function saveSettings(data) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.API_KEY]: data.apiKey || '',
    [STORAGE_KEYS.MODEL]: data.model || '',
    [STORAGE_KEYS.PROVIDER]: data.provider || 'openrouter',
    [STORAGE_KEYS.SYSTEM_PROMPT]: data.systemPrompt || '',
    [STORAGE_KEYS.THEME]: data.theme || 'dark',
    [STORAGE_KEYS.PRESET]: data.preset || 'default',
    [STORAGE_KEYS.LANGUAGE]: data.language || 'en',
    [STORAGE_KEYS.VAULT_PATH]: data.vaultPath || '',
  });
  return { ok: true };
}

// ─── Prompt / Chat ─────────────────────────────────────────────────────────────

async function handlePromptSend(message, sendResponse) {
  const settings = await loadSettings();
  if (!settings.apiKey) {
    sendResponse({ error: 'API key not configured. Please set it in Settings.' });
    return;
  }

  const { conversationHistory, pageContext, autoVault } = message;
  const messages = buildMessages(conversationHistory, pageContext, settings.systemPrompt, settings.vaultPath, autoVault);

  try {
    const response = await fetch(`${PROXY_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        apiKey: settings.apiKey,
        model: settings.model,
        provider: settings.provider,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      sendResponse({ error: `Proxy error (${response.status}): ${error}` });
      return;
    }

    const data = await response.json();
    sendResponse({ content: data.content || '' });
  } catch (err) {
    sendResponse({ error: `Cannot connect to proxy at ${PROXY_URL}. Is the server running?` });
  }
}

function buildVaultInstructions(vaultPath) {
  return `VAULT TOOLS — You have two tools to persist and recall information across conversations:

1. VAULT_READ: Use <vault_read query="optional search term" /> to read existing notes from the user's Obsidian vault.
   When to use: user asks to recall something, check memories, see past notes, or refers to "my notes" / "what did we save".

2. VAULT_WRITE: Use <vault_write filename="descriptive-name-YYYY-MM-DD.md">markdown content here</vault_write> to save important information to the vault.
   When to use: user asks to save something, remember something, or you want to proactively persist key information.
   - Always wrap the full note content in the tag, including markdown headers.
   - Use descriptive filenames: lowercase with hyphens and a date suffix. Example: "web-research-2026-04-29.md"
   - The vault directory is: ${vaultPath}

IMPORTANT: Remove vault tool tags from your response after executing them. Always confirm when you save a note (e.g., "Saved to vault as web-research-2026-04-29.md").`;
}

function buildMessages(history, pageContext, systemPrompt, vaultPath, autoVault) {
  const msgs = [];
  const vaultInstructions = vaultPath ? buildVaultInstructions(vaultPath) : '';

  const combinedSystem = (() => {
    if (systemPrompt && vaultInstructions) return `${systemPrompt}\n\n${vaultInstructions}`;
    if (systemPrompt) return systemPrompt;
    if (vaultInstructions) return vaultInstructions;
    return null;
  })();

  if (combinedSystem) {
    msgs.push({ role: 'system', content: combinedSystem });
  }
  if (pageContext) {
    msgs.push({
      role: 'user',
      content: `Current page context:\nURL: ${pageContext.url}\nTitle: ${pageContext.title}\n\nContent:\n${pageContext.bodyText}${pageContext.selectedText ? `\n\nSelected text: ${pageContext.selectedText}` : ''}`,
    });
  }
  for (const msg of history) {
    msgs.push({ role: msg.role, content: msg.content });
  }

  // Auto-vault: append instruction to last user message
  if (autoVault && vaultPath) {
    const autoVaultNote = `\n\n[NOTE: AUTO-VAULT ENABLED — After responding, proactively identify important information discussed in this conversation and save a concise summary note to the Obsidian vault using <vault_write filename="topic-date.md">...</vault_write>. Focus on key facts, decisions, URLs, code snippets, or anything the user would want to remember. Do not save trivial conversational filler.]`;
    // Find the last user message and append the instruction
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        msgs[i].content += autoVaultNote;
        break;
      }
    }
  }

  return msgs;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

async function startStream(message, sendResponse) {
  const settings = await loadSettings();
  if (!settings.apiKey) {
    sendResponse({ error: 'API key not configured' });
    return;
  }

  const { conversationHistory, pageContext, autoVault } = message;
  const messages = buildMessages(conversationHistory, pageContext, settings.systemPrompt, settings.vaultPath, autoVault);

  try {
    const response = await fetch(`${PROXY_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        apiKey: settings.apiKey,
        model: settings.model,
        provider: settings.provider,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      sendResponse({ error: `Proxy error (${response.status}): ${error}` });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let fullText = '';

    const sendChunk = (chunk) => {
      chrome.runtime.sendMessage({ type: 'stream.chunk', content: chunk }).catch(() => {});
    };

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        fullText += chunk;
        sendChunk(chunk);
      }
    }

    chrome.runtime.sendMessage({ type: 'stream.done', content: fullText }).catch(() => {});
    sendResponse({ content: fullText });
  } catch (err) {
    sendResponse({ error: `Connection failed: ${err.message}` });
  }
}

// ─── Tabs & History ───────────────────────────────────────────────────────────

async function listOpenTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs
    .filter((t) => t.url && t.url.startsWith('http'))
    .map((t) => ({ id: t.id, title: t.title, url: t.url, active: t.active }));
}

async function searchHistory(query) {
  return new Promise((resolve) => {
    chrome.history.search({ text: query, maxResults: 20 }, (items) => {
      resolve(items.map((item) => ({
        url: item.url,
        title: item.title,
        lastVisitTime: item.lastVisitTime,
      })));
    });
  });
}

// ─── Vault ────────────────────────────────────────────────────────────────────

async function handleVaultRead(message) {
  const settings = await chrome.storage.local.get([STORAGE_KEYS.VAULT_PATH]);
  const vaultPath = settings[STORAGE_KEYS.VAULT_PATH];
  if (!vaultPath) return { error: 'Vault path not configured. Set it in Settings.' };
  try {
    const resp = await fetch(`${PROXY_URL}/api/vault/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath, query: message.query || '', limit: message.limit || 20 }),
    });
    const data = await resp.json();
    if (!resp.ok) return { error: data.error };
    return data;
  } catch (err) {
    return { error: `Cannot connect to proxy: ${err.message}` };
  }
}

async function handleVaultWrite(message) {
  const settings = await chrome.storage.local.get([STORAGE_KEYS.VAULT_PATH]);
  const vaultPath = settings[STORAGE_KEYS.VAULT_PATH];
  if (!vaultPath) return { error: 'Vault path not configured. Set it in Settings.' };
  try {
    const resp = await fetch(`${PROXY_URL}/api/vault/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPath, filename: message.filename, content: message.content }),
    });
    const text = await resp.text();
    console.log('[BG] proxy raw response:', text);
    const data = JSON.parse(text);
    console.log('[BG] proxy JSON:', JSON.stringify(data));
    if (!resp.ok) return { error: data.error };
    return data;
  } catch (err) {
    console.error('[BG] vault.write error:', err);
    return { error: `Cannot connect to proxy: ${err.message}` };
  }
}

// ─── Auto Vault ───────────────────────────────────────────────────────────────

async function loadAutoVault() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.AUTO_VAULT]);
  return { autoVault: result[STORAGE_KEYS.AUTO_VAULT] || false };
}

async function saveAutoVault(enabled) {
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_VAULT]: !!enabled });
  return { ok: true };
}

// ─── Context Menus ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'openSidePanel',
      title: 'Open OpenAgent',
      contexts: ['all'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'openSidePanel') {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  }
});

// ─── Proxy Auto-Start ──────────────────────────────────────────────────────────

async function startProxyServer() {
  try {
    // Check if already running
    const resp = await fetch(`${PROXY_URL}/health`);
    if (resp.ok) return { ok: true, already: true };
  } catch {}

  // Proxy is not running — try to start via offscreen document
  try {
    // Use offscreen API to create a document that can run JS
    const hasOffscreen = await chrome.offscreen.hasDocument();
    if (!hasOffscreen) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Proxy auto-start for OpenAgent Chrome Extension',
      });
    }

    // Send a message to the offscreen document to start the proxy
    // Since offscreen can't run shell commands either, we use a different approach:
    // Try to detect the extension path and open Terminal
    chrome.runtime.sendMessage('offscreen', { type: 'start-proxy' }, () => {
      // Even if this fails, we've tried
    });
  } catch (err) {
    console.log('[OpenAgent] offscreen start failed:', err.message);
  }

  // Best effort: return instructions
  return {
    ok: false,
    message: 'Could not auto-start proxy. Please run: cd ~/Downloads/openagent/proxy && node server.js',
  };
}

async function checkAndStartProxy() {
  try {
    const resp = await fetch(`${PROXY_URL}/health`);
    if (resp.ok) return;
  } catch {}

  // Try offscreen approach
  await startProxyServer();
}

// Check proxy on service worker startup
chrome.runtime.onStartup.addListener(() => {
  checkAndStartProxy();
});

// ─── Side Panel ───────────────────────────────────────────────────────────────

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
