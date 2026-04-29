// sidepanel.js - Side Panel UI Logic

const state = {
  messages: [],
  settings: { apiKey: '', provider: 'openrouter', model: '', systemPrompt: '', theme: 'dark', preset: 'default', language: 'en' },
  pageContext: null,
  isLoading: false,
  allModels: [],
  autoVault: false,
  currentVaultFilename: null,
  vaultDirHandle: null, // File System Access API directory handle
  vaultReady: false,
};

const i18nStrings = {
  en: {
    msgLabelYou: 'You',
    msgLabelClaude: 'OpenAgent',
    inputPlaceholder: 'Message OpenAgent...',
    emptyStateText: 'Ask OpenAgent anything about the current page.',
    statusApiKeyNeeded: 'Set API key in Settings',
    statusModel: 'Model:',
    statusPageContextLoaded: 'Page context loaded',
    statusVaultReady: 'Vault ready',
    statusVaultNotSet: 'Select vault folder in Settings',
    settingsTitle: 'Settings',
    settingsApiKey: 'API Key',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsModelSearch: 'Model Search',
    settingsModelSearchPlaceholder: 'Filter models...',
    settingsModel: 'Model',
    settingsSystemPrompt: 'System Prompt',
    settingsSystemPromptPlaceholder: 'Optional instructions...',
    settingsBaseTheme: 'Base',
    settingsPreset: 'Preset',
    settingsThemeDark: 'Dark',
    settingsThemeLight: 'Light',
    settingsLanguage: 'Language',
    settingsSaved: 'Saved',
    settingsEnterApiKey: 'Enter API key in Settings',
    settingsLoading: 'Loading...',
    settingsModelsHint: 'models available',
    settingsNoModels: 'No models',
    btnSave: 'Save',
    btnClear: 'Clear conversation',
    btnReadPage: 'Read this page',
    btnSettings: 'Settings',
    btnVault: 'Select vault folder',
    btnVaultOn: 'Vault ready — click to change',
    btnVaultOff: 'No vault selected — click to select',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Get API key →',
    settingsVaultTitle: 'Obsidian Vault',
    settingsVaultPath: 'Folder',
    settingsVaultPathPlaceholder: 'Click Select folder to choose your vault',
    settingsVaultPathHint: 'Notes are saved directly to your vault.',
    settingsSelectFolder: 'Select folder',
    settingsChangeFolder: 'Change folder',
  },
  pl: {
    msgLabelYou: 'Ty',
    msgLabelClaude: 'OpenAgent',
    extensionName: 'OpenAgent',
    inputPlaceholder: 'Napisz do OpenAgent...',
    emptyStateText: 'Zadaj OpenAgentowi pytanie o aktualną stronę.',
    statusApiKeyNeeded: 'Ustaw klucz API w Ustawieniach',
    statusModel: 'Model:',
    statusPageContextLoaded: 'Kontekst strony wczytany',
    statusVaultReady: 'Magazyn gotowy',
    statusVaultNotSet: 'Wybierz folder magazynu w Ustawieniach',
    settingsTitle: 'Ustawienia',
    settingsApiKey: 'Klucz API',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsModelSearch: 'Szukaj modelu',
    settingsModelSearchPlaceholder: 'Filtruj modele...',
    settingsModel: 'Model',
    settingsSystemPrompt: 'System Prompt',
    settingsSystemPromptPlaceholder: 'Opcjonalne instrukcje...',
    settingsBaseTheme: 'Baza',
    settingsPreset: 'Styl',
    settingsThemeDark: 'Ciemny',
    settingsThemeLight: 'Jasny',
    settingsLanguage: 'Język',
    settingsSaved: 'Zapisano',
    settingsEnterApiKey: 'Wpisz klucz API w Ustawieniach',
    settingsLoading: 'Ładowanie...',
    settingsModelsHint: 'modeli dostępnych',
    settingsNoModels: 'Brak modeli',
    btnSave: 'Zapisz',
    btnClear: 'Wyczyść rozmowę',
    btnReadPage: 'Wczytaj stronę',
    btnSettings: 'Ustawienia',
    btnVault: 'Wybierz folder magazynu',
    btnVaultOn: 'Magazyn gotowy — kliknij by zmienić',
    btnVaultOff: 'Nie wybrano magazynu — kliknij by wybrać',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Pobierz klucz API →',
    settingsVaultTitle: 'Magazyn Obsidian',
    settingsVaultPath: 'Folder',
    settingsVaultPathPlaceholder: 'Kliknij Wybierz folder aby wybrać magazyn',
    settingsVaultPathHint: 'Notatki są zapisywane bezpośrednio w magazynie.',
    settingsSelectFolder: 'Wybierz folder',
    settingsChangeFolder: 'Zmień folder',
  },
};

// ─── DOM ─────────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

const dom = {
  messages: $('#messages'),
  input: $('#input'),
  sendBtn: $('#sendBtn'),
  collectBtn: $('#collectBtn'),
  vaultBtn: $('#vaultBtn'),
  clearBtn: $('#clearBtn'),
  settingsBtn: $('#settingsBtn'),
  settingsModal: $('#settingsModal'),
  closeSettings: $('#closeSettings'),
  saveSettings: $('#saveSettings'),
  apiKeyInput: $('#apiKeyInput'),
  modelList: $('#modelList'),
  modelSearch: $('#modelSearch'),
  modelHint: $('#modelHint'),
  modelBadge: $('#modelBadge'),
  systemPromptInput: $('#systemPromptInput'),
  settingsStatus: $('#settingsStatus'),
  status: $('#status'),
  themeDark: $('#themeDark'),
  themeLight: $('#themeLight'),
  themePreset: $('#themePreset'),
  langSelect: $('#langSelect'),
  vaultPathInput: $('#vaultPathInput'),
  vaultSelectBtn: $('#vaultSelectBtn'),
  vaultStatus: $('#vaultStatusDot'),
};

// ─── i18n ────────────────────────────────────────────────────────────────────

function i18n(key) {
  return i18nStrings[state.settings.language ?? 'en']?.[key] || key;
}

function applyI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = i18n(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = i18n(el.dataset.i18nPlaceholder);
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.title = i18n(el.dataset.i18nTitle);
  }
  dom.input.placeholder = i18n('inputPlaceholder');
  if (dom.langSelect) {
    for (const opt of dom.langSelect.options) {
      const key = opt.dataset.i18n;
      if (key) opt.textContent = i18n(key);
    }
  }
  if (dom.themeDark) dom.themeDark.textContent = i18n('settingsThemeDark');
  if (dom.themeLight) dom.themeLight.textContent = i18n('settingsThemeLight');
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(theme, preset = 'default') {
  document.body.classList.toggle('light', theme === 'light');
  document.body.dataset.preset = preset;
  dom.themeDark.classList.toggle('active', theme === 'dark');
  dom.themeLight.classList.toggle('active', theme === 'light');
}

// ─── Vault (File System Access API) ─────────────────────────────────────────

async function pickVaultFolder() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    state.vaultDirHandle = dirHandle;
    state.vaultReady = true;
    dom.vaultPathInput.value = dirHandle.name;
    dom.vaultPathInput.title = 'Selected: ' + dirHandle.name;
    if (dom.vaultStatus) dom.vaultStatus.classList.add('ready');
    updateVaultBtn();
    setStatus(i18n('statusVaultReady'), 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      setStatus('Vault error: ' + err.message, 'error');
    }
  }
}

// Vault is accessible as long as the side panel is open.
// The user picks the folder once per session via the icon or Settings.
// The AI uses <vault_read> and <vault_write> XML tags in responses.

async function vaultWrite(filename, content) {
  if (!state.vaultDirHandle) {
    return { error: 'No vault selected. Go to Settings to pick your vault folder.' };
  }
  try {
    const fileHandle = await state.vaultDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return { ok: true, path: filename };
  } catch (err) {
    return { error: err.message };
  }
}

async function vaultReadFiles(query = '', limit = 20) {
  if (!state.vaultDirHandle) {
    return { error: 'No vault selected', notes: [] };
  }
  const notes = [];
  try {
    for await (const entry of state.vaultDirHandle.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue;
      if (notes.length >= limit) break;
      try {
        const file = await entry.getFile();
        const text = await file.text();
        const q = query.toLowerCase();
        if (!query || text.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q)) {
          notes.push({ filename: entry.name, content: text });
        }
      } catch {}
    }
  } catch (err) {
    return { error: err.message, notes };
  }
  return { notes };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadSettings();
  applyI18n();
  applyTheme(state.settings.theme, state.settings.preset);
  dom.langSelect.value = state.settings.language;
  dom.themePreset.value = state.settings.preset || 'default';
  renderMessages();
  bindEvents();
  loadModels();
  updateModelBadge();
  loadAutoVaultState();
  collectPageContext();
}

// ─── Auto Vault ───────────────────────────────────────────────────────────────

async function loadAutoVaultState() {
  try {
    const data = await sendBgMessage({ type: 'autovault.load' });
    state.autoVault = data?.autoVault || false;
    updateVaultBtn();
  } catch {}
}

function updateVaultBtn() {
  if (state.vaultReady) {
    dom.vaultBtn.classList.add('active');
    dom.vaultBtn.title = i18n('btnVaultOn');
    if (dom.vaultStatus) dom.vaultStatus.classList.add('ready');
    setStatus(i18n('statusVaultReady'), 'success');
  } else {
    dom.vaultBtn.classList.remove('active');
    dom.vaultBtn.title = i18n('btnVaultOff');
    if (dom.vaultStatus) dom.vaultStatus.classList.remove('ready');
  }
}

async function saveAutoVault() {
  try {
    await sendBgMessage({ type: 'autovault.save', enabled: state.autoVault });
  } catch {}
}

// ─── Events ──────────────────────────────────────────────────────────────────

function bindEvents() {
  dom.sendBtn.addEventListener('click', handleSend);
  dom.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  dom.input.addEventListener('input', () => {
    dom.input.style.height = 'auto';
    dom.input.style.height = Math.min(dom.input.scrollHeight, 100) + 'px';
  });

  dom.settingsBtn.addEventListener('click', () => toggleModal(true));
  dom.closeSettings.addEventListener('click', () => toggleModal(false));
  dom.settingsModal.addEventListener('click', (e) => {
    if (e.target === dom.settingsModal) toggleModal(false);
  });
  dom.saveSettings.addEventListener('click', handleSaveSettings);

  dom.apiKeyInput.addEventListener('change', () => {
    state.settings.apiKey = dom.apiKeyInput.value.trim();
    loadModels();
  });

  dom.themeDark.addEventListener('click', () => {
    state.settings.theme = 'dark';
    applyTheme('dark', state.settings.preset);
  });

  dom.themeLight.addEventListener('click', () => {
    state.settings.theme = 'light';
    applyTheme('light', state.settings.preset);
  });

  dom.themePreset.addEventListener('change', () => {
    state.settings.preset = dom.themePreset.value;
    applyTheme(state.settings.theme, state.settings.preset);
  });

  dom.langSelect.addEventListener('change', () => {
    state.settings.language = dom.langSelect.value;
    applyI18n();
    if (state.allModels.length > 0) {
      dom.modelHint.textContent = state.allModels.length + ' ' + i18n('settingsModelsHint');
    }
    if (state.messages.length === 0) {
      renderEmptyState();
    }
    setStatus(i18n('settingsLanguage') + ' — ' + dom.langSelect.options[dom.langSelect.selectedIndex].text, 'success');
    sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
  });

  dom.collectBtn.addEventListener('click', collectPageContext);
  dom.clearBtn.addEventListener('click', clearConversation);

  dom.vaultBtn.addEventListener('click', () => {
    pickVaultFolder();
  });

  if (dom.vaultSelectBtn) {
    dom.vaultSelectBtn.addEventListener('click', () => pickVaultFolder());
  }

  dom.modelSearch.addEventListener('input', () => {
    filterModels(dom.modelSearch.value);
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const data = await sendBgMessage({ type: 'settings.load' });
    state.settings = { ...state.settings, ...data };
    dom.apiKeyInput.value = state.settings.apiKey || '';
    dom.systemPromptInput.value = state.settings.systemPrompt || '';
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function handleSaveSettings() {
  const apiKey = dom.apiKeyInput.value.trim();
  const model = state.settings.model;
  const systemPrompt = dom.systemPromptInput.value.trim();
  const theme = state.settings.theme;
  const preset = dom.themePreset.value;
  const language = state.settings.language;

  try {
    await sendBgMessage({
      type: 'settings.save',
      data: { apiKey, provider: 'openrouter', model, systemPrompt, theme, preset, language },
    });
    state.settings = { apiKey, provider: 'openrouter', model, systemPrompt, theme, preset, language };
    dom.settingsStatus.textContent = i18n('settingsSaved');
    dom.settingsStatus.className = 'settings-status';
    toggleModal(false);
    loadModels();
    updateModelBadge();
  } catch (err) {
    dom.settingsStatus.textContent = 'Error: ' + err.message;
    dom.settingsStatus.className = 'settings-status error';
  }
}

// ─── Model Loading ────────────────────────────────────────────────────────────

async function loadModels() {
  const apiKey = dom.apiKeyInput.value.trim() || state.settings.apiKey;

  dom.modelList.innerHTML = `<div class="model-loading">${i18n('settingsLoading')}</div>`;

  if (!apiKey) {
    dom.modelList.innerHTML = `<div class="model-loading">${i18n('settingsEnterApiKey')}</div>`;
    dom.modelHint.textContent = '';
    return;
  }

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const data = await resp.json();

    if (data.error) {
      dom.modelList.innerHTML = `<div class="model-loading">${escapeHtml(data.error.message || data.error)}</div>`;
      dom.modelHint.textContent = data.error.message || data.error;
      return;
    }

    state.allModels = data.data || [];
    renderModelList(state.allModels);

    const saved = state.settings.model;
    if (saved && state.allModels.find((m) => m.id === saved)) {
      selectModelItem(saved);
    } else if (state.allModels.length > 0) {
      state.settings.model = state.allModels[0].id;
      selectModelItem(state.allModels[0].id);
      await sendBgMessage({ type: 'settings.save', data: { ...state.settings } });
    }

    dom.modelHint.textContent = state.allModels.length + ' ' + i18n('settingsModelsHint');
    updateModelBadge();
  } catch (err) {
    dom.modelList.innerHTML = `<div class="model-loading">Error: ${escapeHtml(err.message)}</div>`;
    dom.modelHint.textContent = err.message;
  }
}

function renderModelList(models) {
  if (models.length === 0) {
    dom.modelList.innerHTML = `<div class="model-loading">${i18n('settingsNoModels')}</div>`;
    return;
  }
  dom.modelList.innerHTML = '';
  for (const model of models) {
    const item = document.createElement('div');
    item.className = 'model-item';
    item.dataset.modelId = model.id;
    const name = model.name || model.id || '';
    const provider = model.id?.includes('/') ? model.id.split('/')[0] : '';
    item.innerHTML = `
      <span class="model-name">${escapeHtml(name)}</span>
      <span class="model-provider">${escapeHtml(provider)}</span>
    `;
    item.addEventListener('click', async () => {
      selectModelItem(model.id);
      state.settings.model = model.id;
      await sendBgMessage({ type: 'settings.save', data: { ...state.settings } });
      updateModelBadge();
      setStatus(escapeHtml(name), 'success');
      setTimeout(() => toggleModal(false), 300);
    });
    dom.modelList.appendChild(item);
  }
}

function selectModelItem(modelId) {
  for (const el of dom.modelList.querySelectorAll('.model-item')) {
    el.classList.toggle('selected', el.dataset.modelId === modelId);
  }
}

function filterModels(query) {
  if (!query.trim()) {
    renderModelList(state.allModels);
    return;
  }
  const q = query.toLowerCase();
  renderModelList(state.allModels.filter(
    (m) => (m.id || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q)
  ));
}

// ─── Navigation ────────────────────────────────────────────────────────────────

async function handleNavigation(url, originalText) {
  dom.input.value = '';
  dom.input.style.height = 'auto';
  state.messages.push({ role: 'user', content: originalText });

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant';
  loadingDiv.innerHTML = `
    <div class="message-label">${i18n('msgLabelClaude')}</div>
    <div class="message-content" style="color: var(--muted); font-size: 12px;">
      Opening ${escapeHtml(url)}...
    </div>
  `;
  dom.messages.appendChild(loadingDiv);
  scrollToBottom();

  try {
    const actionResult = await sendBgMessage({
      type: 'page.navigate',
      url,
    });

    if (actionResult.error) {
      loadingDiv.querySelector('.message-content').textContent = actionResult.error;
      loadingDiv.querySelector('.message-content').style.color = '#f87171';
      state.messages.push({ role: 'assistant', content: actionResult.error });
      return;
    }

    loadingDiv.querySelector('.message-content').textContent = `Opened ${url}`;
    state.messages.push({ role: 'assistant', content: `Opened ${url}` });

    setTimeout(async () => {
      try {
        const data = await sendBgMessage({ type: 'page.collect' });
        if (!data.error && data.rawCapture) {
          state.pageContext = data.rawCapture;
          prependPageContext(data.rawCapture.metadata);
        }
      } catch {}
    }, 2000);
  } catch (err) {
    loadingDiv.querySelector('.message-content').textContent = `Error: ${err.message}`;
    loadingDiv.querySelector('.message-content').style.color = '#f87171';
    state.messages.push({ role: 'assistant', content: `Error: ${err.message}` });
  }
}

// ─── Send ─────────────────────────────────────────────────────────────────────

const NAV_PATTERNS = [
  /^(?:otw[oó]?rz|we?jd?[ií]?z?\s*(?:na|do)|przejd[źz]?\s*(?:do|na)|nawiguj?\s*(?:do|na)|id?[źz]?\s*(?:na|do|pod)|wyszukaj|search|go\s*to|navigate\s*to|open|visit)\s+(?:stron[ęy]?\s+)?(.+)/i,
  /^(?:https?:\/\/)?([a-z][a-z0-9-]*\.[a-z]{2,}(?:\/\S*)?)$/i,
];

function extractNavigationIntent(text) {
  const trimmed = text.trim();

  const match = trimmed.match(NAV_PATTERNS[0]);
  if (match) {
    let url = match[1].trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  const bareMatch = trimmed.match(NAV_PATTERNS[1]);
  if (bareMatch) {
    const url = bareMatch[1];
    if (!/^https?:\/\//i.test(url)) {
      return 'https://' + url;
    }
    return url;
  }

  return null;
}

async function handleSend() {
  const text = dom.input.value.trim();
  if (!text || state.isLoading) return;

  if (!state.settings.apiKey) {
    toggleModal(true);
    setStatus(i18n('statusApiKeyNeeded'), 'error');
    return;
  }

  const navUrl = extractNavigationIntent(text);
  if (navUrl) {
    await handleNavigation(navUrl, text);
    return;
  }

  dom.input.value = '';
  dom.input.style.height = 'auto';
  state.messages.push({ role: 'user', content: text });
  renderMessage('user', text);

  showTyping();
  state.isLoading = true;
  dom.sendBtn.disabled = true;

  try {
    const response = await sendBgMessage({
      type: 'prompt.send',
      conversationHistory: state.messages,
      pageContext: state.pageContext,
      autoVault: state.autoVault,
    });

    removeTyping();

    if (response.error) {
      renderMessage('error', response.error);
    } else {
      const content = response.content || '';
      const { readResults, writeResults, errors } = await processVaultToolCalls(content);
      let finalContent = content;
      if (errors.length > 0) {
        finalContent += '\n\n**Vault errors:**\n' + errors.join('\n');
      }
      if (writeResults.length > 0) {
        const confirmed = writeResults.map((p) => `✓ Saved: ${p.split('/').pop()}`).join('\n');
        finalContent = content.replace(/<vault_write[^>]*>[\s\S]*?<\/vault_write>/gi, '');
        finalContent += '\n\n' + confirmed;
      }
      if (readResults.length > 0) {
        const recalled = readResults.map((n) => `## ${n.filename}\n${n.content}`).join('\n\n---\n\n');
        finalContent += '\n\n**From vault:**\n' + recalled;
      }
      state.messages.push({ role: 'assistant', content: finalContent });
      renderMessage('assistant', finalContent);

      if (state.autoVault && state.vaultReady) {
        saveAutoVaultNote().catch((err) => console.error('[SP] auto-vault error:', err));
      }
    }
  } catch (err) {
    removeTyping();
    renderMessage('error', err.message);
  } finally {
    state.isLoading = false;
    dom.sendBtn.disabled = false;
  }
}

// ─── Page Context ──────────────────────────────────────────────────────────────

async function collectPageContext() {
  try {
    const data = await sendBgMessage({ type: 'page.collect' });
    if (data.error) {
      setStatus(data.error, 'error');
      return;
    }
    if (!data.rawCapture) {
      setStatus('No page data received', 'error');
      return;
    }

    state.pageContext = data.rawCapture;
    if (data.rawCapture?.metadata) {
      prependPageContext(data.rawCapture.metadata);
      setStatus(i18n('statusPageContextLoaded'), 'success');
    }
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  }
}

function prependPageContext(metadata) {
  const existing = dom.messages.querySelector('.page-ctx');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'page-ctx';
  div.innerHTML = `
    <span class="ctx-dot"></span>
    <span class="ctx-title">${escapeHtml(metadata.title || 'Untitled')}</span>
    <span class="ctx-url">${escapeHtml(metadata.url || '')}</span>
  `;
  dom.messages.prepend(div);
}

function clearConversation() {
  state.messages = [];
  state.pageContext = null;
  state.currentVaultFilename = null;
  renderMessages();
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderMessages() {
  dom.messages.innerHTML = '';
  if (state.messages.length === 0) {
    renderEmptyState();
    return;
  }
  for (const msg of state.messages) {
    renderMessage(msg.role === 'user' ? 'user' : 'assistant', msg.content);
  }
  scrollToBottom();
}

function renderEmptyState() {
  dom.messages.innerHTML = `
    <div class="empty-state">
      <div class="empty-logo">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9"/>
          <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
        </svg>
      </div>
      <p>${i18n('emptyStateText')}</p>
    </div>
  `;
}

function renderMessage(role, content) {
  const empty = dom.messages.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `message ${role}`;
  const label = role === 'user' ? i18n('msgLabelYou') : i18n('msgLabelClaude');
  const formatted = formatContent(content);

  div.innerHTML = `
    <div class="message-label">${label}</div>
    <div class="message-content">${formatted}</div>
  `;
  dom.messages.appendChild(div);
  scrollToBottom();
}

function formatContent(text) {
  if (!text) return '';
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\n/g, '<br>');
  return escaped;
}

// ─── Browser Actions ────────────────────────────────────────────────────────────

function showTyping() {
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.id = 'typing';
  div.innerHTML = `
    <div class="message-label">${i18n('msgLabelClaude')}</div>
    <div class="message-content">
      <div class="typing-row">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  dom.messages.appendChild(div);
  scrollToBottom();
}

function removeTyping() {
  const el = document.getElementById('typing');
  if (el) el.remove();
}

// ─── Status ────────────────────────────────────────────────────────────────────

function setStatus(text, type = '') {
  dom.status.textContent = text;
  dom.status.className = 'status' + (type ? ` ${type}` : '');
  if (!type) {
    setTimeout(() => {
      if (dom.status.textContent === text) dom.status.classList.add('hidden');
    }, 3000);
  }
}

function updateModelBadge() {
  const model = state.settings.model;
  if (model) {
    const short = model.includes('/')
      ? model.split('/')[1].replace(/-(?:2024|2025)[0-9]*$/, '')
      : model;
    dom.modelBadge.textContent = short;
  } else {
    dom.modelBadge.textContent = '-';
  }
  if (model) {
    dom.status.textContent = i18n('statusModel') + ' ' + (model.includes('/') ? model.split('/')[1].replace(/-(?:2024|2025)[0-9]*$/, '') : model);
    dom.status.className = 'status';
  }
}

function toggleModal(open) {
  dom.settingsModal.classList.toggle('hidden', !open);
  if (open) dom.apiKeyInput.focus();
}

function scrollToBottom() {
  dom.messages.scrollTop = dom.messages.scrollHeight;
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

function sendBgMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Vault Tool Processing ─────────────────────────────────────────────────────

async function processVaultToolCalls(messageContent) {
  const readResults = [];
  const writeResults = [];
  const errors = [];

  const readMatches = [...messageContent.matchAll(/<vault_read\s+query="([^"]*)"\s*\/>/gi)];
  const writeMatches = [...messageContent.matchAll(/<vault_write\s+filename="([^"]+\.md)"\s*>([\s\S]*?)<\/vault_write>/gi)];

  for (const match of readMatches) {
    const query = match[1] || '';
    const result = await vaultReadFiles(query, 20);
    if (result && !result.error && result.notes) {
      readResults.push(...result.notes);
    } else if (result?.error) {
      errors.push(`Read error: ${result.error}`);
    }
  }

  for (const match of writeMatches) {
    const filename = match[1];
    const content = match[2].trim();
    const result = await vaultWrite(filename, content);
    if (result && !result.error) {
      writeResults.push(result.path);
    } else if (result?.error) {
      errors.push(`Write error: ${result.error}`);
    }
  }

  return { readResults, writeResults, errors };
}

// ─── Auto Vault Note ───────────────────────────────────────────────────────────

async function saveAutoVaultNote() {
  const conversationText = buildConversationText();
  if (!conversationText.trim()) return;

  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;

  if (!state.currentVaultFilename) {
    const pageTitle = state.pageContext?.metadata?.title || state.pageContext?.title || 'OpenAgent';
    const safeTitle = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
    state.currentVaultFilename = `openagent-${safeTitle}-${dateStr}-${timeStr}.md`;
  }

  const filename = state.currentVaultFilename;
  const pageUrl = state.pageContext?.metadata?.url || state.pageContext?.url || '';

  const content = `# Session — ${dateStr} ${timeStr}\n\n` +
    (pageUrl ? `**URL:** ${pageUrl}\n` : '') +
    `\n---\n\n` +
    conversationText +
    `\n\n---\n*OpenAgent Chrome Extension*`;

  const result = await vaultWrite(filename, content);
  if (result && !result.error) {
    console.log('[SP] auto-vault saved:', result.path);
  } else {
    console.error('[SP] auto-vault failed:', result?.error);
  }
}

function buildConversationText() {
  const lines = [];
  for (const msg of state.messages) {
    const role = msg.role === 'user' ? '**You**' : '**OpenAgent**';
    let content = msg.content || '';
    content = content.replace(/<vault_write[^>]*>[\s\S]*?<\/vault_write>/gi, '');
    content = content.replace(/<vault_read[^>]*\/>/gi, '');
    content = content.replace(/\*\*From vault:\*\*[\s\S]*/gi, '');
    content = content.replace(/^✓ Saved:.*$/gm, '');
    content = content.trim();
    if (content) {
      lines.push(`${role}:\n${content}\n`);
    }
  }
  return lines.join('\n');
}

// ─── Start ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);