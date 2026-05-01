// content.js - Chrome Extension Content Script
// Collects page context and performs browser automation

(function () {
  const domElementRefs = new Map();

// ─── Page URL Change Detection ───────────────────────────────────────────────────
// Poll our own URL and notify when it changes — works reliably on all SPAs.

(function () {
  let lastUrl = location.href;
  let sendInterval = null;
  let sendPopstate = null;
  let sendPushState = null;
  let sendReplaceState = null;
  let sendFab = null;

  function safeSend(msg) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage(msg).catch(function() {});
      }
    } catch (e) {}
  }

  // Check URL every second
  sendInterval = setInterval(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      safeSend({ type: 'context.refresh' });
    }
  }, 1000);

  // Also intercept pushState for immediate notification
  sendPushState = history.pushState;
  history.pushState = function () {
    sendPushState.apply(history, arguments);
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      safeSend({ type: 'context.refresh' });
    }
  };

  sendReplaceState = history.replaceState;
  history.replaceState = function () {
    sendReplaceState.apply(history, arguments);
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      safeSend({ type: 'context.refresh' });
    }
  };

  sendPopstate = window.addEventListener('popstate', function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      safeSend({ type: 'context.refresh' });
    }
  });

  // Store cleanup functions for FAB click
  window.__openagentCleanup = function () {
    clearInterval(sendInterval);
    history.pushState = sendPushState;
    history.replaceState = sendReplaceState;
    window.removeEventListener('popstate', sendPopstate);
  };
})();

// ─── Floating Button ─────────────────────────────────────────────────────────

(function () {
  if (document.getElementById('openagent-fab')) return;
  try {
    const fab = document.createElement('div');
    fab.id = 'openagent-fab';
    fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#3C3C3C"/><path d="M8 10.5c0-.276.224-.5.5-.5h7c.276 0 .5.224.5.5v1c0 .276-.224.5-.5.5h-7a.5.5 0 0 1-.5-.5v-1z" fill="white"/><path d="M8 13.5c0-.276.224-.5.5-.5h7c.276 0 .5.224.5.5v1c0 .276-.224.5-.5.5h-7a.5.5 0 0 1-.5-.5v-1z" fill="white"/></svg><span>OpenAgent</span>`;
    fab.addEventListener('click', function () {
      try {
        if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
          chrome.sidePanel.open({ path: 'sidepanel.html' }).catch(function() {});
        }
      } catch (e) {}
    });
    if (!document.getElementById('openagent-fab-style')) {
      const s = document.createElement('style');
      s.id = 'openagent-fab-style';
      s.textContent = '#openagent-fab{position:fixed;bottom:24px;right:24px;z-index:2147483647;display:flex;align-items:center;gap:8px;background:#7c6af7;color:white;border:none;border-radius:28px;padding:12px 18px;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(60,60,60,.4);transition:transform .15s}#openagent-fab:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(60,60,60,.5)}#openagent-fab:active{transform:scale(.97)}#openagent-fab svg{width:20px;height:20px;flex-shrink:0}';
      (document.head || document.documentElement).appendChild(s);
    }
    (document.head || document.documentElement).appendChild(fab);
  } catch (e) {}
})();

// ─── Message Listener ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    switch (message.type) {
      case 'page.collect':
        collectPageProbe(message.overrideUrl).then(sendResponse).catch((err) => sendResponse({ error: err.message, rawCapture: { metadata: pageMetadata() } }));
        return true;
      case 'page.dom.snapshot':
        sendResponse(collectDomSnapshot());
        return true;
      case 'page.dom.perform':
        performDomActions(message.steps).then(sendResponse).catch((err) => sendResponse({ ok: false, summary: err.message, results: [] }));
        return true;
      case 'page.navigate':
        sendResponse(handleNavigation(message.command));
        return true;
    }
  } catch (e) {}
  return false;
});

// ─── Page Metadata ─────────────────────────────────────────────────────────────

function pageMetadata(overrideUrl) {
  const faviconEl = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
  return {
    url: overrideUrl || window.location.href,
    title: document.title,
    domain: window.location.hostname,
    favicon: faviconEl?.href || '',
  };
}

// ─── Page Probe ────────────────────────────────────────────────────────────────

async function collectPageProbe(overrideUrl) {
  // Small delay to let SPA pages settle before reading DOM
  await new Promise(r => setTimeout(r, 100));
  const bodyText = collectBodyText();
  const images = collectPageImages().slice(0, 8);
  return {
    rawCapture: {
      metadata: pageMetadata(overrideUrl),
      selectedText: window.getSelection?.()?.toString().trim() ?? '',
      bodyText,
      images,
      privacyFlags: {
        containsSensitiveFormData: !!document.querySelector('input[type="password"], input[autocomplete*="cc-"], input[autocomplete*="card"]'),
        userConsentedToHistory: false,
      },
    },
    features: {
      textLength: bodyText.length,
      imageCount: images.length,
      hasCanvas: document.querySelectorAll('canvas').length > 0,
      hasVideo: document.querySelectorAll('video').length > 0,
      hasDenseInteractiveUi: document.querySelectorAll('button, input, [role="button"]').length > 15,
    },
  };
}

// ─── Body Text Collection ─────────────────────────────────────────────────────

const HIGH_VALUE_SELECTORS = ['article', '[role="article"]', 'main', '[role="main"]', '.post', '.article', '.content', '.entry', '.story'];
const VISIBLE_TEXT_SELECTORS = ['section', 'div', 'p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'NAV', 'FOOTER', 'HEADER', 'ASIDE']);

function collectBodyText() {
  const MAX_LEN = 50000;
  const candidates = [];
  for (const sel of HIGH_VALUE_SELECTORS) {
    for (const el of document.querySelectorAll(sel)) {
      if (isVisible(el)) candidates.push({ el, priority: 2 });
    }
  }
  for (const sel of VISIBLE_TEXT_SELECTORS) {
    for (const el of document.querySelectorAll(sel)) {
      if (isVisible(el) && el.textContent.trim().length > 50) candidates.push({ el, priority: 1 });
    }
  }
  const seen = new Set();
  const lines = [];
  let length = 0;
  candidates.sort((a, b) => b.priority - a.priority || a.el.sourceIndex - b.el.sourceIndex);
  for (const { el } of candidates) {
    const text = extractText(el).trim();
    if (!text || text.length < 30) continue;
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    lines.push(text);
    length += text.length + 1;
    if (length > MAX_LEN) break;
  }
  return lines.join('\n\n').slice(0, MAX_LEN);
}

function extractText(el) {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !SKIP_TAGS.has(n.tagName)))
    .map((n) => (n.nodeType === Node.TEXT_NODE ? n.textContent : extractText(n)))
    .join(' ').replace(/\s+/g, ' ').trim();
}

function isVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
}

// ─── Page Images ──────────────────────────────────────────────────────────────

function collectPageImages() {
  const results = [];
  const seen = new Set();
  for (const img of document.images) {
    if (!img.src || img.src.startsWith('data:') || seen.has(img.src)) continue;
    if (img.width < 64 || img.height < 64) continue;
    seen.add(img.src);
    const rect = img.getBoundingClientRect();
    results.push({ url: img.currentSrc || img.src, alt: img.alt || '', width: img.naturalWidth, height: img.naturalHeight, visible: isVisible(img), viewportRect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } });
  }
  return results;
}

// ─── DOM Snapshot ─────────────────────────────────────────────────────────────

function collectDomSnapshot() {
  domElementRefs.clear();
  const selectors = ['button', 'a[href]', 'input:not([type="hidden"])', 'textarea', 'select', 'summary', '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="option"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="tab"]', '[role="textbox"]', '[contenteditable="true"]'];
  const elements = [];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (isVisible(el)) elements.push(el);
    }
  }
  const described = elements.filter((el) => !domElementRefs.has(el)).slice(0, 60).map((el, i) => {
    const ref = `el-${i + 1}`;
    domElementRefs.set(ref, el);
    return describeElement(ref, el);
  });
  return { metadata: pageMetadata(), elements: described, capabilities: { supportsDomAutomation: true } };
}

function describeElement(ref, el) {
  const rect = el.getBoundingClientRect();
  const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  return { ref, tagName: el.tagName.toLowerCase(), role: el.getAttribute('role') || inferRole(el), label: getElementLabel(el), text: (el.innerText || el.textContent || '').trim().slice(0, 120), selector: buildSelector(el), href: el instanceof HTMLAnchorElement ? el.href : undefined, value: isInput && el.value ? el.value : undefined, placeholder: isInput && el.placeholder ? el.placeholder : undefined, type: isInput && el.type ? el.type : undefined, isTextEntryCandidate: isTextEntryCandidate(el), disabled: el.disabled || el.getAttribute('aria-disabled') === 'true', viewportRect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } };
}

function inferRole(el) {
  if (el instanceof HTMLButtonElement) return 'button';
  if (el instanceof HTMLAnchorElement) return 'link';
  if (el instanceof HTMLInputElement) return el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'textbox';
  if (el instanceof HTMLTextAreaElement) return 'textbox';
  if (el instanceof HTMLSelectElement) return 'listbox';
  return '';
}

function getElementLabel(el) {
  return el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('id') || el.name || '';
}

function buildSelector(el) {
  if (el.id) return `#${el.id}`;
  const parts = [];
  let cur = el;
  while (cur && cur !== document.body && parts.length < 4) {
    let sel = cur.tagName.toLowerCase();
    if (cur.id) { sel += `#${cur.id}`; parts.unshift(sel); break; }
    if (cur.className && typeof cur.className === 'string') {
      const cls = cur.className.trim().split(/\s+/)[0];
      if (cls) sel += `.${cls}`;
    }
    parts.unshift(sel);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

function isTextEntryCandidate(el) {
  return (el instanceof HTMLInputElement && !['hidden', 'checkbox', 'radio', 'file', 'submit', 'button', 'image', 'reset'].includes(el.type)) || el instanceof HTMLTextAreaElement || el.getAttribute('contenteditable') === 'true';
}

// ─── DOM Actions ──────────────────────────────────────────────────────────────

async function performDomActions(steps) {
  const results = [];
  for (const step of steps.slice(0, 5)) {
    results.push(await performDomAction(step));
  }
  return { ok: results.every((r) => r.ok), summary: results.map((r) => r.message).join('; '), results };
}

async function performDomAction(step) {
  try {
    const el = resolveTarget(step);
    if (!el && step.action !== 'navigate' && step.action !== 'scroll') {
      return { ok: false, message: `Element not found: ${step.ref || step.label || step.selector}` };
    }
    switch (step.action) {
      case 'click':
        if (!el) return { ok: false, message: 'No target element' };
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.click();
        return { ok: true, message: `Clicked: ${getElementLabel(el) || step.action}` };
      case 'type':
        if (!el) return { ok: false, message: 'No target element' };
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus(); el.value = step.value || ''; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.getAttribute('contenteditable') === 'true') {
          el.focus(); el.innerText = step.value || ''; el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
        return { ok: true, message: `Typed: ${step.value}` };
      case 'scroll':
        if (step.direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
        else if (step.direction === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        else window.scrollBy({ top: (step.direction === 'up' ? -1 : 1) * window.innerHeight * 0.8, behavior: 'smooth' });
        return { ok: true, message: `Scrolled ${step.direction || 'down'}` };
      case 'navigate':
        if (!step.url) return { ok: false, message: 'No URL provided' };
        if (!/^https?:\/\//.test(step.url)) return { ok: false, message: 'Only HTTP(S) navigation supported' };
        window.location.href = step.url;
        return { ok: true, message: `Navigated to: ${step.url}` };
      case 'select':
        if (!el || !(el instanceof HTMLSelectElement)) return { ok: false, message: 'Not a select element' };
        const option = Array.from(el.options).find((o) => o.value === step.value || o.label === step.label);
        if (option) { el.value = option.value; el.dispatchEvent(new Event('change', { bubbles: true })); }
        return { ok: !!option, message: option ? `Selected: ${option.label}` : 'Option not found' };
      default:
        return { ok: false, message: `Unsupported action: ${step.action}` };
    }
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function resolveTarget(step) {
  if (step.ref && domElementRefs.has(step.ref)) return domElementRefs.get(step.ref);
  if (step.selector) return document.querySelector(step.selector);
  if (step.label) {
    const normalized = step.label.toLowerCase();
    for (const [ref, el] of domElementRefs) {
      if (getElementLabel(el).toLowerCase().includes(normalized) || (el.innerText || '').toLowerCase().includes(normalized)) return el;
    }
  }
  return null;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function handleNavigation(command) {
  if (command.kind === 'scroll') {
    if (command.direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (command.direction === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    else window.scrollBy({ top: (command.direction === 'up' ? -1 : 1) * window.innerHeight * 0.8, behavior: 'smooth' });
  } else if (command.kind === 'navigate') {
    if (!command.url) return { ok: false, error: 'No URL provided' };
    if (!/^https?:\/\//.test(command.url)) return { ok: false, error: 'Only HTTP(S) URLs supported' };
    window.location.href = command.url;
  }
  return { ok: true };
}

// End of content script IIFE
})();
