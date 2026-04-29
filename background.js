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
  VAULT_HANDLE: 'openagent_vault_handle',
  AUTO_VAULT: 'openagent_auto_vault',
};

// ─── Auto-inject content script on page load ───────────────────────────────────

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
    if (!tab.url || !tab.url.startsWith('http')) return;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    console.log('[OpenAgent] injectIntoTab: failed', tabId, err.message);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getWebTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;

  if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    return tab;
  }

  const webTabs = await chrome.tabs.query({
    url: ['http://*/*', 'https://*/*'],
    windowId: tab.windowId,
  });

  return webTabs.length > 0 ? webTabs[0] : null;
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
  const tab = await getWebTab();
  if (!tab?.id) return { error: 'No active web page tab found' };
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'page.navigate', command: { kind: 'navigate', url } });
  } catch (err) {
    return { error: `Cannot send to page: ${err.message}` };
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
    vaultHandle: result[STORAGE_KEYS.VAULT_HANDLE] || null,
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
  const msgs = buildMessages(conversationHistory, pageContext, settings.systemPrompt, autoVault);

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
        provider: { preset: settings.provider || 'openrouter' },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: await response.text() } }));
      sendResponse({ error: `API error (${response.status}): ${error?.error?.message || response.statusText}` });
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    sendResponse({ content });
  } catch (err) {
    sendResponse({ error: `Request failed: ${err.message}` });
  }
}

function buildMessages(history, pageContext, systemPrompt, autoVault) {
  const msgs = [];

  const systemContent = systemPrompt || null;

  if (systemContent) {
    msgs.push({ role: 'system', content: systemContent });
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

  if (autoVault) {
    const note = `\n\n[NOTE: AUTO-VAULT ENABLED — After responding, proactively identify important information discussed in this conversation and save a concise summary note to the Obsidian vault using <vault_write filename="topic-date.md">...</vault_write>. Focus on key facts, decisions, URLs, code snippets, or anything the user would want to remember.]`;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        msgs[i].content += note;
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
  const msgs = buildMessages(conversationHistory, pageContext, settings.systemPrompt, autoVault);

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