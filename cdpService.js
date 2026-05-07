// cdpService.js - Chrome DevTools Protocol (CDP) integration for openagent
// Runs inside the service worker (background.js) context
// Provides accessibility tree enrichment, event listener detection, and DOM snapshot

const cdpAttachedTabs = new Map(); // tabId -> boolean
let cachedAxTree = new Map();     // tabId -> AX tree nodes
const CDP_VERSION = '1.3';

function cdpSendCommand(tabId, method, params = {}) {
  return new Promise((resolve) => {
    try {
      chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve({ result });
        }
      });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
}

function isAttached(tabId) {
  return cdpAttachedTabs.get(tabId) === true;
}

async function attachDebugger(tabId) {
  if (cdpAttachedTabs.get(tabId)) {
    return { ok: true, alreadyAttached: true };
  }

  try {
    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, CDP_VERSION, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    cdpAttachedTabs.set(tabId, true);
    cachedAxTree.delete(tabId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function detachDebugger(tabId) {
  if (!cdpAttachedTabs.get(tabId)) {
    return { ok: true };
  }

  try {
    await new Promise((resolve, reject) => {
      chrome.debugger.detach({ tabId }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    // Detach errors are non-fatal, continue
  }
  cdpAttachedTabs.set(tabId, false);
  cachedAxTree.delete(tabId);
}

async function getAxTree(tabId) {
  if (cachedAxTree.has(tabId)) {
    return cachedAxTree.get(tabId);
  }

  const { result, error } = await cdpSendCommand(tabId, 'Accessibility.getFullAXTree');
  if (error || !result) {
    return [];
  }

  cachedAxTree.set(tabId, result.nodes || []);
  return result.nodes || [];
}

async function getDomSnapshot(tabId) {
  const { result, error } = await cdpSendCommand(tabId, 'DOMSnapshot.captureSnapshot', {
    computeDEXT: true,
    includeDOMRects: true,
    includePaintOrder: true,
  });
  if (error || !result) {
    return null;
  }
  return result;
}

async function getEventListenersForNode(tabId, backendNodeId) {
  if (!backendNodeId) return [];

  const { result, error } = await cdpSendCommand(tabId, 'Runtime.evaluate', {
    expression: `(function() {
      try {
        const nodes = DOM.requestChildNodes(DOM.getFlattenedDocument());
        const flat = [];
        function flatten(node) {
          flat.push(node);
          if (node.children) node.children.forEach(flatten);
        }
        flat.forEach(function(n) {
          if (n.backendNodeId === ${backendNodeId} && n.node && n.node.value) {
            const el = n.node.value;
            if (el && typeof el.getEventListeners === 'function') {
              const listeners = el.getEventListeners(el) || [];
              return listeners.map(function(l) { return l.type; });
            }
          }
        });
        return [];
      } catch(e) { return []; }
    })()`,
    returnByValue: true,
  });

  if (error || !result?.result?.value) return [];
  return result.result.value || [];
}

async function getBackendNodeIdForXPath(tabId, xpath) {
  const { result, error } = await cdpSendCommand(tabId, 'Runtime.evaluate', {
    expression: `(function() {
      try {
        const result = document.evaluate('${xpath.replace(/'/g, "\\'")}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (!result.singleNodeValue) return null;
        const node = result.singleNodeValue;
        const dom = DOM.getDocument();
        const nodeId = DOM.requestChildNodes(dom.node.contentDocument ? dom.node.contentDocument : dom.node, true);
        return null;
      } catch(e) { return null; }
    })()`,
    returnByValue: true,
  });

  if (error || !result?.result?.value) return null;
  return result.result.value;
}

function findAxNodeByRoleAndName(axNodes, role, name, text) {
  if (!axNodes || axNodes.length === 0) return null;

  const nameLower = (name || '').toLowerCase();
  const textLower = (text || '').toLowerCase();
  const roleLower = (role || '').toLowerCase();

  let best = null;
  let bestScore = 0;

  for (const node of axNodes) {
    const nodeRole = (node.role?.value || '').toLowerCase();
    const nodeName = (node.name?.value || '').toLowerCase();

    if (roleLower && nodeRole !== roleLower) continue;

    let score = 0;
    if (nodeRole === roleLower) score += 10;
    if (nameLower && nodeName.includes(nameLower)) score += 5;
    if (nameLower && nodeName === nameLower) score += 3;
    if (textLower && nodeName.includes(textLower)) score += 2;

    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }

  return bestScore >= 2 ? best : null;
}

function parseAxProperties(axNode) {
  if (!axNode) return null;

  const props = {};
  if (axNode.role?.value) props.role = axNode.role.value;
  if (axNode.name?.value) props.name = axNode.name.value;

  if (axNode.properties) {
    for (const p of axNode.properties) {
      const val = p.value?.value ?? p.value ?? null;
      if (val === null) continue;
      switch (p.name) {
        case 'focusable': props.focusable = val; break;
        case 'focused': props.focused = val; break;
        case 'checked': props.checked = val; break;
        case 'expanded': props.expanded = val; break;
        case 'pressed': props.pressed = val; break;
        case 'disabled': props.disabled = val; break;
        case 'readonly': props.readonly = val; break;
        case 'selected': props.selected = val; break;
        case 'valuemin': props.valueMin = val; break;
        case 'valuemax': props.valueMax = val; break;
        case 'valuenow': props.valueNow = val; break;
        case 'valuetext': props.valueText = val; break;
        case 'autocomplete': props.autocomplete = val; break;
        case 'haspopup': props.hasPopup = val; break;
        case 'level': props.level = val; break;
        case 'setsize': props.setSize = val; break;
        case 'posinset': props.posInSet = val; break;
        case 'invalid': props.invalid = val; break;
      }
    }
  }

  if (axNode.state) {
    for (const s of axNode.state) {
      switch (s) {
        case 'disabled': props.disabled = true; break;
        case 'hidden': props.hidden = true; break;
        case 'invisible': props.invisible = true; break;
        case 'focused': props.focused = true; break;
        case 'checked': props.checked = true; break;
        case 'expanded': props.expanded = true; break;
        case 'pressed': props.pressed = true; break;
        case 'selected': props.selected = true; break;
      }
    }
  }

  return props;
}

async function enrichElements(tabId, elements) {
  if (!isAttached(tabId)) {
    const attachResult = await attachDebugger(tabId);
    if (!attachResult.ok) {
      return { elements, enriched: false, reason: 'debugger attach failed: ' + attachResult.error };
    }
  }

  // Fetch AX tree once per session
  const axNodes = await getAxTree(tabId);
  if (!axNodes || axNodes.length === 0) {
    return { elements, enriched: false, reason: 'empty AX tree' };
  }

  // Get DOM snapshot for paint order and rects
  const snapshot = await getDomSnapshot(tabId);
  const domRects = new Map();
  if (snapshot?.domNodes) {
    for (const node of snapshot.domNodes) {
      if (node.backendNodeId && node.layout?.boundingBox) {
        const box = node.layout.boundingBox;
        domRects.set(node.backendNodeId, {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        });
      }
    }
  }

  const enriched = elements.map((el) => {
    const enriched = { ...el };

    // Find matching AX node
    const axNode = findAxNodeByRoleAndName(axNodes, el.role, el['aria-label'], el.text);
    if (axNode) {
      const axProps = parseAxProperties(axNode);
      if (axProps) {
        if (axProps.role) enriched.axRole = axProps.role;
        if (axProps.name) enriched.axName = axProps.name;
        if (axProps.focusable !== undefined) enriched.axFocusable = axProps.focusable;
        if (axProps.focused !== undefined) enriched.axFocused = axProps.focused;
        if (axProps.checked !== undefined) enriched.axChecked = axProps.checked;
        if (axProps.expanded !== undefined) enriched.axExpanded = axProps.expanded;
        if (axProps.pressed !== undefined) enriched.axPressed = axProps.pressed;
        if (axProps.disabled !== undefined) enriched.axDisabled = axProps.disabled;
        if (axProps.readonly !== undefined) enriched.axReadonly = axProps.readonly;
        if (axProps.selected !== undefined) enriched.axSelected = axProps.selected;
        if (axProps.valueMin !== undefined) enriched.axValueMin = axProps.valueMin;
        if (axProps.valueMax !== undefined) enriched.axValueMax = axProps.valueMax;
        if (axProps.valueNow !== undefined) enriched.axValueNow = axProps.valueNow;
        if (axProps.valueText) enriched.axValueText = axProps.valueText;
        if (axProps.autocomplete) enriched.axAutocomplete = axProps.autocomplete;
        if (axProps.hasPopup) enriched.axHasPopup = axProps.hasPopup;
        if (axProps.level !== undefined) enriched.axLevel = axProps.level;
        if (axProps.setSize !== undefined) enriched.axSetSize = axProps.setSize;
        if (axProps.posInSet !== undefined) enriched.axPosInSet = axProps.posInSet;
        if (axProps.invalid !== undefined) enriched.axInvalid = axProps.invalid;
        if (axProps.hidden) enriched.axHidden = true;
        if (axProps.invisible) enriched.axInvisible = true;
      }
    }

    // Get DOM rect from snapshot
    if (el._backendNodeId && domRects.has(el._backendNodeId)) {
      enriched._domRect = domRects.get(el._backendNodeId);
    }

    return enriched;
  });

  return { elements: enriched, enriched: true };
}

function clearCache(tabId) {
  cachedAxTree.delete(tabId);
}
