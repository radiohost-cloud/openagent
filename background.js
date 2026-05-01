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
  VAULT_PATH: 'openagent_vault_path',
  VAULT_HANDLE: 'openagent_vault_handle',
  AUTO_VAULT: 'openagent_auto_vault',
  FONT_SIZE: 'openagent_font_size',
};

// ─── Auto-inject content script on page load ───────────────────────────────────

const injectedTabs = new Set();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await injectIntoTab(activeInfo.tabId);
  await notifyContextRefresh(activeInfo.tabId);
});

// Also listen for tab updates (catches same-tab navigations)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url?.startsWith('http')) {
    await notifyContextRefresh(tabId);
  }
});

if (chrome.webNavigation && chrome.webNavigation.onCompleted) {
  chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (!details.frameId) {
      await injectIntoTab(details.tabId);
      await notifyContextRefresh(details.tabId);
    }
  }, { url: [{ schemes: ['http', 'https'] }] });

  chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (!details.frameId) {
      await notifyContextRefresh(details.tabId);
    }
  });

  chrome.webNavigation.onReferenceFragmentUpdated.addListener(async (details) => {
    if (!details.frameId) {
      await notifyContextRefresh(details.tabId);
    }
  });
}

async function notifyContextRefresh(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  if (!tab?.url || !tab.url.startsWith('http')) return;

  try {
    const data = await chrome.tabs.sendMessage(tabId, { type: 'page.collect' });
    if (data?.rawCapture?.metadata) {
      await chrome.storage.local.set({
        openagent_current_tab: {
          url: tab.url,
          title: tab.title,
          favicon: data.rawCapture.metadata.favicon || `chrome://favicon/${tab.url}`,
          bodyText: data.rawCapture.bodyText,
          images: data.rawCapture.images,
          timestamp: Date.now(),
        },
      });
    }
  } catch (err) {
    await chrome.storage.local.set({
      openagent_current_tab: {
        url: tab.url,
        title: tab.title,
        favicon: `chrome://favicon/${tab.url}`,
        timestamp: Date.now(),
      },
    });
  }
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
  if (!tabId || injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith('http') || tab.url.startsWith('chrome')) return;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    // chrome:// pages, extensions, etc. don't grant host permissions
    if (err.message && !err.message.includes('Cannot access contents')) {
      console.warn('[OpenAgent] injectIntoTab: failed', tabId, err.message);
    }
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
    'page.screenshot': () => capturePageScreenshot(),
    'memory.load': () => handleMemoryLoad(message),
    'memory.save': () => handleMemorySave(message),
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
    vaultPath: result[STORAGE_KEYS.VAULT_PATH] || '',
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
    [STORAGE_KEYS.VAULT_PATH]: data.vaultPath || '',
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

  const { conversationHistory, pageContext, pageScreenshot, autoVault, memoryContext } = message;
  const msgs = await buildMessages(conversationHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, memoryContext);

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

async function buildMessages(history, pageContext, pageScreenshot, systemPrompt, autoVault, memoryContext) {
  const msgs = [];

  // Default system prompt if none set
  const defaultSystem = 'You are OpenAgent, an AI browser assistant. Your primary purpose is to help users with the currently open webpage. When a user asks a question, you should use the page context provided to give relevant answers. You can read page content, execute browser actions, and help with web-related tasks. If no page context is provided, explain that you work best when viewing a webpage.';
  const systemContent = systemPrompt || defaultSystem;

  if (systemContent) {
    msgs.push({ role: 'system', content: systemContent });
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

  const { conversationHistory, pageContext, pageScreenshot, autoVault, memoryContext } = message;
  const msgs = await buildMessages(conversationHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, memoryContext);

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