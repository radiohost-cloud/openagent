// background.js - Chrome Extension Service Worker
// Direct OpenRouter API calls + File System Access API for vault

const STORAGE_KEYS = {
  API_KEY: 'claude_api_key',
  MODEL: 'claude_model',
  PROVIDER: 'claude_provider',
  SYSTEM_PROMPT: 'claude_system_prompt',
  THEME: 'claude_theme',
  PRESET: 'claude_preset',
  LANGUAGE: 'claude_language',
  VAULT_NAME: 'openagent_vault_name',
  VAULT_API_URL: 'openagent_vault_api_url',
  VAULT_API_TOKEN: 'openagent_vault_api_token',
  AUTO_VAULT: 'openagent_auto_vault',
  FONT_SIZE: 'openagent_font_size',
};

// ─── Auto-inject content script on page load ───────────────────────────────────

const injectedTabs = new Set();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await injectIntoTab(activeInfo.tabId);
  const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
  await notifyContextRefresh(activeInfo.tabId, tab?.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url?.startsWith('http')) {
    await notifyContextRefresh(tabId, tab.url);
  }
});

if (chrome.webNavigation && chrome.webNavigation.onCompleted) {
  chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (!details.frameId) {
      await injectIntoTab(details.tabId);
      await notifyContextRefresh(details.tabId, details.url);
    }
  }, { url: [{ schemes: ['http', 'https'] }] });

  // CRITICAL: on SPA navigation, re-inject content script to get fresh page data
  // This is the key fix for YouTube — the old content script instance is stuck
  // on the previous video, so we force a reload
  chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (!details.frameId) {
      // Remove from injected set so next collectPageContext will re-inject
      injectedTabs.delete(details.tabId);
      await injectIntoTab(details.tabId);
      await notifyContextRefresh(details.tabId, details.url);
    }
  });

  chrome.webNavigation.onReferenceFragmentUpdated.addListener(async (details) => {
    if (!details.frameId) {
      await notifyContextRefresh(details.tabId, details.url);
    }
  });
}

async function notifyContextRefresh(tabId, newUrl) {
  if (!newUrl || !newUrl.startsWith('http')) return;
  chrome.runtime.sendMessage({ type: 'context.refresh' }).catch(() => {});
}

chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, async (tabs) => {
  for (const tab of tabs) {
    if (!injectedTabs.has(tab.id)) {
      await injectIntoTab(tab.id);
    }
  }
});

async function injectIntoTab(tabId) {
  if (!tabId) return;
  if (injectedTabs.has(tabId)) return; // already injected, skip
  injectedTabs.add(tabId);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith('http') || tab.url.startsWith('chrome')) return;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    if (err.message && !err.message.includes('Cannot access contents')) {
      console.warn('[OpenAgent] injectIntoTab: failed', tabId, err.message);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getWebTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url?.startsWith('http') ? tab : null;
}

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    'settings.load': () => loadSettings(),
    'settings.save': () => saveSettings(message.data),
    'inject.content': () => injectContentScript(),
    'page.collect': () => sendToContentScript('page.collect'),
    'page.dom.snapshot': () => sendToContentScript('page.dom.snapshot'),
    'page.dom.perform': () => sendToContentScript('page.dom.perform', { steps: message.steps }),
    'page.navigate': () => sendNavigateAction(message.url),
    'prompt.send': () => handlePromptSend(message, sendResponse),
    'conversation.clear': () => ({ ok: true }),
    'context.tabs.list': () => listOpenTabs(),
    'context.history.search': () => searchHistory(message.query),
    'stream.start': () => startStream(message, sendResponse),
    'vault.read': () => handleVaultRead(message),
    'vault.write': () => handleVaultWrite(message),
    'vault.pick': () => pickVaultDirectory(),
    'autovault.load': () => loadAutoVault(),
    'autovault.save': () => saveAutoVault(message.enabled),
    'page.screenshot': () => capturePageScreenshot(),
    'memory.load': () => handleMemoryLoad(message),
    'memory.save': () => handleMemorySave(message),
    'vault.api.test': () => vaultApiTest(message),
    'vault.api.read': () => vaultApiRead(message),
    'vault.api.write': () => vaultApiWrite(message),
    'context.refresh': () => { chrome.runtime.sendMessage({ type: 'context.refresh' }).catch(() => {}); return { ok: true }; },
  };

  const handler = handlers[message.type];
  if (!handler) return false;

  const result = handler();
  if (result instanceof Promise) {
    result.then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (result !== undefined) sendResponse(result);
  return true;
});

// ─── Content Script Communication ──────────────────────────────────────────────

async function injectContentScript() {
  const tab = await getWebTab();
  if (!tab?.id) return { error: 'No active web page tab found' };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return { ok: true, tabId: tab.id };
  } catch (err) {
    return { ok: true, tabId: tab.id };
  }
}

async function sendToContentScript(type, payload) {
  const tab = await getWebTab();
  if (!tab?.id) return { error: 'No active web page tab found' };

  try {
    return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
  } catch (err) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (e) {}
    try {
      return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
    } catch (e) {
      return { error: 'Cannot communicate with page. Try reloading the page.' };
    }
  }
}

async function sendNavigateAction(url) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { error: 'No active tab found' };
  try {
    await chrome.tabs.update(tab.id, { url });
    return { ok: true, message: `Navigated to ${url}` };
  } catch (err) {
    return { error: `Cannot navigate: ${err.message}` };
  }
}

// ─── Screenshot ────────────────────────────────────────────────────────────────

async function capturePageScreenshot() {
  const tab = await getWebTab();
  if (!tab?.id) return { error: 'No active web page tab found' };
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 });
    return { ok: true, dataUrl };
  } catch (err) {
    return { error: `Screenshot failed: ${err.message}` };
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function loadSettings() {
  const result = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  return {
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    model: result[STORAGE_KEYS.MODEL] || '',
    provider: result[STORAGE_KEYS.PROVIDER] || 'openrouter',
    systemPrompt: result[STORAGE_KEYS.SYSTEM_PROMPT] || '',
    theme: result[STORAGE_KEYS.THEME] || 'dark',
    preset: result[STORAGE_KEYS.PRESET] || 'default',
    language: result[STORAGE_KEYS.LANGUAGE] || 'en',
    vaultName: result[STORAGE_KEYS.VAULT_NAME] || '',
    vaultApiUrl: result[STORAGE_KEYS.VAULT_API_URL] || '',
    vaultApiToken: result[STORAGE_KEYS.VAULT_API_TOKEN] || '',
    autoVault: result[STORAGE_KEYS.AUTO_VAULT] || false,
    fontSize: result[STORAGE_KEYS.FONT_SIZE] || 'medium',
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
    [STORAGE_KEYS.VAULT_NAME]: data.vaultName || '',
    [STORAGE_KEYS.VAULT_API_URL]: data.vaultApiUrl || '',
    [STORAGE_KEYS.VAULT_API_TOKEN]: data.vaultApiToken || '',
    [STORAGE_KEYS.FONT_SIZE]: data.fontSize || 'medium',
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

  const { conversationHistory, pageContext, pageScreenshot, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext } = message;
  const msgs = await buildMessages(conversationHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL('/'),
        'X-Title': 'OpenAgent Chrome Extension',
      },
      body: JSON.stringify({
        model: settings.model || 'openai/gpt-4o',
        messages: msgs,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      const errJson = (() => { try { return JSON.parse(text); } catch { return null; } })();
      sendResponse({ error: `API error (${response.status}): ${errJson?.error?.message || text}` });
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    sendResponse({ content });
  } catch (err) {
    sendResponse({ error: `Request failed: ${err.message}` });
  }
}

async function buildMessages(history, pageContext, pageScreenshot, systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext) {
  const msgs = [];

  // Default system prompt if none set
  const defaultSystem = 'You are OpenAgent, an AI browser assistant. Your primary purpose is to help users with the currently open webpage. When a user asks a question, you should use the page context provided to give relevant answers. You can read page content, execute browser actions, and help with web-related tasks. If no page context is provided, explain that you work best when viewing a webpage.';
  const systemContent = systemPrompt || defaultSystem;

  if (systemContent) {
    msgs.push({ role: 'system', content: systemContent });
  }

  // Obsidian vault capabilities — always available when connected
  if (vaultConnected) {
    const vaultDisplayName = vaultName ? vaultName.split('/').filter(Boolean).pop() : 'Obsidian';
    const sessionFile = vaultFilename || '(not set)';
    msgs.push({
      role: 'system',
      content: `[OBSIDIAN VAULT: connected]
- Vault path: ${vaultName || 'root'}
- Session file: ${sessionFile}

## Your Vault Capabilities
You have access to the user's Obsidian vault. Use these tools proactively throughout the conversation:

READ notes: <vault_read query="search terms" />
  Searches vault for .md files matching the query and returns their contents.
  Use this to recall previous notes, context, or referenced materials.
  Example: <vault_read query="project notes" />

WRITE to session file: <vault_write>content</vault_write>
  Appends content to the ongoing session file (${sessionFile}).
  Use for notes, reminders, links, key facts, or anything worth saving.
  The file grows across the conversation — use it as a running log.

WRITE to new note: <vault_write filename="topic-name.md">content</vault_write>
  Creates a separate .md note for structured, topic-specific content.
  Example: <vault_write filename="meeting-notes.md">...</vault_write>

## Auto-save
${autoVault ? 'Auto-save is ON — after each response, the full conversation will be appended to the session file automatically.' : 'Auto-save is OFF — save important content manually using the tools above.'}

[END VAULT INFO]`,
    });
  }
  if (memoryContext) {
    const mem = await getMemoryModule();
    const memText = mem.buildMemoryContext(memoryContext.summaries || [], memoryContext.memories || []);
    if (memText) {
      msgs.push({
        role: 'system',
        content: `You have context from previous conversations with this user:\n\n${memText}\n\nUse this context to provide more personalized and continuity-aware responses.`,
      });
    }
  }
  if (pageContext) {
    const url = pageContext.metadata?.url || pageContext.url || '';
    const title = pageContext.metadata?.title || pageContext.title || '';
    const bodyText = pageContext.bodyText || '';
    const selectedText = pageContext.selectedText || '';
    msgs.push({
      role: 'user',
      content: `Current page context:\nURL: ${url}\nTitle: ${title}\n\nContent:\n${bodyText}${selectedText ? `\n\nSelected text: ${selectedText}` : ''}`,
    });
  }
  if (pageScreenshot) {
    msgs.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Current page screenshot:' },
        { type: 'image_url', image_url: { url: pageScreenshot } },
      ],
    });
  }
  for (const msg of history) {
    msgs.push({ role: msg.role, content: msg.content });
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

  const { conversationHistory, pageContext, pageScreenshot, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext } = message;
  const msgs = await buildMessages(conversationHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL('/'),
        'X-Title': 'OpenAgent Chrome Extension',
      },
      body: JSON.stringify({
        model: settings.model || 'openai/gpt-4o',
        messages: msgs,
        stream: true,
        provider: { preset: settings.provider || 'openrouter' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      sendResponse({ error: `API error (${response.status}): ${error}` });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let fullText = '';

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        fullText += chunk;
        chrome.runtime.sendMessage({ type: 'stream.chunk', content: chunk }).catch(() => {});
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

// ─── Vault (File System Access API) ──────────────────────────────────────────

async function pickVaultDirectory() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await chrome.storage.local.set({ [STORAGE_KEYS.VAULT_HANDLE]: 'granted' });
    return { ok: true, path: dirHandle.name };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, cancelled: true };
    return { error: err.message };
  }
}

// File System Access API — vault operations in the side panel context
// The side panel uses chrome.storage to persist a "vault ready" flag
// and communicates via the message protocol for vault operations

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

// ─── Side Panel ───────────────────────────────────────────────────────────────

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Open side panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (err) {
    console.error('[OpenAgent] sidePanel.open error:', err.message);
    // Fallback: open side panel URL in current tab
    chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('sidepanel.html') });
  }
});

let dbModule = null;
let memoryModule = null;

async function getDbModule() {
  if (!dbModule) dbModule = await import('./db.js');
  return dbModule;
}

async function getMemoryModule() {
  if (!memoryModule) memoryModule = await import('./memory.js');
  return memoryModule;
}

async function handleMemoryLoad(message) {
  const { domain, topics } = message;
  const db = await getDbModule();
  const resolvedDomain = domain || db.extractDomain(message.pageUrl || '');

  try {
    const context = await db.getRelevantContext(resolvedDomain, topics || [], 3);
    return context;
  } catch (err) {
    return { summaries: [], memories: [] };
  }
}

async function handleMemorySave(message) {
  const { conversationId, pageUrl, summary, topics, memEntries, conversation } = message;
  const db = await getDbModule();

  const domain = db.extractDomain(pageUrl || '');
  const timestamp = Date.now();

  try {
    // Save full conversation
    if (conversation) {
      await db.saveConversation({
        id: conversationId || timestamp,
        domain,
        pageUrl,
        timestamp,
        messages: conversation,
      });
    }

    // Save summary
    if (summary) {
      await db.saveSummary({
        id: conversationId || timestamp,
        domain,
        pageUrl,
        summary,
        topics: topics || [],
        timestamp,
      });
    }

    // Save memory entries
    if (memEntries && memEntries.length > 0) {
      const memsWithDomain = memEntries.map((m) => ({ ...m, domain }));
      await db.saveMemories(memsWithDomain);
    }

    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Vault REST API (via service worker for CORS) ───────────────────────────────

async function vaultApiFetch(path, options = {}) {
  const settings = await loadSettings();
  const url = (settings.vaultApiUrl || '').replace(/\/$/, '');
  const token = settings.vaultApiToken || '';
  if (!url || !token) return { error: 'Vault API not configured' };
  try {
    const resp = await fetch(url + path, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return { ok: true, status: resp.status, json: resp.json ? await resp.json().catch(() => ({})) : {}, text: resp.text ? await resp.text().catch(() => '') : '' };
  } catch (err) {
    return { error: err.message };
  }
}

async function vaultApiTest(message) {
  const url = (message.url || '').replace(/\/$/, '');
  const token = message.token || '';
  if (!url || !token) return { error: 'URL or token missing' };

  const endpoints = ['/vault', '/'];
  for (const ep of endpoints) {
    try {
      const resp = await fetch(url + ep, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) return { ok: true, endpoint: ep };
    } catch (err) {
      // try next endpoint
    }
  }
  try {
    const resp = await fetch(url + '/vault', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return { error: `HTTP ${resp.status} — endpoint /vault not found. Check Local REST API plugin is running and the vault is open.` };
  } catch (err) {
    return { error: err.message };
  }
}

async function vaultApiRead(message) {
  const { query, limit } = message;
  const settings = await loadSettings();
  const url = (settings.vaultApiUrl || '').replace(/\/$/, '');
  const token = settings.vaultApiToken || '';
  const vaultName = settings.vaultName || '';
  if (!url || !token) return { error: 'Vault API not configured', notes: [] };

  const vaultPrefix = vaultName.startsWith('/') ? vaultName.slice(1) : vaultName;
  const vaultPath = vaultPrefix ? `/${vaultPrefix}` : '';

  try {
    const searchUrl = query
      ? `${url}/search?q=${encodeURIComponent(query)}&type=file&ext=md&limit=${limit || 20}`
      : `${url}/vault${vaultPath}?limit=${limit || 20}`;

    const resp = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!resp.ok) return { error: `API error: ${resp.status}`, notes: [] };

    const data = await resp.json();
    const files = data.files || data || [];
    const notes = [];

    for (const item of files) {
      if (notes.length >= (limit || 20)) break;
      const path = item.path || item;
      const filename = path.split('/').pop() || path;
      if (!filename.endsWith('.md')) continue;

      try {
        const fileResp = await fetch(url + '/vault/' + encodeURIComponent(path), {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (fileResp.ok) {
          const fileContent = await fileResp.text();
          notes.push({ filename, content: fileContent || '' });
        }
      } catch {}
    }
    return { notes };
  } catch (err) {
    return { error: 'API error: ' + err.message, notes: [] };
  }
}

async function vaultApiWrite(message) {
  const { filename, content, append } = message;
  const settings = await loadSettings();
  const url = (settings.vaultApiUrl || '').replace(/\/$/, '');
  const token = settings.vaultApiToken || '';
  const vaultName = settings.vaultName || '';
  if (!url || !token) return { error: 'Vault API not configured' };

  const vaultPrefix = vaultName.startsWith('/') ? vaultName.slice(1) : vaultName;
  const fullPath = vaultPrefix ? `${vaultPrefix}/${filename}` : filename;

  try {
    const readResp = await fetch(url + '/vault/' + encodeURIComponent(fullPath), {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    let existing = '';
    if (readResp.ok) {
      existing = await readResp.text();
    }

    const writeContent = existing && append ? (existing + '\n\n---\n\n' + content) : content;
    const method = existing ? 'PUT' : 'PUT';
    const writeResp = await fetch(url + '/vault/' + encodeURIComponent(fullPath), {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: writeContent,
    });
    if (!writeResp.ok) {
      const err = await writeResp.text();
      console.error('[BG] vault write error:', writeResp.status, fullPath, err);
      return { error: 'Write failed: ' + err };
    }
    return { ok: true, path: filename };
  } catch (err) {
    console.error('[BG] vault api error:', err);
    return { error: 'API error: ' + err.message };
  }
}