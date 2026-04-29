// background.js - Chrome Extension Service Worker
// Bridges side panel UI, content scripts, and the local proxy server

const PROXY_URL = 'http://localhost:8787';
const STORAGE_KEYS = {
  API_KEY: 'claude_api_key',
  MODEL: 'claude_model',
  PROVIDER: 'claude_provider',
  SYSTEM_PROMPT: 'claude_system_prompt',
  THEME: 'claude_theme',
  PRESET: 'claude_preset',
  LANGUAGE: 'claude_language',
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
  ]);
  return {
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    model: result[STORAGE_KEYS.MODEL] || '',
    provider: result[STORAGE_KEYS.PROVIDER] || 'openrouter',
    systemPrompt: result[STORAGE_KEYS.SYSTEM_PROMPT] || '',
    theme: result[STORAGE_KEYS.THEME] || 'dark',
    preset: result[STORAGE_KEYS.PRESET] || 'default',
    language: result[STORAGE_KEYS.LANGUAGE] || 'en',
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

  const { conversationHistory, pageContext } = message;
  const messages = buildMessages(conversationHistory, pageContext, settings.systemPrompt);

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

function buildMessages(history, pageContext, systemPrompt) {
  const msgs = [];

  if (systemPrompt) {
    msgs.push({ role: 'system', content: systemPrompt });
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
  return msgs;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

async function startStream(message, sendResponse) {
  const settings = await loadSettings();
  if (!settings.apiKey) {
    sendResponse({ error: 'API key not configured' });
    return;
  }

  const { conversationHistory, pageContext } = message;
  const messages = buildMessages(conversationHistory, pageContext, settings.systemPrompt);

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
