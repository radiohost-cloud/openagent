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
  VAULT_HANDLE: 'openagent_vault_handle',
  AUTO_VAULT: 'openagent_auto_vault',
  FONT_SIZE: 'openagent_font_size',
  WEB_SEARCH: 'openagent_web_search',
};

const HTTPS_RE = /^https?:\/\//;
const injectedTabs = new Set();

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

const DEFAULT_SYSTEM_PROMPT = "You are OpenAgent, an AI browser assistant. Your primary purpose is to help users with the currently open webpage. When a user asks a question, use the page context provided. You can read page content, execute browser actions, and help with web-related tasks. If no page context is provided, explain that you work best when viewing a webpage. NEVER offer to save information, NEVER ask if something should be saved, and NEVER list \"save options\" at the end of responses. The conversation is saved automatically when Obsidian is connected. Focus entirely on answering the user's question.";

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!injectedTabs.has(activeInfo.tabId)) {
    await injectIntoTab(activeInfo.tabId);
  }
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
    if (!details.frameId && !injectedTabs.has(details.tabId)) {
      await injectIntoTab(details.tabId);
      await notifyContextRefresh(details.tabId, details.url);
    }
  }, { url: [{ schemes: ['http', 'https'] }] });

  // SPA URL changes are detected by the content script via history API interception.
  // It sends context.refresh on its own. No need for duplicate listeners here.
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
    if (!tab.url || !tab.url.startsWith('http')) return;
    // Don't inject into Chrome internal pages (webstore, settings, etc.)
    if (tab.url.includes('chrome://') || tab.url.includes('chrome.google.com/webstore')) return;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    if (err.message && !err.message.includes('Cannot access contents') && !err.message.includes('gallery')) {
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
    'context.refresh': () => ({ ok: true }),
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
    webSearch: result[STORAGE_KEYS.WEB_SEARCH] || false,
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
    [STORAGE_KEYS.WEB_SEARCH]: data.webSearch || false,
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

  const { conversationHistory, pageContext, pageScreenshot, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, webSearch } = message;
  const msgs = await buildMessages(conversationHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext);

  const tools = webSearch ? [
    {
      type: 'openrouter:web_search',
      parameters: {
        max_results: 5,
        max_total_results: 15,
        search_context_size: 'medium',
      },
    },
  ] : [];

  try {
    // First API call
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
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: webSearch ? 'auto' : undefined,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      const errJson = (() => { try { return JSON.parse(text); } catch { return null; } })();
      sendResponse({ error: `API error (${response.status}): ${errJson?.error?.message || text}` });
      return;
    }

    let data = await response.json();
    let message = data.choices?.[0]?.message;

    // Handle tool calls — OpenRouter server tools (e.g. web_search) execute server-side
    let maxIterations = 10;
    while (message?.tool_calls && message.tool_calls.length > 0 && maxIterations > 0) {
      maxIterations--;

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function?.name || toolCall.name || '';
        const toolType = toolCall.type || '';

        // For openrouter:web_search (server tool), acknowledge and let model process results
        if (toolType === 'openrouter:web_search' || toolName === 'openrouter:web_search') {
          const args = (() => { try { return JSON.parse(toolCall.function?.arguments || '{}'); } catch { return {}; } })();
          msgs.push(message);
          msgs.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Search executed for query: "${args.query || 'unknown'}". Results returned via OpenRouter server tool.`,
          });
        }
      }

      // Follow-up call with tool results
      const followUp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
          tools: tools.length > 0 ? tools : undefined,
        }),
      });

      if (!followUp.ok) {
        const text = await followUp.text();
        const errJson = (() => { try { return JSON.parse(text); } catch { return null; } })();
        sendResponse({ error: `API error (${followUp.status}): ${errJson?.error?.message || text}` });
        return;
      }

      data = await followUp.json();
      message = data.choices?.[0]?.message;
    }

    const content = message?.content || '';
    sendResponse({ content });
  } catch (err) {
    sendResponse({ error: `Request failed: ${err.message}` });
  }
}

async function buildMessages(history, pageContext, pageScreenshot, systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, webSearch) {
  const msgs = [];

  const systemContent = systemPrompt || DEFAULT_SYSTEM_PROMPT;

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
${autoVault ? '- Auto-save is ON — conversation is saved automatically after each response.' : '- Auto-save is OFF.'}

## Writing to Vault
Use <vault_write>content</vault_write> only for information that the user specifically asks you to save. The session file grows automatically — do NOT offer to save, do NOT ask "should I save this?", and do NOT list save options at the end of responses.

## Reading from Vault
Use <vault_read query="search terms" /> only when the user explicitly asks you to look something up.

## Rules
- Never say "I can save this to your vault" or similar offer phrases
- Never end responses with "Would you like me to save this?" or bullet points about saving
- The conversation is auto-saved — focus on answering the user's question
${autoVault ? '' : '- When auto-save is off, only write to vault if the user asks you to'}

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
    let resp = await fetch(`${url}/search/simple?query=${encodeURIComponent(query)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      return { error: `API error: ${resp.status}`, notes: [] };
    }

    const data = await resp.json();
    const files = Array.isArray(data) ? data : [];
    const notes = [];

    for (const item of files) {
      if (notes.length >= (limit || 20)) break;
      const filename = item.filename || '';
      if (!filename || !filename.endsWith('.md')) continue;
      const displayFilename = vaultPrefix && filename.startsWith(vaultPrefix + '/')
        ? filename.slice(vaultPrefix.length + 1)
        : filename;

      try {
        const fileResp = await fetch(url + '/vault/' + encodeURIComponent(filename), {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (fileResp.ok) {
          const fileContent = await fileResp.text();
          notes.push({ filename, displayFilename, content: fileContent || '' });
        }
      } catch {}
    }
    return { notes };
  } catch (err) {
    return { error: 'API error: ' + err.message, notes: [] };
  }
}

async function vaultApiWrite(message) {
  const { filename, content, append, sourceUrl, model, provider } = message;
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

    let frontmatter = '';
    const needsFrontmatter = (!append || !existing) && sourceUrl && !existing?.startsWith('---');
    const appending = append && existing;

    // Extract existing frontmatter fields
    let existingUrl = '';
    let existingUrls = [];
    let existingBody = existing || '';
    if (existing?.startsWith('---')) {
      const endMatch = existing.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (endMatch) {
        existingBody = endMatch[2];
        const fmLines = endMatch[1].split('\n');
        for (const line of fmLines) {
          const urlMatch = line.match(/^url:\s*(.+)/);
          if (urlMatch) existingUrl = urlMatch[1].trim();
          const urlsMatch = line.match(/^urls:\s*$/);
          if (urlsMatch) {
            const idx = fmLines.indexOf(line);
            for (let i = idx + 1; i < fmLines.length; i++) {
              if (fmLines[i].match(/^\s+-/)) {
                existingUrls.push(fmLines[i].replace(/^\s+-\s*/, '').trim());
              } else break;
            }
          }
        }
      }
    }

    const domain = (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const newUrl = domain || existingUrl;
    const urlsList = appending && sourceUrl ? [...new Set([...existingUrls, sourceUrl])] : (sourceUrl ? [sourceUrl] : existingUrls);

    if (needsFrontmatter || appending) {
      const date = new Date().toISOString().split('T')[0];
      const modelTag = model ? model.split('/').pop().replace(/-(?:2024|2025)[0-9]*/g, '') : '';
      const tags = ['#openagent', `#${provider || 'openrouter'}`, modelTag ? `#${modelTag}` : ''].filter(Boolean).join(' ');
      const urlsYaml = urlsList.length > 0 ? '\nurls:\n' + urlsList.map(u => `  - ${u}`).join('\n') + '\n' : '';
      frontmatter = `---\nurl: ${newUrl}\nmodel: ${model || 'unknown'}\nprovider: ${provider || 'openrouter'}\ndate: ${date}${urlsYaml}${tags ? `\ntags: ${tags}` : ''}\n---\n\n`;
    }

    const writeContent = appending ? (frontmatter + existingBody + '\n\n---\n\n' + content) : (frontmatter + content);
    const writeResp = await fetch(url + '/vault/' + encodeURIComponent(fullPath), {
      method: 'PUT',
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