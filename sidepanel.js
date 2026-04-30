// sidepanel.js - Side Panel UI Logic

const state = {
  messages: [],
  settings: { apiKey: '', provider: 'openrouter', model: '', systemPrompt: '', theme: 'dark', preset: 'default', language: 'en', vaultPath: '', fontSize: 'medium' },
  pageContext: null,
  isLoading: false,
  allModels: [],
  autoVault: false,
  currentVaultFilename: null,
  vaultDirHandle: null,
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
    btnVaultOn: 'Vault on — click to disable',
    btnVaultOff: 'Vault off — click to enable',
    btnVaultNotSet: 'No vault selected — click to select',
    btnVaultReauth: 'Vault saved — click to re-authorize',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Get API key →',
    settingsVaultTitle: 'Obsidian Vault',
    settingsVaultPath: 'Folder',
    settingsVaultPathPlaceholder: 'Click Select folder to choose your vault',
    settingsVaultPathHint: 'Notes are saved directly to your vault.',
    settingsSelectFolder: 'Select folder',
    settingsChangeFolder: 'Change folder',
    settingsFontSize: 'Font size',
    settingsCurrentModel: 'Current Model',
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
    btnVaultOn: 'Magazyn włączony — kliknij by wyłączyć',
    btnVaultOff: 'Magazyn wyłączony — kliknij by włączyć',
    btnVaultNotSet: 'Nie wybrano magazynu — kliknij by wybrać',
    btnVaultReauth: 'Magazyn zapisany — kliknij by autoryzować ponownie',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Pobierz klucz API →',
    settingsVaultTitle: 'Magazyn Obsidian',
    settingsVaultPath: 'Folder',
    settingsVaultPathPlaceholder: 'Kliknij Wybierz folder aby wybrać magazyn',
    settingsVaultPathHint: 'Notatki są zapisywane bezpośrednio w magazynie.',
    settingsSelectFolder: 'Wybierz folder',
    settingsChangeFolder: 'Zmień folder',
    settingsFontSize: 'Wielkość czcionki',
    settingsCurrentModel: 'Aktualny model',
  },
  es: {
    msgLabelYou: 'Tú',
    msgLabelClaude: 'OpenAgent',
    inputPlaceholder: 'Envía un mensaje a OpenAgent...',
    emptyStateText: 'Pregúntale a OpenAgent cualquier cosa sobre la página actual.',
    statusApiKeyNeeded: 'Establece la clave API en Ajustes',
    statusModel: 'Modelo:',
    statusPageContextLoaded: 'Contexto de página cargado',
    statusVaultReady: 'Almacén listo',
    statusVaultNotSet: 'Selecciona carpeta del almacén en Ajustes',
    settingsTitle: 'Ajustes',
    settingsApiKey: 'Clave API',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsModelSearch: 'Buscar modelo',
    settingsModelSearchPlaceholder: 'Filtrar modelos...',
    settingsModel: 'Modelo',
    settingsSystemPrompt: 'Prompt del sistema',
    settingsSystemPromptPlaceholder: 'Instrucciones opcionales...',
    settingsBaseTheme: 'Base',
    settingsPreset: 'Estilo',
    settingsThemeDark: 'Oscuro',
    settingsThemeLight: 'Claro',
    settingsLanguage: 'Idioma',
    settingsSaved: 'Guardado',
    settingsEnterApiKey: 'Introduce la clave API en Ajustes',
    settingsLoading: 'Cargando...',
    settingsModelsHint: 'modelos disponibles',
    settingsNoModels: 'Sin modelos',
    btnSave: 'Guardar',
    btnClear: 'Borrar conversación',
    btnReadPage: 'Leer esta página',
    btnSettings: 'Ajustes',
    btnVault: 'Seleccionar carpeta del almacén',
    btnVaultOn: 'Almacén activado — clic para desactivar',
    btnVaultOff: 'Almacén desactivado — clic para activar',
    btnVaultNotSet: 'Ningún almacén seleccionado — clic para seleccionar',
    btnVaultReauth: 'Almacén guardado — clic para reautorizar',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Obtener clave API →',
    settingsVaultTitle: 'Bóveda de Obsidian',
    settingsVaultPath: 'Carpeta',
    settingsVaultPathPlaceholder: 'Haz clic en Seleccionar carpeta para elegir tu bóveda',
    settingsVaultPathHint: 'Las notas se guardan directamente en tu bóveda.',
    settingsSelectFolder: 'Seleccionar carpeta',
    settingsChangeFolder: 'Cambiar carpeta',
    settingsFontSize: 'Tamaño de fuente',
    settingsCurrentModel: 'Modelo actual',
  },
  fr: {
    msgLabelYou: 'Vous',
    msgLabelClaude: 'OpenAgent',
    inputPlaceholder: 'Envoyez un message à OpenAgent...',
    emptyStateText: 'Posez à OpenAgent n\'importe quelle question sur la page actuelle.',
    statusApiKeyNeeded: 'Définissez la clé API dans les Paramètres',
    statusModel: 'Modèle :',
    statusPageContextLoaded: 'Contexte de la page chargé',
    statusVaultReady: 'Coffre prêt',
    statusVaultNotSet: 'Sélectionnez le dossier du coffre dans les Paramètres',
    settingsTitle: 'Paramètres',
    settingsApiKey: 'Clé API',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsModelSearch: 'Recherche de modèle',
    settingsModelSearchPlaceholder: 'Filtrer les modèles...',
    settingsModel: 'Modèle',
    settingsSystemPrompt: 'Prompt système',
    settingsSystemPromptPlaceholder: 'Instructions optionnelles...',
    settingsBaseTheme: 'Base',
    settingsPreset: 'Style',
    settingsThemeDark: 'Sombre',
    settingsThemeLight: 'Clair',
    settingsLanguage: 'Langue',
    settingsSaved: 'Enregistré',
    settingsEnterApiKey: 'Entrez la clé API dans les Paramètres',
    settingsLoading: 'Chargement...',
    settingsModelsHint: 'modèles disponibles',
    settingsNoModels: 'Aucun modèle',
    btnSave: 'Enregistrer',
    btnClear: 'Effacer la conversation',
    btnReadPage: 'Lire cette page',
    btnSettings: 'Paramètres',
    btnVault: 'Sélectionner le dossier du coffre',
    btnVaultOn: 'Coffre activé — clic pour désactiver',
    btnVaultOff: 'Coffre désactivé — clic pour activer',
    btnVaultNotSet: 'Aucun coffre sélectionné — clic pour sélectionner',
    btnVaultReauth: 'Coffre enregistré — clic pour réautoriser',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Obtenir une clé API →',
    settingsVaultTitle: 'Coffre Obsidian',
    settingsVaultPath: 'Dossier',
    settingsVaultPathPlaceholder: 'Cliquez sur Sélectionner un dossier pour choisir votre coffre',
    settingsVaultPathHint: 'Les notes sont enregistrées directement dans votre coffre.',
    settingsSelectFolder: 'Sélectionner un dossier',
    settingsChangeFolder: 'Modifier le dossier',
    settingsFontSize: 'Taille de police',
    settingsCurrentModel: 'Modèle actuel',
  },
  de: {
    msgLabelYou: 'Sie',
    msgLabelClaude: 'OpenAgent',
    inputPlaceholder: 'Nachricht an OpenAgent...',
    emptyStateText: 'Fragen Sie OpenAgent alles über die aktuelle Seite.',
    statusApiKeyNeeded: 'API-Schlüssel in Einstellungen festlegen',
    statusModel: 'Modell:',
    statusPageContextLoaded: 'Seitenkontext geladen',
    statusVaultReady: 'Tresor bereit',
    statusVaultNotSet: 'Tresor-Ordner in Einstellungen auswählen',
    settingsTitle: 'Einstellungen',
    settingsApiKey: 'API-Schlüssel',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsModelSearch: 'Modellsuche',
    settingsModelSearchPlaceholder: 'Modelle filtern...',
    settingsModel: 'Modell',
    settingsSystemPrompt: 'System-Prompt',
    settingsSystemPromptPlaceholder: 'Optionale Anweisungen...',
    settingsBaseTheme: 'Basis',
    settingsPreset: 'Stil',
    settingsThemeDark: 'Dunkel',
    settingsThemeLight: 'Hell',
    settingsLanguage: 'Sprache',
    settingsSaved: 'Gespeichert',
    settingsEnterApiKey: 'API-Schlüssel in Einstellungen eingeben',
    settingsLoading: 'Laden...',
    settingsModelsHint: 'Modelle verfügbar',
    settingsNoModels: 'Keine Modelle',
    btnSave: 'Speichern',
    btnClear: 'Konversation löschen',
    btnReadPage: 'Diese Seite lesen',
    btnSettings: 'Einstellungen',
    btnVault: 'Tresor-Ordner auswählen',
    btnVaultOn: 'Tresor aktiviert — klicken zum Deaktivieren',
    btnVaultOff: 'Tresor deaktiviert — klicken zum Aktivieren',
    btnVaultNotSet: 'Kein Tresor ausgewählt — klicken zum Auswählen',
    btnVaultReauth: 'Tresor gespeichert — klicken zum Erneut autorisieren',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'API-Schlüssel erhalten →',
    settingsVaultTitle: 'Obsidian-Tresor',
    settingsVaultPath: 'Ordner',
    settingsVaultPathPlaceholder: 'Klicken Sie auf Ordner auswählen, um Ihren Tresor zu wählen',
    settingsVaultPathHint: 'Notizen werden direkt in Ihrem Tresor gespeichert.',
    settingsSelectFolder: 'Ordner auswählen',
    settingsChangeFolder: 'Ordner ändern',
    settingsFontSize: 'Schriftgröße',
    settingsCurrentModel: 'Aktuelles Modell',
  },
  ru: {
    msgLabelYou: 'Вы',
    msgLabelClaude: 'OpenAgent',
    inputPlaceholder: 'Напишите OpenAgent...',
    emptyStateText: 'Задайте OpenAgent вопрос о текущей странице.',
    statusApiKeyNeeded: 'Установите API-ключ в Настройках',
    statusModel: 'Модель:',
    statusPageContextLoaded: 'Контекст страницы загружен',
    statusVaultReady: 'Хранилище готово',
    statusVaultNotSet: 'Выберите папку хранилища в Настройках',
    settingsTitle: 'Настройки',
    settingsApiKey: 'API-ключ',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsModelSearch: 'Поиск модели',
    settingsModelSearchPlaceholder: 'Фильтровать модели...',
    settingsModel: 'Модель',
    settingsSystemPrompt: 'Системный промпт',
    settingsSystemPromptPlaceholder: 'Дополнительные инструкции...',
    settingsBaseTheme: 'База',
    settingsPreset: 'Стиль',
    settingsThemeDark: 'Тёмный',
    settingsThemeLight: 'Светлый',
    settingsLanguage: 'Язык',
    settingsSaved: 'Сохранено',
    settingsEnterApiKey: 'Введите API-ключ в Настройках',
    settingsLoading: 'Загрузка...',
    settingsModelsHint: 'моделей доступно',
    settingsNoModels: 'Нет моделей',
    btnSave: 'Сохранить',
    btnClear: 'Очистить разговор',
    btnReadPage: 'Прочитать эту страницу',
    btnSettings: 'Настройки',
    btnVault: 'Выбрать папку хранилища',
    btnVaultOn: 'Хранилище включено — нажмите для выключения',
    btnVaultOff: 'Хранилище выключено — нажмите для включения',
    btnVaultNotSet: 'Хранилище не выбрано — нажмите для выбора',
    btnVaultReauth: 'Хранилище сохранено — нажмите для повторной авторизации',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Получить API-ключ →',
    settingsVaultTitle: 'Хранилище Obsidian',
    settingsVaultPath: 'Папка',
    settingsVaultPathPlaceholder: 'Нажмите Выбрать папку, чтобы выбрать хранилище',
    settingsVaultPathHint: 'Заметки сохраняются напрямую в хранилище.',
    settingsSelectFolder: 'Выбрать папку',
    settingsChangeFolder: 'Изменить папку',
    settingsFontSize: 'Размер шрифта',
    settingsCurrentModel: 'Текущая модель',
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
  currentModelDisplay: $('#currentModelDisplay'),
  modelList: $('#modelList'),
  modelSearch: $('#modelSearch'),
  modelHint: $('#modelHint'),
  headerCtx: $('#headerCtx'),
  systemPromptInput: $('#systemPromptInput'),
  settingsStatus: $('#settingsStatus'),
  status: $('#status'),
  themeDark: $('#themeDark'),
  themeLight: $('#themeLight'),
  themePreset: $('#themePreset'),
  langSelect: $('#langSelect'),
  fontSizeSelect: $('#fontSizeSelect'),
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

function applyFontSize(size) {
  document.body.dataset.fontSize = size;
}

// ─── Vault (File System Access API) ─────────────────────────────────────────

async function pickVaultFolder() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    state.vaultDirHandle = dirHandle;
    state.vaultReady = true;
    state.settings.vaultPath = dirHandle.name;
    dom.vaultPathInput.value = dirHandle.name;
    dom.vaultPathInput.title = 'Selected: ' + dirHandle.name;
    if (dom.vaultStatus) dom.vaultStatus.classList.add('ready', 'active');
    await sendBgMessage({
      type: 'settings.save',
      data: { ...state.settings },
    });
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

async function vaultWrite(filename, content, append = false) {
  if (!state.vaultDirHandle) {
    if (state.settings.vaultPath) {
      return { error: 'Vault folder access expired — click the Obsidian button to re-authorize.' };
    }
    return { error: 'No vault selected. Go to Settings to pick your vault folder.' };
  }
  try {
    const fileHandle = await state.vaultDirHandle.getFileHandle(filename, { create: true });
    if (append) {
      try {
        const file = await fileHandle.getFile();
        const existing = await file.text();
        content = existing + '\n\n---\n\n' + content;
      } catch {}
    }
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return { ok: true, path: filename };
  } catch (err) {
    return { error: err.message };
  }
}

function getOrCreateSessionFilename() {
  if (state.currentVaultFilename) return state.currentVaultFilename;
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
  const pageTitle = state.pageContext?.metadata?.title || state.pageContext?.title || 'OpenAgent';
  const safeTitle = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  state.currentVaultFilename = `openagent-${safeTitle}-${dateStr}-${timeStr}.md`;
  return state.currentVaultFilename;
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
  dom.fontSizeSelect.value = state.settings.fontSize;
  applyFontSize(state.settings.fontSize);
  renderMessages();
  bindEvents();
  loadModels();
  updateModelBadge();
  collectPageContext();
}

function updateVaultBtn() {
  const hasHandle = !!state.vaultDirHandle;
  const hasPath = !!state.settings.vaultPath;
  const isOn = state.autoVault;

  dom.vaultBtn.classList.toggle('active', hasHandle && isOn);
  if (dom.vaultStatus) dom.vaultStatus.classList.toggle('ready', hasHandle);

  if (!hasPath) {
    dom.vaultBtn.title = i18n('btnVaultNotSet');
  } else if (hasHandle) {
    dom.vaultBtn.title = isOn ? i18n('btnVaultOn') : i18n('btnVaultOff');
  } else {
    dom.vaultBtn.title = i18n('btnVaultReauth');
  }
}

function toggleVaultOnBtn() {
  if (!state.vaultDirHandle) return;
  state.autoVault = !state.autoVault;
  saveAutoVault();
  updateVaultBtn();
  setStatus(state.autoVault ? i18n('statusVaultReady') : i18n('btnVaultOff'), state.autoVault ? 'success' : 'info');
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

  dom.fontSizeSelect.addEventListener('change', () => {
    state.settings.fontSize = dom.fontSizeSelect.value;
    applyFontSize(state.settings.fontSize);
    sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
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
    if (state.vaultDirHandle) {
      toggleVaultOnBtn();
    } else if (state.settings.vaultPath) {
      // Vault path was saved but handle expired — re-authorize
      pickVaultFolder();
    } else {
      pickVaultFolder();
    }
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
    updateCurrentModelDisplay();
    dom.systemPromptInput.value = state.settings.systemPrompt || '';

    if (state.settings.vaultPath) {
      dom.vaultPathInput.value = state.settings.vaultPath;
      dom.vaultPathInput.title = 'Selected: ' + state.settings.vaultPath;
    }
    // vaultDirHandle is session-only (FileSystemDirectoryHandle not serializable).
    // vaultReady reflects whether we have an active handle, not just a saved path.
    // The user must re-authorize via pickVaultFolder() after page reload.
    state.vaultReady = false;

    const autoData = await sendBgMessage({ type: 'autovault.load' });
    state.autoVault = autoData?.autoVault || false;
    updateVaultBtn();
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
  const vaultPath = dom.vaultPathInput.value.trim();
  const fontSize = dom.fontSizeSelect.value;

  try {
    await sendBgMessage({
      type: 'settings.save',
      data: { apiKey, provider: 'openrouter', model, systemPrompt, theme, preset, language, vaultPath },
    });
    state.settings = { apiKey, provider: 'openrouter', model, systemPrompt, theme, preset, language, vaultPath };
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
      updateCurrentModelDisplay();
      dom.modelHint.textContent = '✓ ' + name;
      setTimeout(() => {
        dom.modelHint.textContent = state.allModels.length + ' ' + i18n('settingsModelsHint');
      }, 2000);
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

      if (state.autoVault && state.vaultDirHandle) {
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

  if (dom.headerCtx) {
    dom.headerCtx.innerHTML = `
      <span class="ctx-dot"></span>
      <span class="ctx-title">${escapeHtml(metadata.title || 'Untitled')}</span>
    `;
  }
}

function clearConversation() {
  state.messages = [];
  state.pageContext = null;
  state.currentVaultFilename = null;
  if (dom.headerCtx) dom.headerCtx.innerHTML = '';
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
    dom.status.textContent = i18n('statusModel') + ' ' + (model.includes('/') ? model.split('/')[1].replace(/-(?:2024|2025)[0-9]*$/, '') : model);
    dom.status.className = 'status';
  }
}

function updateCurrentModelDisplay() {
  const model = state.settings.model;
  if (model) {
    const displayName = model.includes('/') ? model.split('/')[1].replace(/-(?:2024|2025)[0-9]*$/, '') : model;
    dom.currentModelDisplay.textContent = displayName;
    dom.currentModelDisplay.className = 'model-display';
  } else {
    dom.currentModelDisplay.textContent = '—';
    dom.currentModelDisplay.className = 'model-display empty';
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

  for (const match of readMatches) {
    const query = match[1] || '';
    const result = await vaultReadFiles(query, 20);
    if (result && !result.error && result.notes) {
      readResults.push(...result.notes);
    } else if (result?.error) {
      errors.push(`Read error: ${result.error}`);
    }
  }

  // Explicit filename: <vault_write filename="X.md">
  const explicitWrites = [...messageContent.matchAll(/<vault_write\s+filename="([^"]+\.md)"\s*>([\s\S]*?)<\/vault_write>/gi)];
  for (const match of explicitWrites) {
    const filename = match[1];
    const content = match[2].trim();
    const result = await vaultWrite(filename, content, false);
    if (result && !result.error) {
      writeResults.push(result.path);
    } else if (result?.error) {
      errors.push(`Write error: ${result.error}`);
    }
  }

  // Session file: <vault_write>content</vault_write> (no filename)
  const sessionWrites = [...messageContent.matchAll(/<vault_write>([\s\S]*?)<\/vault_write>/gi)];
  for (const match of sessionWrites) {
    const content = match[1].trim();
    if (!content) continue;
    const filename = getOrCreateSessionFilename();
    const result = await vaultWrite(filename, content, true);
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
  const filename = getOrCreateSessionFilename();
  const pageUrl = state.pageContext?.metadata?.url || state.pageContext?.url || '';

  const content = `# Session — ${dateStr} ${timeStr}\n\n` +
    (pageUrl ? `**URL:** ${pageUrl}\n` : '') +
    `\n---\n\n` +
    conversationText +
    `\n\n---\n*OpenAgent Chrome Extension*`;

  const result = await vaultWrite(filename, content, false);
  if (result?.error) {
    console.error('[SP] auto-vault failed:', result.error);
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