// buildDomTree.js - Injected into web pages to build DOM tree
// Provides window.buildDomTree function for the background script

(function () {
  'use strict';

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'META', 'LINK', 'TITLE', 'HEAD']);

  const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'textarea', 'select', 'summary', 'option', 'label', 'details', 'menuitem', 'tab', 'switch']);
  const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'option', 'checkbox', 'radio', 'switch', 'tab', 'textbox', 'searchbox', 'combobox', 'listbox', 'tree', 'treeitem', 'menu', 'menubar', 'menuitem', 'tablist', 'tabpanel', 'anchor', 'slider', 'spinbutton', 'tooltip', 'dialog', 'alert', 'banner', 'navigation', 'complementary', 'contentinfo', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'list', 'listitem', 'note', 'presentation', 'region', 'row', 'rowgroup', 'separator', 'status']);

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    if (el.hidden) return false;
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    if (el.offsetWidth <= 0 || el.offsetHeight <= 0) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
    }
    return true;
  }

  function isInteractive(el) {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.getAttribute('visibility') === 'hidden') return false;
    if (INTERACTIVE_TAGS.has(el.tagName.toLowerCase())) return true;
    const role = el.getAttribute('role');
    if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) return true;
    if (el.hasAttribute('onclick') || el.hasAttribute('ng-click') || el.hasAttribute('@click') || el.hasAttribute('data-click') || el.hasAttribute('data-href')) return true;
    if (el.hasAttribute('tabindex') && !el.hasAttribute('disabled')) return true;
    if (el instanceof HTMLInputElement && el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio') return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    if (el.getAttribute('draggable') === 'true') return true;
    if (el.tagName === 'AREA') return true;
    if (el.tagName === 'SUMMARY') return true;
    if (el.tagName === 'LABEL') return true;
    if (el.parentElement?.tagName === 'DETAILS' && el.tagName === 'SUMMARY') return true;
    return false;
  }

  function isTopElement(el, rect, allRects) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    for (const [other, otherRect] of allRects) {
      if (other === el) continue;
      if (otherRect.left <= centerX && centerX <= otherRect.right &&
          otherRect.top <= centerY && centerY <= otherRect.bottom &&
          (otherRect.width * otherRect.height) > (rect.width * rect.height)) {
        return false;
      }
    }
    return true;
  }

  function buildXPath(el) {
    if (el.id) return `//*[@id="${el.id}"]`;
    const parts = [];
    let cur = el;
    while (cur && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part = `*[@id="${cur.id}"]`;
        parts.unshift(part);
        break;
      }
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\s+/)[0];
        if (cls) part += `[contains(@class,"${cls}")]`;
      }
      const siblings = cur.parentElement ? Array.from(cur.parentElement.children).filter(s => s.tagName === cur.tagName) : [];
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        part += `[${idx}]`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return '/' + parts.join('/');
  }

  function getAttributes(el) {
    const attrs = {};
    for (const attr of el.attributes) {
      if (attr.name === 'class' || attr.name === 'style') continue;
      if (attr.value && attr.value.length < 200) {
        attrs[attr.name] = attr.value;
      }
    }
    if (el.id) attrs.id = el.id;
    if (el.className && typeof el.className === 'string' && el.className.trim()) {
      attrs.class = el.className.trim().split(/\s+/).slice(0, 5).join(' ');
    }
    if (el.getAttribute('role')) attrs.role = el.getAttribute('role');
    if (el.getAttribute('aria-label')) attrs['aria-label'] = el.getAttribute('aria-label');
    if (el.getAttribute('aria-labelledby')) attrs['aria-labelledby'] = el.getAttribute('aria-labelledby');
    if (el.getAttribute('aria-describedby')) attrs['aria-describedby'] = el.getAttribute('aria-describedby');
    if (el.getAttribute('aria-expanded')) attrs['aria-expanded'] = el.getAttribute('aria-expanded');
    if (el.getAttribute('aria-controls')) attrs['aria-controls'] = el.getAttribute('aria-controls');
    if (el.getAttribute('data-testid')) attrs['data-testid'] = el.getAttribute('data-testid');
    if (el.getAttribute('data-cy')) attrs['data-cy'] = el.getAttribute('data-cy');
    if (el.getAttribute('data-test')) attrs['data-test'] = el.getAttribute('data-test');
    if (el.getAttribute('name')) attrs.name = el.getAttribute('name');
    if (el.getAttribute('type')) attrs.type = el.getAttribute('type');
    if (el.getAttribute('placeholder')) attrs.placeholder = el.getAttribute('placeholder');
    if (el.getAttribute('title')) attrs.title = el.getAttribute('title');
    if (el.getAttribute('href')) attrs.href = el.getAttribute('href');
    if (el.getAttribute('src')) attrs.src = el.getAttribute('src');
    if (el.getAttribute('alt')) attrs.alt = el.getAttribute('alt');
    if (el.getAttribute('tabindex')) attrs.tabindex = el.getAttribute('tabindex');
    if (el.getAttribute('contenteditable')) attrs.contenteditable = el.getAttribute('contenteditable');
    if (el.textContent.trim()) attrs.text = el.textContent.trim().slice(0, 100);
    return attrs;
  }

  function getViewportRect(el) {
    const rect = el.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom)
    };
  }

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
  }

  function collectClickableElements(root, startId, startHighlight) {
    const map = {};
    const interactiveElements = [];
    const addedElements = new Set();
    let id = startId || 0;
    let highlightIndex = startHighlight || 0;

    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (text.length > 0) {
          const parent = node.parentElement;
          if (parent && !SKIP_TAGS.has(parent.tagName) && isVisible(parent)) {
            const parentRect = parent.getBoundingClientRect();
            if (parentRect.width > 0 && parentRect.height > 0) {
              return {
                id: String(id++),
                type: 'TEXT_NODE',
                text: text.slice(0, 500),
                isVisible: true
              };
            }
          }
        }
        return null;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return null;

      const el = node;
      if (SKIP_TAGS.has(el.tagName)) return null;

      const rect = getViewportRect(el);
      const visible = isVisible(el);
      const interactive = visible && isInteractive(el);

      const attrs = getAttributes(el);
      if (el.href) attrs.href = el.href;
      if (el.src) attrs.src = el.src;
      if (el.alt) attrs.alt = el.alt;
      if (el.title) attrs.title = el.title;
      if (el.placeholder) attrs.placeholder = el.placeholder;
      if (el.value && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) attrs.value = String(el.value).slice(0, 100);
      if (el.tagName === 'INPUT') attrs.type = el.type;
      if (el.tagName === 'BUTTON' || el.textContent.trim()) {
        const text = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 100);
        if (text) attrs.text = text;
      }

      const currentId = String(id++);
      const nodeData = {
        id: currentId,
        type: 'ELEMENT_NODE',
        tagName: el.tagName.toLowerCase(),
        xpath: buildXPath(el),
        attributes: attrs,
        isVisible: visible,
        isInteractive: interactive,
        isTopElement: false,
        isInViewport: isInViewport(el),
        highlightIndex: null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        children: []
      };

      if (interactive && !addedElements.has(el)) {
        interactiveElements.push({ el, rect, nodeData });
        addedElements.add(el);
      }

      for (const child of el.childNodes) {
        const childNode = traverse(child);
        if (childNode) {
          nodeData.children.push(childNode.id);
          map[childNode.id] = childNode;
        }
      }

      return nodeData;
    }

    const interactiveSelectors = [
      'a[href]', 'button', 'input:not([type="hidden"])', 'textarea', 'select',
      '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="option"]',
      '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="tab"]',
      '[role="textbox"]', '[role="searchbox"]', '[role="combobox"]', '[contenteditable="true"]',
      '[tabindex]', '[onclick]', '[data-click]', '[ng-click]', 'details > summary',
      'label[for]', 'summary', 'menuitem', 'option'
    ];
    for (const sel of interactiveSelectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          if (!addedElements.has(el)) {
            const visible = isVisible(el);
            const interactive = visible && isInteractive(el);
            const rect = el.getBoundingClientRect();
            if (visible) {
              allRects.set(el, rect);
            }
            if (interactive) {
              const attrs = getAttributes(el);
              if (el.href) attrs.href = el.href;
              if (el.textContent) attrs.text = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 100);
              const nodeData = {
                id: String(id++),
                type: 'ELEMENT_NODE',
                tagName: el.tagName.toLowerCase(),
                xpath: buildXPath(el),
                attributes: attrs,
                isVisible: visible,
                isInteractive: interactive,
                isTopElement: false,
                isInViewport: isInViewport(el),
                highlightIndex: null,
                viewport: { width: window.innerWidth, height: window.innerHeight },
                children: []
              };
              interactiveElements.push({ el, rect, nodeData });
              addedElements.add(el);
            }
          }
        }
      } catch (e) {}
    }

    const rootNode = traverse(root || document.body);
    if (rootNode) {
      map[rootNode.id] = rootNode;
    }

    for (const { el, rect, nodeData } of interactiveElements) {
      nodeData.highlightIndex = ++highlightIndex;
    }

    return {
      rootId: rootNode ? rootNode.id : null,
      map: map,
      highlightCount: highlightIndex
    };
  }

  function turn2Markdown(selector) {
    const root = selector ? document.querySelector(selector) : document.body;
    if (!root) return '';

    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'NAV', 'FOOTER', 'HEADER', 'ASIDE', 'SVG', 'CANVAS']);

    function extractText(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.replace(/\s+/g, ' ').trim();
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node;
      if (SKIP.has(el.tagName)) return '';

      let text = '';
      for (const child of el.childNodes) {
        text += extractText(child) + ' ';
      }

      const tag = el.tagName.toLowerCase();
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'P', 'DIV', 'SECTION', 'ARTICLE'].includes(tag)) {
        text = '\n' + text.trim() + '\n';
      } else if (tag === 'BR') {
        text = '\n';
      }
      return text;
    }

    return extractText(root).replace(/\n{3,}/g, '\n\n').trim().slice(0, 50000);
  }

  function parserReadability() {
    const article = document.querySelector('article') || document.querySelector('[role="article"]') || document.querySelector('main') || document.querySelector('[role="main"]') || document.body;

    const title = document.title || document.querySelector('h1')?.textContent || '';
    const byline = document.querySelector('[rel="author"]')?.textContent ||
                   document.querySelector('.author')?.textContent ||
                   document.querySelector('[class*="author"]')?.textContent || '';
    const siteName = document.querySelector('meta[property="og:site_name"]')?.content || window.location.hostname;

    return {
      title,
      content: turn2Markdown(),
      textContent: extractText(article),
      length: extractText(article).length,
      excerpt: extractText(article).slice(0, 200),
      byline,
      dir: document.dir || 'ltr',
      siteName,
      lang: document.documentElement.lang || 'en',
      publishedTime: document.querySelector('meta[property="article:published_time"]')?.content || ''
    };

    function extractText(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.replace(/\s+/g, ' ').trim();
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node;
      if (SKIP.has(el.tagName)) return '';
      let text = '';
      for (const child of el.childNodes) {
        text += extractText(child) + ' ';
      }
      return text.trim();
    }
  }

  window.turn2Markdown = turn2Markdown;
  window.parserReadability = parserReadability;

  function buildDomTree(args) {
    args = args || {};
    const startId = args.startId || 0;
    const startHighlight = args.startHighlightIndex || 0;

    const result = collectClickableElements(document.body, startId, startHighlight);

    return {
      rootId: result.rootId,
      map: result.map,
      highlightCount: result.highlightCount,
      perfMetrics: {
        timestamp: Date.now(),
        elementCount: Object.keys(result.map).length,
        interactiveCount: result.highlightCount
      }
    };
  }

  window.buildDomTree = buildDomTree;
})();
