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
  const settings = await loadSettings();
  if (!settings.apiKey) {
    sendResponse({ error: 'API key not configured. Please set it in Settings.' });
    return;
  }

  const { conversationHistory, pageContext, pageScreenshot, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, webSearch, vaultIntent, pageLinks, domTree } = message;
  const msgs = await buildMessages(conversationHistory, pageContext, pageScreenshot, settings.systemPrompt, autoVault, vaultConnected, vaultName, vaultFilename, memoryContext, webSearch, pageLinks, domTree);

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
    const actionResult = await parseAndExecuteAction(content, pageLinks, domTree);
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
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'page.highlight.setState', highlightIndex, state: 'loading' }).catch(() => {});
  } catch (e) {}
  try {
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'page.dom.perform',
      steps: [{ action, selector }],
    });
    console.log('[OpenAgent] perform result:', result?.ok, result?.message || result?.error);
    try {
      const state = result?.ok ? 'success' : 'error';
      await chrome.tabs.sendMessage(tabId, { type: 'page.highlight.setState', highlightIndex, state }).catch(() => {});
    } catch (e) {}
    return result;
  } catch (e) {
    console.log('[OpenAgent] perform exception:', e.message);
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'page.highlight.setState', highlightIndex, state: 'error' }).catch(() => {});
    } catch (e) {}
    return { ok: false, error: e.message };
  }
}

async function parseAndExecuteAction(content, pageLinks, domTree) {
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

    const type = tag.slice(0, colonIdx).toLowerCase();
    const args = tag.slice(colonIdx + 1);

    const result = await executeAction(type, args, pageLinks, currentDomTree, tabId);

if (result) {
      console.log('[OpenAgent] executeAction result keys:', Object.keys(result), 'result:', result.result ? 'has result' : 'no result');
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
      console.log('[OpenAgent] actionMsg final:', JSON.stringify(actionMsg));

      if (result.domTree) currentDomTree = result.domTree;
      if (result.tabId) tabId = result.tabId;
      results.push(actionMsg);
    } else {
      console.log('[OpenAgent] executeAction returned null');
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
            console.log('[OpenAgent] Click target element:', targetElement.tagName, targetElement.href || targetElement.xpath || '', targetElement.attributes);
            const selectors = buildSelectors(targetElement);
            console.log('[OpenAgent] Built selectors:', selectors.length, selectors);
            for (const sel of selectors) {
              console.log('[OpenAgent] Trying selector:', sel);
              const result = await attemptAction(tabId, 'click', sel, index);
              console.log('[OpenAgent] Selector result:', result?.ok, result?.message || result?.error);
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
            console.log('[OpenAgent] Element with highlightIndex', index, 'not found in domTree');
            console.log('[OpenAgent] Available elements count:', currentDomTree.elements.length);
            console.log('[OpenAgent] First 10 highlightIndex:', currentDomTree.elements.slice(0, 10).map(e => e.highlightIndex));
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
- <action>scroll:up</action> or <action>scroll:down</action>
- <action>navigate:URL</action> — go to URL
- <action>type:N:text</action> — type text into input field number N

IMPORTANT:
- Use highlightIndex numbers from "Interactive Elements" section to reference clickable elements
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

  // Add interactive elements from DOM tree (DRAGON)
  if (domTree && domTree.elements && domTree.elements.length > 0) {
    const interactiveElements = domTree.elements.filter(el => el.highlightIndex != null);
    if (interactiveElements.length > 0) {
      const elementLines = interactiveElements.map(el => {
        const attrs = [];
        if (el.href) attrs.push(`href="${el.href}"`);
        if (el.type) attrs.push(`type="${el.type}"`);
        if (el.placeholder) attrs.push(`placeholder="${el.placeholder}"`);
        if (el.role) attrs.push(`role="${el.role}"`);
        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
        const text = el.text ? `>${el.text}` : '';
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