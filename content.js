// content.js - Chrome Extension Content Script
// Collects page context and performs browser automation

(function () {
'use strict';
const HTTPS_RE = /^https?:\/\//;
const domElementRefs = new Map();

  function safeSend(msg) {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') return;
      chrome.runtime.sendMessage(msg);
    } catch (e) {}
  }

  // Intercept history API for SPA navigation (YouTube, etc.)
  (function () {
    let lastUrl = location.href;

    const origPushState = history.pushState;
    history.pushState = function () {
      origPushState.apply(history, arguments);
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        safeSend({ type: 'context.refresh' });
      }
    };

    const origReplaceState = history.replaceState;
    history.replaceState = function () {
      origReplaceState.apply(history, arguments);
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        safeSend({ type: 'context.refresh' });
      }
    };

    window.addEventListener('popstate', function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        safeSend({ type: 'context.refresh' });
      }
    });

    // Fallback: check URL every 10s in case history API wasn't used
    setInterval(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        safeSend({ type: 'context.refresh' });
      }
    }, 10000);
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
          try { chrome.sidePanel.open({ path: 'sidepanel.html' }); } catch (e) {}
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
      case 'page.dom.tree':
        collectDomTree().then(sendResponse).catch((err) => sendResponse({ error: err.message }));
        return true;
      case 'page.dom.perform':
        performDomActions(message.steps).then(sendResponse).catch((err) => sendResponse({ ok: false, summary: err.message, results: [] }));
        return true;
      case 'page.navigate':
        sendResponse(handleNavigation(message.command));
        return true;
      case 'page.links.collect':
        sendResponse({ links: collectPageLinks() });
        return true;
      case 'page.inject':
        injectBuildDomTree().then((result) => sendResponse(result)).catch((err) => sendResponse({ injected: false, error: err.message }));
        return true;
      case 'page.highlight':
        highlightElements(message.elements).then(sendResponse);
        return true;
      case 'page.highlight.remove':
        removeHighlights();
        sendResponse({ ok: true });
        return true;
      case 'page.highlight.toggle':
        toggleHighlights(message.visible);
        sendResponse({ ok: true });
        return true;
      case 'page.highlight.setState':
        setBadgeState(message.highlightIndex, message.state);
        sendResponse({ ok: true });
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

// ─── Page Links ───────────────────────────────────────────────────────────────

function collectPageLinks() {
  const results = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('a[href]')) {
    const href = el.href;
    if (!href || !href.startsWith('http') || seen.has(href)) continue;
    const text = el.textContent.trim().slice(0, 80);
    if (!text) continue;
    seen.add(href);
    const rect = el.getBoundingClientRect();
    results.push({
      index: results.length + 1,
      text,
      href,
      visible: isVisible(el),
      viewportRect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    });
  }
  return results.slice(0, 30);
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
        el.focus();
        const text = step.value || '';
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
          if (el.type === 'file' || el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.type === 'image' || el.type === 'reset') {
            return { ok: false, message: `Cannot type into ${el.type} input` };
          }
          el.value = text;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        } else if (el.getAttribute('contenteditable') === 'true') {
          
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            selection.deleteFromDocument();
          }
          document.execCommand('insertText', false, text);
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        } else {
          el.innerText = text;
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
        return { ok: true, message: `Typed: ${step.value}` };
      case 'scroll':
        if (step.direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
        else if (step.direction === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        else window.scrollBy({ top: (step.direction === 'up' ? -1 : 1) * window.innerHeight * 0.8, behavior: 'smooth' });
        return { ok: true, message: `Scrolled ${step.direction || 'down'}` };
      case 'navigate':
        if (!step.url) return { ok: false, message: 'No URL provided' };
        if (!HTTPS_RE.test(step.url)) return { ok: false, message: 'Only HTTP(S) navigation supported' };
        window.location.href = step.url;
        return { ok: true };
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
  if (step.selector) {
    
    if (step.selector.startsWith('/') || step.selector.includes('/*[')) {
      try {
        const result = document.evaluate(step.selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue) return result.singleNodeValue;

        const simpleXPath = step.selector.includes('@id') 
          ? `//*[@id="${step.selector.match(/@id="([^"]+)"/)?.[1]}"]`
          : null;
        if (simpleXPath) {
          const simpleResult = document.evaluate(simpleXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          if (simpleResult.singleNodeValue) return simpleResult.singleNodeValue;
        }

        const draftResult = document.evaluate('//div[contains(@class,"DraftEditor-root")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (draftResult.singleNodeValue) return draftResult.singleNodeValue;

        const contenteditable = document.evaluate('//div[@contenteditable="true"][contains(@class,"notranslate")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (contenteditable.singleNodeValue) return contenteditable.singleNodeValue;

        return null;
      } catch (e) {
        
        return null;
      }
    }
    const found = document.querySelector(step.selector);
    if (found) return found;

    if (step.selector.includes('nth-of-type')) {
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"])');
      if (inputs.length > 0) return inputs[0];
      const textareas = document.querySelectorAll('textarea');
      if (textareas.length > 0) return textareas[0];
      const editable = document.querySelector('[contenteditable="true"]');
      if (editable) return editable;
    }
    return null;
  }
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

// ─── DOM Tree Collection (DRAGON) ───────────────────────────────────────────

async function injectBuildDomTree() {
  if (window.buildDomTree) {
    return { injected: true, alreadyExists: true };
  }
  try {
    await chrome.scripting.executeScript({
      target: { allFrames: true },
      files: ['buildDomTree.js']
    });
    return { injected: true };
  } catch (e) {
    console.error('[OpenAgent] injectBuildDomTree error:', e);
    return { injected: false, error: e.message };
  }
}

async function collectDomTree() {
  await new Promise(r => setTimeout(r, 100));

  if (!window.buildDomTree) {
    await injectBuildDomTree();
  }

  if (!window.buildDomTree) {
    return { error: 'buildDomTree not available', elements: collectDomSnapshot().elements };
  }

  const startTime = Date.now();
  const result = window.buildDomTree({ startId: 0, startHighlightIndex: 0 });

  const elements = [];
  const selectorMap = new Map();

  

  for (const [id, node] of Object.entries(result.map)) {
    if (!node || node.type === 'TEXT_NODE') continue;

    const element = {
      ref: `el-${node.highlightIndex || id}`,
      tagName: node.tagName,
      xpath: node.xpath,
      attributes: node.attributes || {},
      text: node.attributes?.text || '',
      href: node.attributes?.href,
      src: node.attributes?.src,
      alt: node.attributes?.alt,
      title: node.attributes?.title,
      placeholder: node.attributes?.placeholder,
      type: node.attributes?.type,
      role: node.attributes?.role,
      value: node.attributes?.value,
      class: node.attributes?.class,
      id: node.attributes?.id,
      name: node.attributes?.name,
      isInteractive: node.isInteractive,
      isTopElement: node.isTopElement,
      isInViewport: node.isInViewport,
      isVisible: node.isVisible,
      highlightIndex: node.highlightIndex,
      'data-testid': node.attributes?.['data-testid'],
      'data-cy': node.attributes?.['data-cy'],
      'data-test': node.attributes?.['data-test'],
      'aria-label': node.attributes?.['aria-label'],
      viewportRect: {
        left: node.attributes?.viewport?.left || 0,
        top: node.attributes?.viewport?.top || 0,
        width: node.attributes?.viewport?.width || 0,
        height: node.attributes?.viewport?.height || 0
      }
    };

    if (node.highlightIndex != null) {
      
    }

    elements.push(element);

    if (node.highlightIndex != null) {
      selectorMap.set(node.highlightIndex, element);
    }
  }

  return {
    metadata: pageMetadata(),
    elements,
    selectorMap: Object.fromEntries(selectorMap),
    stats: {
      totalElements: Object.keys(result.map).length,
      interactiveElements: result.highlightCount,
      buildTimeMs: Date.now() - startTime
    }
  };
}

// ─── Element Highlighting ──────────────────────────────────────────────────────

function highlightElements(elements) {
  removeHighlights();

  if (!elements || elements.length === 0) {
    return { ok: false, error: 'No elements to highlight' };
  }

  

  let highlightedCount = 0;

  for (const el of elements) {
    if (el.highlightIndex == null) continue;

    let domEl = null;
    const selectors = [];

    if (el.href) selectors.push(`a[href="${el.href}"]`);
    if (el.xpath) {
      try {
        const result = document.evaluate(el.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue) {
          domEl = result.singleNodeValue;
        }
      } catch (e) {
        
      }
    }

    if (!domEl && el.tagName === 'input' && el.type) {
      domEl = document.querySelector(`input[type="${el.type}"]`);
    }
    if (!domEl && el.tagName === 'button') {
      domEl = document.querySelector('button');
    }
    if (!domEl && el.tagName === 'a' && el.href) {
      domEl = document.querySelector(`a[href="${el.href}"]`);
    }
    if (!domEl && el.tagName) {
      domEl = document.querySelector(el.tagName);
    }

    if (!domEl) {
      
      continue;
    }

    const rect = domEl.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      continue;
    }

    const badge = document.createElement('div');
    badge.textContent = el.highlightIndex;
    badge.dataset.openagentBadge = el.highlightIndex;
    badge.className = 'openagent-badge';
    badge.style.cssText = [
      'position:fixed',
      `left:${rect.left + rect.width / 2}px`,
      `top:${rect.top - 8}px`,
      'transform:translateX(-50%)',
      'background:#7c6af7',
      'color:white',
      'border-radius:10px',
      'min-width:18px',
      'height:18px',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'font-weight:600',
      'font-size:11px',
      'pointer-events:none',
      'z-index:2147483647',
      'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
      'padding:0 5px',
      'transition:background 0.2s, transform 0.2s',
    ].join(';');

    const highlight = document.createElement('div');
    highlight.dataset.openagentHighlight = el.highlightIndex;
    highlight.className = 'openagent-highlight';
    highlight.style.cssText = [
      'position:fixed',
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'background:rgba(124,106,247,0.15)',
      'border:2px solid #7c6af7',
      'border-radius:3px',
      'pointer-events:none',
      'z-index:2147483646',
      'box-sizing:border-box',
      'display:none',
      'transition:border-color 0.2s, background 0.2s',
    ].join(';');

    (document.body || document.documentElement).appendChild(highlight);
    (document.body || document.documentElement).appendChild(badge);
    highlightedCount++;
  }

  
  return { ok: true, highlightedCount };
}

function removeHighlights() {
  const existing = document.getElementById('openagent-highlight-container');
  if (existing) existing.remove();

  document.querySelectorAll('[data-openagent-highlight]').forEach(el => el.remove());
  document.querySelectorAll('[data-openagent-badge]').forEach(el => el.remove());
}

function toggleHighlights(visible) {
  const highlightDisplay = visible ? 'block' : 'none';
  const badgeDisplay = visible ? 'flex' : 'none';

  document.querySelectorAll('[data-openagent-highlight]').forEach(el => {
    el.style.display = highlightDisplay;
  });
  document.querySelectorAll('[data-openagent-badge]').forEach(el => {
    el.style.display = badgeDisplay;
  });
}

function setBadgeState(highlightIndex, state) {
  const badge = document.querySelector(`.openagent-badge[data-openagent-badge="${highlightIndex}"]`);
  const highlight = document.querySelector(`.openagent-highlight[data-openagent-highlight="${highlightIndex}"]`);
  if (!badge) return;

  badge.classList.remove('openagent-badge-loading', 'openagent-badge-success', 'openagent-badge-error');
  badge.classList.add(`openagent-badge-${state}`);

  if (state === 'loading') {
    badge.style.background = '#f59e0b';
    badge.style.transform = 'translateX(-50%) scale(1.1)';
  } else if (state === 'success') {
    badge.style.background = '#10b981';
    badge.style.transform = 'translateX(-50%) scale(1)';
    if (highlight) highlight.style.borderColor = '#10b981';
  } else if (state === 'error') {
    badge.style.background = '#ef4444';
    badge.style.transform = 'translateX(-50%) scale(1)';
    if (highlight) highlight.style.borderColor = '#ef4444';
  }

  setTimeout(() => {
    if (state === 'success' || state === 'error') {
      badge.classList.remove(`openagent-badge-${state}`);
      badge.style.background = '#7c6af7';
      badge.style.transform = 'translateX(-50%)';
      if (highlight) highlight.style.borderColor = '#7c6af7';
    }
  }, 2000);
}

function computePageStateHash() {
  const elements = document.querySelectorAll('a[href], button, input, textarea, select, [role="button"], [role="link"]');
  let hash = 0;
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const text = el.textContent?.trim().slice(0, 20) || '';
      const href = el.href || '';
      hash = (hash * 31 + text.length + href.length) >>> 0;
    }
  }
  return hash;
}

let lastPageStateHash = null;

function verifyAction(action, selector) {
  const currentHash = computePageStateHash();
  const hashChanged = lastPageStateHash !== null && lastPageStateHash !== currentHash;
  lastPageStateHash = currentHash;

  if (action === 'click') {
    let target = null;
    if (selector.startsWith('/') || selector.includes('/*[')) {
      try {
        const result = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        target = result.singleNodeValue;
      } catch (e) {}
    } else {
      target = document.querySelector(selector);
    }

    if (!target) {
      return { ok: false, reason: 'element_not_found', recovered: false };
    }

    const urlChanged = window.location.href !== lastUrl;
    lastUrl = window.location.href;

    return {
      ok: true,
      urlChanged,
      hashChanged,
      elementExists: !!target,
      elementText: target.textContent?.trim().slice(0, 50) || ''
    };
  }

  return { ok: true };
}

let lastUrl = window.location.href;

// End of content script IIFE
})();
