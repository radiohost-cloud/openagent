// background.js - Chrome Extension Service Worker
// Direct OpenRouter API calls + File System Access API for vault
// CDP integration for accessibility tree enrichment

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

// ─── CDP Service (inline) ───────────────────────────────────────────────────────

const _cdpAttachedTabs = new Map();
const _cachedAxTree = new Map();

function _cdpSend(tabId, method, params) {
  return new Promise((resolve) => {
    try {
      chrome.debugger.sendCommand({ tabId }, method, params || {}, (result) => {
        resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : { result });
      });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
}

async function cdpAttach(tabId) {
  if (_cdpAttachedTabs.get(tabId)) return { ok: true };
  try {
    await new Promise((res, rej) => {
      chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) rej(new Error(chrome.runtime.lastError.message)); else res();
      });
    });
    _cdpAttachedTabs.set(tabId, true);
    _cachedAxTree.delete(tabId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function cdpDetach(tabId) {
  if (!_cdpAttachedTabs.get(tabId)) return;
  try {
    chrome.debugger.detach({ tabId }, () => {});
  } catch {}
  _cdpAttachedTabs.set(tabId, false);
  _cachedAxTree.delete(tabId);
}

async function cdpGetAxTree(tabId) {
  if (_cachedAxTree.has(tabId)) return _cachedAxTree.get(tabId);
  const { result } = await _cdpSend(tabId, 'Accessibility.getFullAXTree');
  const nodes = result?.nodes || [];
  _cachedAxTree.set(tabId, nodes);
  return nodes;
}

async function cdpGetDomSnapshot(tabId) {
  const { result } = await _cdpSend(tabId, 'DOMSnapshot.captureSnapshot', {
    computeDEXT: true,
    includeDOMRects: true,
    includePaintOrder: true,
  });
  return result || null;
}

function _parseAxProps(axNode) {
  if (!axNode) return null;
  const p = {};
  if (axNode.role?.value) p.role = axNode.role.value;
  if (axNode.name?.value) p.name = axNode.name.value;
  if (axNode.properties) {
    for (const prop of axNode.properties) {
      const v = prop.value?.value ?? prop.value ?? null;
      if (v === null) continue;
      switch (prop.name) {
        case 'focusable': p.focusable = v; break;
        case 'focused': p.focused = v; break;
        case 'checked': p.checked = v; break;
        case 'expanded': p.expanded = v; break;
        case 'pressed': p.pressed = v; break;
        case 'disabled': p.disabled = v; break;
        case 'readonly': p.readonly = v; break;
        case 'selected': p.selected = v; break;
        case 'valuemin': p.valueMin = v; break;
        case 'valuemax': p.valueMax = v; break;
        case 'valuenow': p.valueNow = v; break;
        case 'valuetext': p.valueText = v; break;
        case 'autocomplete': p.autocomplete = v; break;
        case 'haspopup': p.hasPopup = v; break;
        case 'level': p.level = v; break;
        case 'setsize': p.setSize = v; break;
        case 'posinset': p.posInSet = v; break;
        case 'invalid': p.invalid = v; break;
      }
    }
  }
  if (axNode.state) {
    for (const s of axNode.state) {
      if (s === 'disabled') p.disabled = true;
      if (s === 'hidden') p.hidden = true;
      if (s === 'invisible') p.invisible = true;
      if (s === 'focused') p.focused = true;
      if (s === 'checked') p.checked = true;
      if (s === 'expanded') p.expanded = true;
      if (s === 'pressed') p.pressed = true;
      if (s === 'selected') p.selected = true;
    }
  }
  return p;
}

function _findAxNode(axNodes, role, name, text) {
  if (!axNodes?.length) return null;
  const rL = (role || '').toLowerCase();
  const nL = (name || '').toLowerCase();
  const tL = (text || '').toLowerCase();
  let best = null, bestScore = 0;
  for (const n of axNodes) {
    const nrL = (n.role?.value || '').toLowerCase();
    const nnL = (n.name?.value || '').toLowerCase();
    if (rL && nrL !== rL) continue;
    let score = 0;
    if (rL && nrL === rL) score += 10;
    if (nL && nnL.includes(nL)) score += 5;
    if (nL && nnL === nL) score += 3;
    if (tL && nnL.includes(tL)) score += 2;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return bestScore >= 2 ? best : null;
}

async function cdpEnrichElements(tabId, elements) {
  if (!_cdpAttachedTabs.get(tabId)) {
    const r = await cdpAttach(tabId);
    if (!r.ok) return { elements, enriched: false, reason: r.error };
  }

  const axNodes = await cdpGetAxTree(tabId);
  if (!axNodes?.length) return { elements, enriched: false, reason: 'empty AX tree' };

  const snap = await cdpGetDomSnapshot(tabId);
  const domRects = new Map();
  if (snap?.domNodes) {
    for (const n of snap.domNodes) {
      if (n.backendNodeId && n.layout?.boundingBox) {
        const b = n.layout.boundingBox;
        domRects.set(n.backendNodeId, { left: b.left, top: b.top, width: b.width, height: b.height });
      }
    }
  }

  const enriched = elements.map(el => {
    const e = { ...el };
    const axNode = _findAxNode(axNodes, el.role, el['aria-label'], el.text);
    if (axNode) {
      const ax = _parseAxProps(axNode);
      if (ax) {
        if (ax.role) e.axRole = ax.role;
        if (ax.name) e.axName = ax.name;
        if (ax.focusable !== undefined) e.axFocusable = ax.focusable;
        if (ax.focused !== undefined) e.axFocused = ax.focused;
        if (ax.checked !== undefined) e.axChecked = ax.checked;
        if (ax.expanded !== undefined) e.axExpanded = ax.expanded;
        if (ax.pressed !== undefined) e.axPressed = ax.pressed;
        if (ax.disabled !== undefined) e.axDisabled = ax.disabled;
        if (ax.readonly !== undefined) e.axReadonly = ax.readonly;
        if (ax.selected !== undefined) e.axSelected = ax.selected;
        if (ax.valueMin !== undefined) e.axValueMin = ax.valueMin;
        if (ax.valueMax !== undefined) e.axValueMax = ax.valueMax;
        if (ax.valueNow !== undefined) e.axValueNow = ax.valueNow;
        if (ax.valueText) e.axValueText = ax.valueText;
        if (ax.autocomplete) e.axAutocomplete = ax.autocomplete;
        if (ax.hasPopup) e.axHasPopup = ax.hasPopup;
        if (ax.level !== undefined) e.axLevel = ax.level;
        if (ax.setSize !== undefined) e.axSetSize = ax.setSize;
        if (ax.posInSet !== undefined) e.axPosInSet = ax.posInSet;
        if (ax.invalid !== undefined) e.axInvalid = ax.invalid;
        if (ax.hidden) e.axHidden = true;
        if (ax.invisible) e.axInvisible = true;
      }
    }
    if (el._backendNodeId && domRects.has(el._backendNodeId)) {
      e._domRect = domRects.get(el._backendNodeId);
    }
    return e;
  });

  return { elements: enriched, enriched: true };
}

// ─── Loop Detection ───────────────────────────────────────────────────────────

const LOOP_WINDOW = 10;
const LOOP_FINGERPRINT_AGE_MS = 30000;
let _actionHistory = [];
let _pageFingerprints = [];

function _hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h;
  }
  return String(h >>> 0);
}

function _computeFingerprint(domTree, pageContext) {
  if (!domTree?.elements) return null;
  const sigs = domTree.elements
    .filter(el => el.highlightIndex != null)
    .slice(0, 20)
    .map(el => `${el.highlightIndex}:${el.tagName}:${(el.text || '').slice(0, 20)}`)
    .join('|');
  return _hashStr(sigs + (pageContext?.metadata?.url || ''));
}

function _computeActionHash(tag) {
  const m = tag.match(/^(\w+:\d*):?/);
  return _hashStr(m ? m[1] : tag);
}

function _checkLoop(tag, domTree, pageContext) {
  const now = Date.now();
  const actHash = _computeActionHash(tag);
  const fp = _computeFingerprint(domTree, pageContext);
  _pageFingerprints = _pageFingerprints.filter(p => now - p.t < LOOP_FINGERPRINT_AGE_MS);
  const recent = _actionHistory.filter(a => now - a.t < LOOP_FINGERPRINT_AGE_MS);
  const sameCount = recent.filter(a => a.h === actHash).length;
  const pageSame = fp && _pageFingerprints.some(p => p.f === fp && p.u === (pageContext?.metadata?.url || ''));
  if ((sameCount >= 3 && pageSame) || sameCount >= 5) {
    return {
      isLoop: true,
      reason: sameCount >= 5
        ? `Same action "${tag}" repeated ${sameCount}x. Consider a different approach.`
        : `Same action "${tag}" repeated ${sameCount}x with no page change. Try scrolling or a different element.`
    };
  }
  _actionHistory.push({ h: actHash, t: now });
  _actionHistory = _actionHistory.slice(-LOOP_WINDOW);
  if (fp) {
    _pageFingerprints.push({ f: fp, u: pageContext?.metadata?.url || '', t: now });
    _pageFingerprints = _pageFingerprints.slice(-LOOP_WINDOW);
  }
  return { isLoop: false };
}

function _resetLoopState() {
  _actionHistory = [];
}

// ─── Message Compaction ───────────────────────────────────────────────────────

const COMPACTION_THRESHOLD = 25;
const COMPACTION_BLOCK = 10;

async function _compactHistory(history, apiKey) {
  if (!history || history.length < COMPACTION_THRESHOLD) return history;
  const sys = history.filter(m => m.role === 'system');
  const conv = history.filter(m => m.role === 'user' || m.role === 'assistant');
  if (conv.length < COMPACTION_THRESHOLD) return history;
  const compact = [...sys];
  const toCompact = conv.slice(0, -COMPACTION_BLOCK);
  const kept = conv.slice(-COMPACTION_BLOCK);
  for (let i = 0; i < toCompact.length; i += COMPACTION_BLOCK) {
    const block = toCompact.slice(i, i + COMPACTION_BLOCK);
    const text = block.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 500) : '[content]'}`).join('\n');
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: `Summarize this in 2-3 sentences. Return ONLY the summary text:\n\n${text}` }],
          max_tokens: 150,
        }),
      });
      const data = await resp.json();
      const summary = data.choices?.[0]?.message?.content?.trim() || '[earlier conversation]';
      compact.push({ role: 'system', content: `[Earlier: ${summary}]` });
    } catch {
      compact.push(...block);
    }
  }
  compact.push(...kept);
  return compact;
}

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
  cdpDetach(tabId);
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
    'page.highlight': () => sendToContentScript('page.highlight', { elements: message.elements }),
    'page.highlight.remove': () => sendToContentScript('page.highlight.remove'),
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
    'cdp.enrich': async () => {
      const tab = await getWebTab();
      if (!tab?.id) return { elements: message.elements, enriched: false, reason: 'no active tab' };
      return await cdpEnrichElements(tab.id, message.elements || []);
    },
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
    return { ok: true };
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
  _resetLoopState();
  const settings = await loadSettings();
  if (!settings.apiKey) {
    sendResponse({ error: 'API key not configured. Please set it in Settings.' });
    return;
  }

  const { conversationHistory, pageContext, pageScreenshot, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, webSearch, vaultIntent, pageLinks, domTree } = message;
  const compactHistory = await _compactHistory(conversationHistory, settings.apiKey);
  const msgs = await buildMessages(compactHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, webSearch, pageLinks, domTree);

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
    const actionResult = await parseAndExecuteAction(content, pageLinks, domTree, pageContext);
    sendResponse({ content, actionResult });
  } catch (err) {
    sendResponse({ error: `Request failed: ${err.message}` });
  }
}

// ─── Action Tag Parser ─────────────────────────────────────────────────────────

const ACTION_TAG_RE = /<action>([^<]+)<\/action>/gi;

function buildSelectors(element) {
  const selectors = [];
  if (element.href) {
    selectors.push(`a[href="${element.href}"]`);
    selectors.push(`a[href*="${element.href.split('/').pop()}"]`);
  }
  if (element.id) {
    selectors.push(`#${element.id}`);
    if (element.tagName) selectors.push(`#${element.id}${element.tagName.toLowerCase()}`);
  }
  if (element['data-testid']) selectors.push(`[data-testid="${element['data-testid']}"]`);
  if (element['data-cy']) selectors.push(`[data-cy="${element['data-cy']}"]`);
  if (element['data-test']) selectors.push(`[data-test="${element['data-test']}"]`);
  if (element.type && element.tagName === 'input') selectors.push(`input[type="${element.type}"]`);
  if (element.name) selectors.push(`[name="${element.name}"]`);
  if (element.placeholder) selectors.push(`[placeholder="${element.placeholder}"]`);
  if (element.role) selectors.push(`[role="${element.role}"]`);
  if (element['aria-label']) selectors.push(`[aria-label="${element['aria-label']}"]`);
  if (element.tagName) {
    const tag = element.tagName.toLowerCase();
    selectors.push(tag);
    if (element.class) {
      const classes = element.class.split(' ').filter(c => c.length > 0).slice(0, 2);
      if (classes.length > 0) {
        selectors.push(`${tag}.${classes.join('.')}`);
        selectors.push(`${tag}[class*="${classes[0]}"]`);
      }
    }
  }
  if (element.xpath) {
    selectors.push(element.xpath);
    const simpleXPath = simplifyXPath(element.xpath);
    if (simpleXPath !== element.xpath) selectors.push(simpleXPath);
  }
  if (element.href && element.text) {
    selectors.push(`a[href="${element.href}"]:contains("${element.text.slice(0, 30)}")`);
  }
  return selectors;
}

function simplifyXPath(xpath) {
  const parts = xpath.split('/').filter(p => p.length > 0);
  if (parts.length <= 3) return xpath;
  const idPart = parts.find(p => p.includes('@id'));
  if (idPart) {
    const idMatch = idPart.match(/@id="([^"]+)"/);
    if (idMatch) return `//*[@id="${idMatch[1]}"]`;
  }
  return '/' + parts.slice(-3).join('/');
}

async function attemptAction(tabId, action, selector, highlightIndex) {
  const actionLabels = { click: 'Click', hover: 'Hover', type: 'Type' };
  const actionLabel = actionLabels[action] || action;
  const safeSend = (tabId, msg) => {
    return chrome.tabs.sendMessage(tabId, msg).catch(e => {
      if (e?.message?.includes('No tab with given id')) return null;
      throw e;
    });
  };
  try {
    await safeSend(tabId, { type: 'page.highlight.setState', highlightIndex, state: 'loading' });
  } catch (e) {}
  try {
    const result = await safeSend(tabId, {
      type: 'page.dom.perform',
      steps: [{ action, selector }],
    });

    try {
      const state = result?.ok ? 'success' : 'error';
      await safeSend(tabId, { type: 'page.highlight.setState', highlightIndex, state });
    } catch (e) {}

    if (result?.ok) {
      return { ok: true, message: `${actionLabel} successful on element ${highlightIndex}` };
    } else {
      return {
        ok: false,
        error: `${actionLabel} failed on element ${highlightIndex}: ${result?.message || 'Unknown error'}. Selector used: ${selector?.slice(0, 100)}`,
        selector,
        elementIndex: highlightIndex
      };
    }
  } catch (e) {
    try {
      await safeSend(tabId, { type: 'page.highlight.setState', highlightIndex, state: 'error' });
    } catch (e) {}
    return {
      ok: false,
      error: `${actionLabel} failed on element ${highlightIndex}: ${e.message}. The page may have changed or the element is no longer available. Try scrolling or refreshing the page context.`,
      selector,
      elementIndex: highlightIndex
    };
  }
}

async function parseAndExecuteAction(content, pageLinks, domTree, pageContext) {
  if (!content) return null;
  const matches = [...content.matchAll(ACTION_TAG_RE)];
  if (matches.length === 0) return null;

  const results = [];
  let currentDomTree = domTree;
  let tabId = null;

  for (const match of matches) {
    const tag = match[1].trim();
    const colonIdx = tag.indexOf(':');
    if (colonIdx === -1) continue;

    const loop = _checkLoop(tag, currentDomTree, pageContext);
    if (loop.isLoop) {
      results.push({ ok: false, loopWarning: loop.reason });
      continue;
    }

    const type = tag.slice(0, colonIdx).toLowerCase();
    const args = tag.slice(colonIdx + 1);

    const result = await executeAction(type, args, pageLinks, currentDomTree, tabId);

if (result) {
      
      const innerResult = result.result;
      let isOk = false;
      let msg = '';
      let err = '';

      if (innerResult && typeof innerResult === 'object') {
        isOk = innerResult.ok === true;
        msg = innerResult.message || innerResult.summary || '';
        err = innerResult.error || '';
      }
      if (!isOk && result.ok === true) {
        isOk = true;
        msg = result.message || result.summary || '';
      }
      if (!isOk) {
        err = result.error || result.message || 'Unknown error';
      }

      const actionMsg = { ok: isOk, message: msg, error: err };
      

      if (result.domTree) currentDomTree = result.domTree;
      if (result.tabId) tabId = result.tabId;
      results.push(actionMsg);
    } else {
      
      results.push(null);
    }
  }

  return results.length > 0 ? results : null;
}

async function executeAction(type, args, pageLinks, domTree, tabId) {
  try {
    if (!tabId) {
      const tab = await getWebTab();
      tabId = tab?.id;
    }
    if (!tabId) return { ok: false, error: 'No active tab' };

    let currentDomTree = domTree;

    switch (type) {
      case 'click': {
        const index = parseInt(args, 10);
        if (isNaN(index) || index < 1) return { ok: false, error: 'Invalid click index' };

        let selector = null;
        let targetElement = null;

        if (currentDomTree?.elements) {
          targetElement = currentDomTree.elements.find(el => el.highlightIndex === index);
          if (targetElement) {
            
            const selectors = buildSelectors(targetElement);
            
            for (const sel of selectors) {
              
              const result = await attemptAction(tabId, 'click', sel, index);
              
              if (result?.ok) {
                await new Promise(r => setTimeout(r, 800));
                const newDomTree = await chrome.tabs.sendMessage(tabId, { type: 'page.dom.tree' }).catch(() => null);
                if (newDomTree && !newDomTree.error) {
                  currentDomTree = newDomTree;
                }
                return { result, domTree: currentDomTree, tabId };
              }
            }
          } else {
            
            
            
          }
        }

        return { ok: false, error: `Click failed for element ${index}` };
      }
      case 'scroll': {
        const direction = args.toLowerCase();
        if (!['up', 'down'].includes(direction)) return { ok: false, error: 'Invalid scroll direction' };

        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'page.dom.perform',
          steps: [{ action: 'scroll', direction }],
        });
        return { ok: true };
      }
      case 'navigate': {
        const url = args.trim();
        if (!url) return { ok: false, error: 'No URL provided' };
        if (!HTTPS_RE.test(url)) return { ok: false, error: 'Only HTTP(S) URLs supported' };

        await chrome.tabs.update(tabId, { url });
        return { ok: true };
      }
      case 'type': {
        const parts = args.split(':');
        if (parts.length < 2) return { ok: false, error: 'Invalid type format. Use: type:N:text' };
        const index = parseInt(parts[0], 10);
        const text = parts.slice(1).join(':');
        if (isNaN(index) || index < 1) return { ok: false, error: 'Invalid input index' };

        let selector = null;

        if (currentDomTree?.elements) {
          const element = currentDomTree.elements.find(el => el.highlightIndex === index && (el.tagName === 'input' || el.tagName === 'textarea' || el.getAttribute('contenteditable') || el.attributes?.contenteditable));
          if (element) {
            if (element.xpath) {
              selector = element.xpath;
            } else {
              const attrs = [];
              if (element.type) attrs.push(`type="${element.type}"`);
              if (element.name) attrs.push(`name="${element.name}"`);
              if (element.placeholder) attrs.push(`placeholder="${element.placeholder}"`);
              selector = `input[${attrs.join('][')}]`;
            }
          }
        }

        if (!selector) {
          selector = `input:nth-of-type(${index})`;
        }

        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'page.dom.perform',
          steps: [{ action: 'type', selector, value: text }],
        });

        if (!result?.ok) {
          const fallbackSelectors = [
            '[role="textbox"]',
            '[aria-label*="wiadomość"]',
            '[aria-label*="message"]',
            '[placeholder*="Odpowiedz"]',
            '[placeholder*="Reply"]',
            'textarea[name="message"]',
            'div[contenteditable="true"]'
          ];

          for (const fallback of fallbackSelectors) {
            const fallbackResult = await chrome.tabs.sendMessage(tabId, {
              type: 'page.dom.perform',
              steps: [{ action: 'type', selector: fallback, value: text }],
            });
            if (fallbackResult?.ok) {
              return fallbackResult;
            }
          }
        }

        return result || { ok: false, error: 'Type failed' };
      }
      case 'hover': {
        const index = parseInt(args, 10);
        if (isNaN(index) || index < 1) return { ok: false, error: 'Invalid hover index. Use: hover:N' };

        if (currentDomTree?.elements) {
          const targetElement = currentDomTree.elements.find(el => el.highlightIndex === index);
          if (targetElement) {
            const selectors = buildSelectors(targetElement);
            for (const sel of selectors) {
              const result = await attemptAction(tabId, 'hover', sel, index);
              if (result?.ok) return { result, domTree: currentDomTree, tabId };
            }
          }
          return { ok: false, error: `Hover failed for element ${index} - element not found or not hoverable` };
        }
        return { ok: false, error: 'No DOM tree available for element lookup' };
      }
      case 'scroll_to': {
        const index = parseInt(args, 10);
        if (isNaN(index) || index < 1) return { ok: false, error: 'Invalid scroll_to index. Use: scroll_to:N' };

        if (currentDomTree?.elements) {
          const targetElement = currentDomTree.elements.find(el => el.highlightIndex === index);
          if (targetElement) {
            const selectors = buildSelectors(targetElement);
            for (const sel of selectors) {
              const result = await chrome.tabs.sendMessage(tabId, {
                type: 'page.dom.perform',
                steps: [{ action: 'scroll_to', selector: sel }],
              });
              if (result?.ok) return { result, domTree: currentDomTree, tabId };
            }
          }
          return { ok: false, error: `Scroll to element ${index} failed - element not found` };
        }
        return { ok: false, error: 'No DOM tree available for element lookup' };
      }
      case 'drag': {
        const parts = args.split(':');
        if (parts.length < 2) return { ok: false, error: 'Invalid drag format. Use: drag:SOURCE:TARGET' };
        const sourceIndex = parseInt(parts[0], 10);
        const targetIndex = parseInt(parts[1], 10);
        if (isNaN(sourceIndex) || sourceIndex < 1) return { ok: false, error: 'Invalid drag source index' };

        if (currentDomTree?.elements) {
          const sourceElement = currentDomTree.elements.find(el => el.highlightIndex === sourceIndex);
          const targetElement = targetIndex ? currentDomTree.elements.find(el => el.highlightIndex === targetIndex) : null;
          if (sourceElement) {
            const sourceSelectors = buildSelectors(sourceElement);
            let targetSelector = null;
            if (targetElement) {
              const targetSelectors = buildSelectors(targetElement);
              targetSelector = targetSelectors[0];
            }
            for (const sel of sourceSelectors) {
              const result = await chrome.tabs.sendMessage(tabId, {
                type: 'page.dom.perform',
                steps: [{ action: 'drag', selector: sel, target: targetSelector || `offset:100:100` }],
              });
              if (result?.ok) return { result, domTree: currentDomTree, tabId };
            }
          }
          return { ok: false, error: `Drag failed for element ${sourceIndex} - source element not found` };
        }
        return { ok: false, error: 'No DOM tree available for element lookup' };
      }
      case 'go_back': {
        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'page.dom.perform',
          steps: [{ action: 'go_back' }],
        });
        return result || { ok: true, message: 'Navigated back' };
      }
      case 'refresh': {
        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'page.dom.perform',
          steps: [{ action: 'refresh' }],
        });
        return result || { ok: true, message: 'Page refreshed' };
      }
      case 'select': {
        const parts = args.split(':');
        if (parts.length < 2) return { ok: false, error: 'Invalid select format. Use: select:N:value or select:N:label:labelText' };
        const index = parseInt(parts[0], 10);
        const value = parts.slice(1).join(':');
        if (isNaN(index) || index < 1) return { ok: false, error: 'Invalid select index' };

        if (currentDomTree?.elements) {
          const targetElement = currentDomTree.elements.find(el => el.highlightIndex === index && el.tagName === 'select');
          if (targetElement) {
            const selectors = buildSelectors(targetElement);
            for (const sel of selectors) {
              const result = await chrome.tabs.sendMessage(tabId, {
                type: 'page.dom.perform',
                steps: [{ action: 'select', selector: sel, value }],
              });
              if (result?.ok) return { result, domTree: currentDomTree, tabId };
            }
          }
          return { ok: false, error: `Select failed for element ${index} - element not found or not a select` };
        }
        return { ok: false, error: 'No DOM tree available for element lookup' };
      }
      default:
        return { ok: false, error: `Unknown action: ${type}` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function buildMessages(history, pageContext, pageScreenshot, systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, webSearch, pageLinks, domTree) {
  const msgs = [];

  const systemContent = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  if (systemContent) {
    msgs.push({ role: 'system', content: systemContent });
  }

  // Action tags for browser automation - language independent
  const actionTagsSystem = `## Browser Actions
When you need to perform an action on the page, include an action tag at the END of your message:
<action>TYPE:ARGS</action>

Available actions:
- <action>click:N</action> — click link/button/element number N (use highlightIndex from Interactive Elements)
- <action>hover:N</action> — hover over element number N to reveal dropdown menus, tooltips, or hidden content
- <action>scroll:up</action> or <action>scroll:down</action> — scroll the viewport
- <action>scroll_to:N</action> — scroll element N into view (center it)
- <action>navigate:URL</action> — go to URL (HTTP/S only)
- <action>type:N:text</action> — type text into input field number N
- <action>select:N:value</action> — select option by value in dropdown (select element N)
- <action>select:N:label:labelText</action> — select option by label text in dropdown
- <action>drag:SOURCE:TARGET</action> — drag element SOURCE to element TARGET (both are highlightIndex numbers)
- <action>go_back</action> — navigate back in browser history
- <action>refresh</action> — reload the current page

IMPORTANT:
- Use highlightIndex numbers from "Interactive Elements" section to reference clickable elements
- Elements may have additional properties: axRole (accessibility role), axName (computed name), axFocusable, axChecked, axExpanded, axPressed, axDisabled, axReadonly, axSelected — use these to distinguish similar elements
- Some elements are outside the viewport — look for [scroll Nx to see] hints to scroll before clicking
- For dropdowns: first hover to reveal options, then click the specific option
- Keep text before action tag brief. Use "Done." or "OK." instead of sentences
- Example: "Opening first link. <action>click:1</action>"`;

  msgs.push({ role: 'system', content: actionTagsSystem });

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

  // Add links index if available
  if (pageLinks && pageLinks.length > 0) {
    const linkLines = pageLinks.map(l => `[${l.index}] ${l.text} → ${l.href}`).join('\n');
    msgs.push({
      role: 'system',
      content: `## Page Links (use with <action>click:N</action>)\n${linkLines}`,
    });
  }

  // Add interactive elements from DOM tree (DRAGON) with AX enrichment
  if (domTree && domTree.elements && domTree.elements.length > 0) {
    const interactiveElements = domTree.elements.filter(el => el.highlightIndex != null);
    if (interactiveElements.length > 0) {
      const viewportHeight = 800; // approximate viewport height, overridden by _domRect if available
      const elementLines = interactiveElements.map(el => {
        const attrs = [];
        if (el.href) attrs.push(`href="${el.href}"`);
        if (el.type) attrs.push(`type="${el.type}"`);
        if (el.placeholder) attrs.push(`placeholder="${el.placeholder}"`);
        if (el.role) attrs.push(`role="${el.role}"`);
        // AX enrichment from CDP accessibility tree
        if (el.axRole) attrs.push(`axRole="${el.axRole}"`);
        if (el.axName && el.axName !== el.text) attrs.push(`axName="${String(el.axName).slice(0, 50)}"`);
        if (el.axFocusable) attrs.push('focusable');
        if (el.axChecked) attrs.push('checked');
        if (el.axExpanded) attrs.push('expanded');
        if (el.axPressed) attrs.push('pressed');
        if (el.axDisabled) attrs.push('disabled');
        if (el.axReadonly) attrs.push('readonly');
        if (el.axSelected) attrs.push('selected');
        if (el.axHasPopup) attrs.push(`haspopup="${el.axHasPopup}"`);
        if (el.axInvalid) attrs.push('invalid');
        // Scroll hint for out-of-viewport elements
        let scrollHint = '';
        const rect = el._domRect || el.viewportRect;
        if (rect) {
          const vTop = rect.top, vBottom = rect.top + (rect.height || 0);
          if (vBottom < 0) {
            const scrolls = Math.max(1, Math.ceil(Math.abs(vBottom) / (viewportHeight * 0.8)));
            scrollHint = ` [scroll down ${scrolls}x to see]`;
          } else if (vTop > viewportHeight) {
            const scrolls = Math.max(1, Math.ceil((vTop - viewportHeight * 0.2) / (viewportHeight * 0.8)));
            scrollHint = ` [scroll down ${scrolls}x to see]`;
          }
        }
        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
        const text = el.text ? `>${el.text}${scrollHint}` : (scrollHint ? `${scrollHint}` : '');
        return `[${el.highlightIndex}] <${el.tagName}${attrStr}${text} />`;
      }).join('\n');

      const statsInfo = domTree.stats ? ` (${domTree.stats.interactiveElements} interactive out of ${domTree.stats.totalElements} total elements)` : '';

      msgs.push({
        role: 'system',
        content: `## Interactive Elements${statsInfo} (use with <action>click:N</action>)\n${elementLines}`,
      });
    }
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

  const { conversationHistory, pageContext, pageScreenshot, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, pageLinks, domTree } = message;
  const msgs = await buildMessages(conversationHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, false, pageLinks, domTree);

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
  const { filename, content, append, sourceUrl, intent, model, provider } = message;
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
    const existing = readResp.ok ? await readResp.text() : '';
    const fileExists = readResp.ok && existing.length > 0;

    let existingUrl = '';
    let existingUrls = [];
    let existingIntent = '';
    let existingTags = '';
    let existingBody = '';
    if (fileExists && existing.startsWith('---')) {
      const endMatch = existing.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (endMatch) {
        existingBody = endMatch[2] || '';
        const fmLines = endMatch[1].split('\n');
        for (let i = 0; i < fmLines.length; i++) {
          const line = fmLines[i];
          const urlMatch = line.match(/^url:\s*(.+)/);
          if (urlMatch) { existingUrl = urlMatch[1].trim(); continue; }
          const intentMatch = line.match(/^intent:\s*(.+)/);
          if (intentMatch) { existingIntent = intentMatch[1].trim(); continue; }
          const tagsMatch = line.match(/^tags:\s*\[(.+)\]/);
          if (tagsMatch) { existingTags = tagsMatch[1].trim(); continue; }
          const urlsMatch = line.match(/^urls:\s*$/);
          if (urlsMatch) {
            for (let j = i + 1; j < fmLines.length; j++) {
              const urlLine = fmLines[j];
              if (urlLine.match(/^\s+-/)) {
                existingUrls.push(urlLine.replace(/^\s+-\s*/, '').trim());
                i = j;
              } else break;
            }
          }
        }
      }
    } else if (fileExists) {
      existingBody = existing;
    }

    const domain = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '';
    const urlForFm = domain || existingUrl;
    const mergedUrls = sourceUrl ? [...new Set([...existingUrls, sourceUrl])] : existingUrls;
    const finalIntent = intent || existingIntent;

    const date = new Date().toISOString().split('T')[0];
    const modelTag = model ? model.split('/').pop().replace(/-(?:2024|2025)[0-9]*/g, '').replace(/[^a-zA-Z0-9]/g, '-') : '';
    const domainTag = domain ? domain.replace(/[^a-zA-Z0-9]/g, '-') : '';
    const tagParts = ['openagent'];
    if (domainTag) tagParts.push(domainTag);
    tagParts.push(provider || 'openrouter');
    if (modelTag) tagParts.push(modelTag);
    const tags = tagParts.join(', ');

    let frontmatter = `---\nurl: ${urlForFm}\nmodel: ${model || 'unknown'}\nprovider: ${provider || 'openrouter'}\ndate: ${date}${finalIntent ? `\nintent: ${finalIntent}` : ''}${mergedUrls.length > 0 ? '\nurls:\n' + mergedUrls.map(u => `  - ${u}`).join('\n') + '\n' : ''}${tags ? `tags: [${tags}]\n` : ''}---\n\n`;

    let writeContent;
    if (fileExists) {
      // Append new content after existing body
      writeContent = frontmatter + existingBody + '\n\n---\n\n' + content;
    } else {
      // New file: frontmatter + content
      writeContent = frontmatter + content;
    }

    const writeResp = await fetch(url + '/vault/' + encodeURIComponent(fullPath), {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: writeContent,
    });
    if (!writeResp.ok) {
      const err = await writeResp.text();
      return { error: 'Write failed: ' + err };
    }
    return { ok: true, path: filename };
  } catch (err) {
    return { error: 'API error: ' + err.message };
  }
}