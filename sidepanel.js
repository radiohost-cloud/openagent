// sidepanel.js - Side Panel UI Logic

const state = {
  messages: [],
  settings: { apiKey: '', provider: 'openrouter', model: '', systemPrompt: '', theme: 'dark', preset: 'default', language: 'en', vaultPath: '', vaultApiUrl: '', vaultApiToken: '', vaultMode: 'local', fontSize: 'medium' },
  pageContext: null,
  pageScreenshot: null,
  visionModels: [],
  isLoading: false,
  allModels: [],
  autoVault: false,
  currentVaultFilename: null,
  vaultDirHandle: null,
  vaultReady: false,
  vaultApiConnected: false,
  conversations: [],
  historyOpen: false,
  currentConversationId: null,
  memoryContext: null,
  contextDebounce: null,
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
    btnScreenshot: 'Take screenshot',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Get API key →',
    settingsVaultTitle: 'Obsidian Vault',
    settingsVaultModeLocal: 'Local folder',
    settingsVaultModeApi: 'REST API',
    settingsVaultPath: 'Folder',
    settingsVaultPathPlaceholder: 'Click Select folder to choose your vault',
    settingsVaultPathHint: 'Notes are saved directly to your vault.',
    settingsVaultApiUrl: 'API URL',
    settingsVaultApiUrlPlaceholder: 'https://127.0.0.1:27124',
    settingsVaultApiToken: 'API Token',
    settingsVaultApiTokenPlaceholder: 'Token from Local REST API plugin',
    settingsVaultApiHint: 'Requires Local REST API plugin in Obsidian.',
    settingsSelectFolder: 'Select folder',
    settingsChangeFolder: 'Change folder',
    settingsFontSize: 'Font size',
    settingsCurrentModel: 'Current Model',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo',
    statusScreenshotAttached: 'Screenshot attached',
    statusScreenshotFailed: 'Screenshot failed',
    statusScreenshotSkipped: 'Screenshot skipped',
    msgScreenshotSkippedModel: 'Model does not support image input. Switch to a vision model and take a new screenshot.',
    historyTitle: 'Chat History',
    historyEmpty: 'No saved conversations',
    btnHistory: 'Chat history',
    btnCopy: 'Copy',
    btnDelete: 'Delete',
    emptyStateUrl: 'or just type a URL to open it',
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
    btnScreenshot: 'Zrób zrzut ekranu',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Pobierz klucz API →',
    settingsVaultTitle: 'Magazyn Obsidian',
    settingsVaultModeLocal: 'Folder lokalny',
    settingsVaultModeApi: 'REST API',
    settingsVaultPath: 'Folder',
    settingsVaultPathPlaceholder: 'Kliknij Wybierz folder aby wybrać magazyn',
    settingsVaultPathHint: 'Notatki są zapisywane bezpośrednio w magazynie.',
    settingsVaultApiUrl: 'URL API',
    settingsVaultApiUrlPlaceholder: 'https://127.0.0.1:27124',
    settingsVaultApiToken: 'Token API',
    settingsVaultApiTokenPlaceholder: 'Token z wtyczki Local REST API',
    settingsVaultApiHint: 'Wymaga wtyczki Local REST API w Obsidian.',
    settingsSelectFolder: 'Wybierz folder',
    settingsChangeFolder: 'Zmień folder',
    settingsFontSize: 'Wielkość czcionki',
    settingsCurrentModel: 'Aktualny model',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo',
    statusScreenshotAttached: 'Zrzut ekranu załączony',
    statusScreenshotFailed: 'Zrzut ekranu nieudany',
    statusScreenshotSkipped: 'Zrzut ekranu pominięty',
    msgScreenshotSkippedModel: 'Model nie obsługuje obrazów. Przełącz na model z vision i zrób nowy zrzut.',
    historyTitle: 'Historia rozmów',
    historyEmpty: 'Brak zapisanych rozmów',
    btnHistory: 'Historia rozmów',
    btnCopy: 'Kopiuj',
    btnDelete: 'Usuń',
    emptyStateUrl: 'lub wpisz adres URL, aby go otworzyć',
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
    btnScreenshot: 'Tomar captura de pantalla',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Obtener clave API →',
    settingsVaultTitle: 'Bóveda de Obsidian',
    settingsVaultModeLocal: 'Carpeta local',
    settingsVaultModeApi: 'REST API',
    settingsVaultPath: 'Carpeta',
    settingsVaultPathPlaceholder: 'Haz clic en Seleccionar carpeta para elegir tu bóveda',
    settingsVaultPathHint: 'Las notas se guardan directamente en tu bóveda.',
    settingsVaultApiUrl: 'URL de API',
    settingsVaultApiUrlPlaceholder: 'https://127.0.0.1:27124',
    settingsVaultApiToken: 'Token de API',
    settingsVaultApiTokenPlaceholder: 'Token del plugin Local REST API',
    settingsVaultApiHint: 'Requiere el plugin Local REST API en Obsidian.',
    settingsSelectFolder: 'Seleccionar carpeta',
    settingsChangeFolder: 'Cambiar carpeta',
    settingsFontSize: 'Tamaño de fuente',
    settingsCurrentModel: 'Modelo actual',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo',
    statusScreenshotAttached: 'Captura adjunta',
    statusScreenshotFailed: 'Captura fallida',
    statusScreenshotSkipped: 'Captura omitida',
    msgScreenshotSkippedModel: 'El modelo no soporta imágenes. Cambia a un modelo vision y toma una nueva captura.',
    historyTitle: 'Historial de chat',
    historyEmpty: 'Sin conversaciones guardadas',
    btnHistory: 'Historial de chat',
    btnCopy: 'Copiar',
    btnDelete: 'Eliminar',
    emptyStateUrl: 'o escribe una URL para abrirla',
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
    btnScreenshot: 'Faire une capture d\'écran',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Obtenir une clé API →',
    settingsVaultTitle: 'Coffre Obsidian',
    settingsVaultModeLocal: 'Dossier local',
    settingsVaultModeApi: 'REST API',
    settingsVaultPath: 'Dossier',
    settingsVaultPathPlaceholder: 'Cliquez sur Sélectionner un dossier pour choisir votre coffre',
    settingsVaultPathHint: 'Les notes sont enregistrées directement dans votre coffre.',
    settingsVaultApiUrl: 'URL de API',
    settingsVaultApiUrlPlaceholder: 'https://127.0.0.1:27124',
    settingsVaultApiToken: "Jeton d'API",
    settingsVaultApiTokenPlaceholder: "Jeton du plugin Local REST API",
    settingsVaultApiHint: "Nécessite le plugin Local REST API dans Obsidian.",
    settingsSelectFolder: 'Sélectionner un dossier',
    settingsChangeFolder: 'Modifier le dossier',
    settingsFontSize: 'Taille de police',
    settingsCurrentModel: 'Modèle actuel',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo',
    statusScreenshotAttached: 'Capture jointe',
    statusScreenshotFailed: 'Capture échouée',
    statusScreenshotSkipped: 'Capture omise',
    msgScreenshotSkippedModel: 'Le modèle ne supporte pas les images. Passez à un modèle vision et prenez une nouvelle capture.',
    historyTitle: 'Historique du chat',
    historyEmpty: 'Aucune conversation sauvegardée',
    btnHistory: 'Historique du chat',
    btnDelete: 'Supprimer',
    emptyStateUrl: "ou tapez une URL pour l'ouvrir",
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
    btnScreenshot: 'Screenshot erstellen',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'API-Schlüssel erhalten →',
    settingsVaultTitle: 'Obsidian-Tresor',
    settingsVaultModeLocal: 'Lokaler Ordner',
    settingsVaultModeApi: 'REST API',
    settingsVaultPath: 'Ordner',
    settingsVaultPathPlaceholder: 'Klicken Sie auf Ordner auswählen, um Ihren Tresor zu wählen',
    settingsVaultPathHint: 'Notizen werden direkt in Ihrem Tresor gespeichert.',
    settingsVaultApiUrl: 'API-URL',
    settingsVaultApiUrlPlaceholder: 'https://127.0.0.1:27124',
    settingsVaultApiToken: 'API-Token',
    settingsVaultApiTokenPlaceholder: 'Token vom Local REST API Plugin',
    settingsVaultApiHint: 'Erfordert das Local REST API Plugin in Obsidian.',
    settingsSelectFolder: 'Ordner auswählen',
    settingsChangeFolder: 'Ordner ändern',
    settingsFontSize: 'Schriftgröße',
    settingsCurrentModel: 'Aktuelles Modell',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo',
    statusScreenshotAttached: 'Screenshot angehängt',
    statusScreenshotFailed: 'Screenshot fehlgeschlagen',
    statusScreenshotSkipped: 'Screenshot übersprungen',
    msgScreenshotSkippedModel: 'Modell unterstützt keine Bilder. Wechsle zu einem Vision-Modell und mach einen neuen Screenshot.',
    historyTitle: 'Chat-Verlauf',
    historyEmpty: 'Keine gespeicherten Gespräche',
    btnHistory: 'Chat-Verlauf',
    btnCopy: 'Kopieren',
    btnDelete: 'Löschen',
    emptyStateUrl: 'oder URL eingeben zum Öffnen',
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
    btnScreenshot: 'Сделать скриншот',
    langEnglish: 'English',
    langPolish: 'Polski',
    linkOpenrouterKeys: 'Получить API-ключ →',
    settingsVaultTitle: 'Хранилище Obsidian',
    settingsVaultModeLocal: 'Локальная папка',
    settingsVaultModeApi: 'REST API',
    settingsVaultPath: 'Папка',
    settingsVaultPathPlaceholder: 'Нажмите Выбрать папку, чтобы выбрать хранилище',
    settingsVaultPathHint: 'Заметки сохраняются напрямую в хранилище.',
    settingsVaultApiUrl: 'URL API',
    settingsVaultApiUrlPlaceholder: 'https://127.0.0.1:27124',
    settingsVaultApiToken: 'Токен API',
    settingsVaultApiTokenPlaceholder: 'Токен из плагина Local REST API',
    settingsVaultApiHint: 'Требуется плагин Local REST API в Obsidian.',
    settingsSelectFolder: 'Выбрать папку',
    settingsChangeFolder: 'Изменить папку',
    settingsFontSize: 'Размер шрифта',
    settingsCurrentModel: 'Текущая модель',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo',
    statusScreenshotAttached: 'Скриншот прикреплён',
    statusScreenshotFailed: 'Скриншот не удался',
    statusScreenshotSkipped: 'Скриншот пропущен',
    msgScreenshotSkippedModel: 'Модель не поддерживает изображения. Переключитесь на vision-модель и сделайте новый скриншот.',
    historyTitle: 'История чата',
    historyEmpty: 'Нет сохранённых разговоров',
    btnHistory: 'История чата',
    btnCopy: 'Копировать',
    btnDelete: 'Удалить',
    emptyStateUrl: 'или введите URL для открытия',
  },
};

// ─── DOM ─────────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

const dom = {
  messages: $('#messages'),
  input: $('#input'),
  sendBtn: $('#sendBtn'),
  collectBtn: $('#collectBtn'),
  screenshotBtn: $('#screenshotBtn'),
  historyBtn: $('#historyBtn'),
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
  historyDrawerList: $('#historyDrawerList'),
  historyDrawerClose: $('#historyDrawerClose'),
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
  vaultModeLocal: $('#vaultModeLocal'),
  vaultModeApi: $('#vaultModeApi'),
  vaultApiPanel: $('#vaultApiPanel'),
  vaultApiUrlInput: $('#vaultApiUrlInput'),
  vaultApiTokenInput: $('#vaultApiTokenInput'),
  vaultLocalPanel: null, // set dynamically
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
  const emptyState = dom.messages.querySelector('.empty-state');
  if (emptyState) {
    const p = emptyState.querySelector('p:not(.empty-state-hint)');
    if (p) p.textContent = i18n('emptyStateText');
    const hint = emptyState.querySelector('.empty-state-hint');
    if (hint) hint.textContent = i18n('emptyStateSearch');
  }
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

// ─── Vault (File System Access API + REST API) ────────────────────────────────

function vaultMode() {
  return state.settings.vaultMode || 'local';
}

function vaultApiBase() {
  let url = (state.settings.vaultApiUrl || '').replace(/\/$/, '');
  if (!url) return null;
  return url;
}

function vaultApiHeaders() {
  const token = state.settings.vaultApiToken || '';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function vaultWrite(filename, content, append = false) {
  if (vaultMode() === 'api') {
    return vaultApiWrite(filename, content, append);
  }
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

async function vaultApiWrite(filename, content, append) {
  const base = vaultApiBase();
  if (!base) return { error: 'No API URL configured. Go to Settings.' };
  if (!state.settings.vaultApiToken) return { error: 'No API token configured. Go to Settings.' };

  const path = '/search?path=' + encodeURIComponent(filename);
  try {
    const resp = await fetch(base + path, {
      headers: vaultApiHeaders(),
    });
    let existing = '';
    if (resp.ok) {
      const data = await resp.json();
      if (data.content) existing = data.content;
    }
    const body = {
      content: existing ? (append ? existing + '\n\n---\n\n' + content : content) : content,
    };
    const writeResp = await fetch(base + '/uments/' + encodeURIComponent(filename), {
      method: 'POST',
      headers: vaultApiHeaders(),
      body: JSON.stringify(body),
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
  if (vaultMode() === 'api') {
    return vaultApiReadFiles(query, limit);
  }
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

async function vaultApiReadFiles(query, limit) {
  const base = vaultApiBase();
  if (!base) return { error: 'No API URL configured', notes: [] };
  if (!state.settings.vaultApiToken) return { error: 'No API token configured', notes: [] };

  try {
    const searchUrl = query
      ? `${base}/search?q=${encodeURIComponent(query)}&type=file&ext=md&limit=${limit}`
      : `${base}/vault?limit=${limit}`;

    const resp = await fetch(searchUrl, { headers: vaultApiHeaders() });
    if (!resp.ok) {
      return { error: `API error: ${resp.status}`, notes: [] };
    }
    const data = await resp.json();
    const files = data.files || data || [];
    const notes = [];

    for (const item of files) {
      if (notes.length >= limit) break;
      const path = item.path || item;
      const filename = path.split('/').pop() || path;
      if (!filename.endsWith('.md')) continue;

      try {
        const fileResp = await fetch(base + '/search?path=' + encodeURIComponent(path), {
          headers: vaultApiHeaders(),
        });
        if (fileResp.ok) {
          const fileData = await fileResp.json();
          notes.push({ filename, content: fileData.content || '' });
        }
      } catch {}
    }
    return { notes };
  } catch (err) {
    return { error: 'API error: ' + err.message, notes: [] };
  }
}

async function pickVaultFolder() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    state.vaultDirHandle = dirHandle;
    state.vaultReady = true;
    state.settings.vaultPath = dirHandle.name;
    state.autoVault = true;
    dom.vaultPathInput.value = dirHandle.name;
    dom.vaultPathInput.title = 'Selected: ' + dirHandle.name;
    if (dom.vaultStatus) dom.vaultStatus.classList.add('ready', 'active');
    await sendBgMessage({
      type: 'settings.save',
      data: { ...state.settings },
    });
    await sendBgMessage({ type: 'autovault.save', enabled: true });
    updateVaultBtn();
    setStatus(i18n('statusVaultReady'), 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      setStatus('Vault error: ' + err.message, 'error');
    }
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadSettings();
  await loadConversations();
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
  updateBadge();
  await loadCachedContext();
}

async function loadMemoryContext() {
  const pageUrl = state.pageContext?.metadata?.url || state.pageContext?.url || '';
  const domain = pageUrl ? extractDomain(pageUrl) : '';
  const topics = extractTopicsFromMessages(state.messages);

  const context = await sendBgMessage({
    type: 'memory.load',
    domain,
    topics,
    pageUrl,
  });

  if (context && (context.summaries?.length > 0 || context.memories?.length > 0)) {
    state.memoryContext = context;
  } else {
    state.memoryContext = null;
  }
}

function updateVaultBtn() {
  const isApi = vaultMode() === 'api';
  const hasHandle = !!state.vaultDirHandle;
  const hasPath = !!state.settings.vaultPath;
  const hasApiUrl = !!(state.settings.vaultApiUrl && state.settings.vaultApiToken);
  const isOn = state.autoVault;

  if (isApi) {
    dom.vaultBtn.classList.toggle('active', hasApiUrl && isOn);
    if (dom.vaultStatus) dom.vaultStatus.classList.toggle('ready', hasApiUrl);
    if (!hasApiUrl) {
      dom.vaultBtn.title = i18n('btnVaultNotSet');
    } else {
      dom.vaultBtn.title = isOn ? i18n('btnVaultOn') : i18n('btnVaultOff');
    }
  } else {
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
}

function toggleVaultOnBtn() {
  if (vaultMode() === 'api') {
    if (!state.settings.vaultApiUrl) return;
    state.autoVault = !state.autoVault;
    saveAutoVault();
    updateVaultBtn();
    setStatus(state.autoVault ? i18n('statusVaultReady') : i18n('btnVaultOff'), state.autoVault ? 'success' : 'info');
    return;
  }
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
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'context.refresh') {
      if (state.contextDebounce) clearTimeout(state.contextDebounce);
      state.contextDebounce = setTimeout(async () => {
        await collectPageContext();
        await loadMemoryContext();
      }, 200);
    }
  });

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
  dom.screenshotBtn.addEventListener('click', takeScreenshot);
  dom.historyBtn.addEventListener('click', toggleHistory);
  dom.clearBtn.addEventListener('click', clearConversation);

  // Click on messages area closes history (only if not the same click that opened it)
  dom.messages.addEventListener('mousedown', (e) => {
    if (state.historyOpen) {
      e.stopPropagation();
    }
  });
  dom.messages.addEventListener('click', () => {
    if (state.historyOpen) toggleHistory();
  });

  dom.historyDrawerClose.addEventListener('click', toggleHistory);

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

  if (dom.vaultModeLocal) {
    dom.vaultModeLocal.addEventListener('click', () => {
      state.settings.vaultMode = 'local';
      dom.vaultModeLocal.classList.add('active');
      dom.vaultModeApi.classList.remove('active');
      dom.vaultApiPanel.classList.add('hidden');
      if (dom.vaultLocalPanel) dom.vaultLocalPanel.classList.remove('hidden');
      updateVaultBtn();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
    });
  }

  if (dom.vaultModeApi) {
    dom.vaultModeApi.addEventListener('click', () => {
      state.settings.vaultMode = 'api';
      dom.vaultModeApi.classList.add('active');
      dom.vaultModeLocal.classList.remove('active');
      dom.vaultApiPanel.classList.remove('hidden');
      if (dom.vaultLocalPanel) dom.vaultLocalPanel.classList.add('hidden');
      updateVaultBtn();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
    });
  }

  if (dom.vaultApiUrlInput) {
    dom.vaultApiUrlInput.addEventListener('change', () => {
      state.settings.vaultApiUrl = dom.vaultApiUrlInput.value.trim();
      updateVaultBtn();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
    });
  }

  if (dom.vaultApiTokenInput) {
    dom.vaultApiTokenInput.addEventListener('change', () => {
      state.settings.vaultApiToken = dom.vaultApiTokenInput.value.trim();
      updateVaultBtn();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
    });
  }

  dom.modelSearch.addEventListener('input', () => {
    filterModels(dom.modelSearch.value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.historyOpen) toggleHistory();
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

    chrome.storage.local.get(['openagent_vision_models'], (res) => {
      if (res.openagent_vision_models) {
        state.visionModels = res.openagent_vision_models;
      }
      loadModels();
    });

    if (state.settings.vaultPath) {
      dom.vaultPathInput.value = state.settings.vaultPath;
      dom.vaultPathInput.title = 'Selected: ' + state.settings.vaultPath;
    }

    // Vault API settings
    if (dom.vaultApiUrlInput) dom.vaultApiUrlInput.value = state.settings.vaultApiUrl || '';
    if (dom.vaultApiTokenInput) dom.vaultApiTokenInput.value = state.settings.vaultApiToken || '';

    // Vault mode toggle
    const mode = state.settings.vaultMode || 'local';
    if (dom.vaultModeLocal && dom.vaultModeApi) {
      dom.vaultModeLocal.classList.toggle('active', mode === 'local');
      dom.vaultModeApi.classList.toggle('active', mode === 'api');
      const localPanel = document.getElementById('vaultLocalPanel');
      const apiPanel = dom.vaultApiPanel;
      if (apiPanel) apiPanel.classList.toggle('hidden', mode !== 'api');
      if (localPanel) localPanel.classList.toggle('hidden', mode !== 'local');
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
  const vaultApiUrl = dom.vaultApiUrlInput ? dom.vaultApiUrlInput.value.trim() : state.settings.vaultApiUrl;
  const vaultApiToken = dom.vaultApiTokenInput ? dom.vaultApiTokenInput.value.trim() : state.settings.vaultApiToken;
  const vaultMode = state.settings.vaultMode || 'local';
  const fontSize = dom.fontSizeSelect.value;

  try {
    await sendBgMessage({
      type: 'settings.save',
      data: { apiKey, provider: 'openrouter', model, systemPrompt, theme, preset, language, vaultPath, vaultApiUrl, vaultApiToken, vaultMode },
    });
    state.settings = { ...state.settings, apiKey, provider: 'openrouter', model, systemPrompt, theme, preset, language, vaultPath, vaultApiUrl, vaultApiToken, vaultMode };
    dom.settingsStatus.textContent = i18n('settingsSaved');
    dom.settingsStatus.className = 'settings-status';
    toggleModal(false);
    loadModels();
    updateModelBadge();
    updateVaultBtn();
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
    const visionModels = extractVisionModels(data.data || []);
    state.visionModels = visionModels;
    chrome.storage.local.set({ openagent_vision_models: visionModels });
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
  /^((?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})+(?:\/\S*)?))$/i,
  /^([a-z][a-z0-9-]+(?:\.[a-z]{2,})?)$/i,
];

const SEARCH_PATTERNS = [
  { prefix: /^\/g\s+/i, base: 'https://www.google.com/search?q=' },
  { prefix: /^\/y\s+/i, base: 'https://www.youtube.com/results?search_query=' },
  { prefix: /^\/x\s+/i, base: 'https://x.com/search?q=' },
  { prefix: /^\/w\s+/i, base: 'https://en.wikipedia.org/w/index.php?search=' },
  { prefix: /^\/r\s+/i, base: 'https://www.reddit.com/search/?q=' },
  { prefix: /^\/gh\s+/i, base: 'https://github.com/search?q=' },
  { prefix: /^\/d\s+/i, base: 'https://duckduckgo.com/?q=' },
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

function extractSearchIntent(text) {
  const trimmed = text.trim();
  for (const p of SEARCH_PATTERNS) {
    const match = trimmed.match(p.prefix);
    if (match) {
      const query = trimmed.slice(match[0].length).trim();
      return { base: p.base, query };
    }
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

  const search = extractSearchIntent(text);
  if (search) {
    const searchUrl = search.base + encodeURIComponent(search.query);
    await handleNavigation(searchUrl, text);
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
    const model = state.settings.model;
    if (state.pageScreenshot && !model) {
      state.pageScreenshot = null;
    } else if (state.pageScreenshot && !modelSupportsVision(model)) {
      state.pageScreenshot = null;
      removeTyping();
      renderMessage('error', i18n('msgScreenshotSkippedModel'));
      state.isLoading = false;
      dom.sendBtn.disabled = false;
      return;
    }

    const response = await sendBgMessage({
      type: 'prompt.send',
      conversationHistory: state.messages,
      pageContext: state.pageContext,
      pageScreenshot: state.pageScreenshot,
      autoVault: state.autoVault,
      memoryContext: state.memoryContext,
    });

    removeTyping();

    if (response.error) {
      if (response.error.includes('image') || response.error.includes('vision') || response.error.includes('endpoint')) {
        state.pageScreenshot = null;
        renderMessage('error', i18n('msgScreenshotSkippedModel'));
      } else {
        renderMessage('error', response.error);
      }
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

      // Save conversation after each response (updates existing or creates new)
      saveConversation();

      // Process conversation end - extract memory
      processConversationEnd().catch((err) => console.error('[SP] memory process error:', err));
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
  state.pageContext = null;
  dom.pageCtxDiv?.remove();
  dom.pageCtxDiv = null;

  try {
    let data = await sendBgMessage({ type: 'page.collect' });
    if (data.error || !data.rawCapture) {
      // content script not injected — force inject and retry
      await sendBgMessage({ type: 'inject.content' });
      await new Promise((r) => setTimeout(r, 500));
      data = await sendBgMessage({ type: 'page.collect' });
    }
    if (data.error) {
      return;
    }
    if (!data.rawCapture) {
      return;
    }

    state.pageContext = data.rawCapture;
    if (data.rawCapture?.metadata) {
      prependPageContext(data.rawCapture.metadata);
    }
  } catch (err) {
    // Silently fail - tab might be loading
  }
}

async function loadCachedContext() {
  try {
    const stored = await chrome.storage.local.get(['openagent_current_tab']);
    const cached = stored.openagent_current_tab;
    if (cached?.url && cached.url.startsWith('http')) {
      state.pageContext = cached;
      // Only use favicon if it's a real URL (chrome://favicon is blocked in side panel)
      const faviconUrl = cached.favicon && !cached.favicon.startsWith('chrome://') ? cached.favicon : null;
      prependPageContext({
        url: cached.url,
        title: cached.title,
        favicon: faviconUrl,
      });
    }
  } catch {}
  // refresh in background
  collectPageContext();
  await loadMemoryContext();
}

function modelSupportsVision(modelId) {
  if (!modelId) return false;
  const m = modelId.toLowerCase();
  if (state.visionModels.length > 0) {
    return state.visionModels.includes(modelId) || state.visionModels.includes(modelId.toLowerCase());
  }
  const visionHints = ['claude', 'gpt-4o', 'gpt-4-turbo', 'gemini', 'mistral', 'llava', 'llama', 'qwen', 'perplexity', 'deepseek', 'vision'];
  return visionHints.some((v) => m.includes(v));
}

function extractVisionModels(models) {
  const vision = [];
  for (const model of models) {
    const arch = model.architecture || {};
    const modality = arch.modality || '';
    const inputModalities = arch.input_modalities || [];
    if (modality.includes('image') || inputModalities.includes('image')) {
      vision.push(model.id);
    }
  }
  return vision;
}

async function takeScreenshot() {
  try {
    const data = await sendBgMessage({ type: 'page.screenshot' });
    if (data.error) {
      setStatus(data.error, 'error');
      return;
    }
    state.pageScreenshot = data.dataUrl;
    setStatus(i18n('statusScreenshotAttached'), 'success');

    const empty = dom.messages.querySelector('.empty-state');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = `
      <div class="message-label">${i18n('msgLabelYou')}</div>
      <div class="message-content"><img class="screenshot-thumb" src="${data.dataUrl}" /></div>
    `;
    dom.messages.appendChild(div);
    scrollToBottom();
    requestAnimationFrame(() => div.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } catch (err) {
    setStatus(i18n('statusScreenshotFailed') + ': ' + err.message, 'error');
  }
}

function prependPageContext(metadata) {
  const existing = dom.messages.querySelector('.page-ctx');
  if (existing) existing.remove();

  if (dom.headerCtx) {
    // Only use favicon if it's a real URL (not chrome://favicon/ which is blocked in side panel)
    const faviconUrl = metadata.favicon && !metadata.favicon.startsWith('chrome://') ? metadata.favicon : null;
    const faviconHtml = faviconUrl ? `<img class="ctx-favicon" src="${faviconUrl}" width="14" height="14" />` : '';
    dom.headerCtx.innerHTML = `
      ${faviconHtml}
      <span class="ctx-dot"></span>
      <span class="ctx-title">${escapeHtml(metadata.title || 'Untitled')}</span>
    `;
  }
}

function clearConversation() {
  if (state.messages.length > 0) {
    saveConversation();
    processConversationEnd().catch((err) => console.error('[SP] memory process error:', err));
  }
  state.messages = [];
  state.pageContext = null;
  state.currentConversationId = null;
  state.currentVaultFilename = null;
  state.memoryContext = null;
  if (dom.headerCtx) dom.headerCtx.innerHTML = '';
  renderMessages();
  updateBadge();
}

function saveConversation() {
  if (state.messages.length === 0) return;
  const conv = {
    id: Date.now(),
    pageUrl: state.pageContext?.metadata?.url || '',
    pageTitle: state.pageContext?.metadata?.title || document.title,
    timestamp: Date.now(),
    messages: state.messages,
    bodyText: state.pageContext?.bodyText || '',
    images: state.pageContext?.images || [],
  };
  if (state.currentConversationId !== null) {
    // Update existing conversation in place
    const idx = state.conversations.findIndex((c) => c.id === state.currentConversationId);
    if (idx !== -1) {
      conv.id = state.currentConversationId;
      state.conversations[idx] = conv;
      chrome.storage.local.set({ openagent_conversations: state.conversations });
      return;
    }
  }
  state.conversations = [conv, ...state.conversations].slice(0, 50);
  state.currentConversationId = conv.id;
  chrome.storage.local.set({ openagent_conversations: state.conversations });
}

async function loadConversations() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['openagent_conversations'], (res) => {
      state.conversations = res.openagent_conversations || [];
      resolve();
    });
  });
}

function toggleHistory() {
  state.historyOpen = !state.historyOpen;
  const drawer = document.getElementById('historyPanel');
  if (state.historyOpen) {
    renderHistoryPanel();
    drawer.classList.remove('hidden');
    dom.historyBtn.classList.add('active');
  } else {
    drawer.classList.add('hidden');
    dom.historyBtn.classList.remove('active');
  }
}

function renderHistoryPanel() {
  dom.historyDrawerClose.textContent = '×';
  if (state.conversations.length === 0) {
    dom.historyDrawerList.innerHTML = `<div class="history-drawer-empty">${i18n('historyEmpty')}</div>`;
  } else {
    dom.historyDrawerList.innerHTML = state.conversations.map((conv) => {
      const date = new Date(conv.timestamp);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const title = conv.pageTitle || conv.pageUrl || 'Untitled';
      return `<div class="history-drawer-item" data-id="${conv.id}">
        <div class="history-drawer-row">
          <div class="history-drawer-title">${escapeHtml(title.slice(0, 50))}</div>
          <button class="history-delete-btn" data-delete="${conv.id}" title="${i18n('btnDelete')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
        <div class="history-drawer-meta">${dateStr} · ${conv.messages.length} msg</div>
      </div>`;
    }).join('');
  }
  dom.historyDrawerList.querySelectorAll('.history-drawer-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete-btn')) return;
      restoreConversation(parseInt(el.dataset.id));
    });
  });
  dom.historyDrawerList.querySelectorAll('.history-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(parseInt(btn.dataset.delete));
    });
  });
}

function deleteConversation(id) {
  state.conversations = state.conversations.filter((c) => c.id !== id);
  chrome.storage.local.set({ openagent_conversations: state.conversations });
  renderHistoryPanel();
}

function restoreConversation(id) {
  const conv = state.conversations.find((c) => c.id === id);
  if (!conv) return;

  state.currentConversationId = id;

  // Append to current messages (continue conversation)
  state.messages.push(...conv.messages);

  state.historyOpen = false;
  document.getElementById('historyPanel').classList.add('hidden');

  if (conv.pageUrl) {
    // Restore page context from conversation
    const metadata = {
      url: conv.pageUrl,
      title: conv.pageTitle || 'Untitled',
      favicon: null, // chrome://favicon blocked in side panel
      domain: new URL(conv.pageUrl).hostname,
    };
    // If current page matches, refresh context; otherwise use stored context
    if (state.pageContext?.metadata?.url === conv.pageUrl) {
      // Already on same page, refresh context
      collectPageContext();
    } else {
      state.pageContext = {
        metadata,
        bodyText: conv.bodyText || '',
        images: conv.images || [],
        selectedText: '',
      };
      prependPageContext(metadata);
    }
  }

  renderMessages();
  updateBadge();
  saveConversation();
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
      <p class="empty-state-hint">${i18n('emptyStateSearch')}</p>
      <p class="empty-state-url-hint">${i18n('emptyStateUrl')}</p>
    </div>
  `;
}

function renderMessage(role, content) {
  const empty = dom.messages.querySelector('.empty-state');
  if (empty) empty.remove();

  const label = role === 'user' ? i18n('msgLabelYou') : i18n('msgLabelClaude');
  const formatted = formatContent(content);

  const copyBtnHtml = role === 'assistant'
    ? `<button class="copy-msg-btn" aria-label="${i18n('btnCopy')}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="20 6 9 17 4 12"/></svg>
       </button>`
    : '';

  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="message-label">${label}</div>
    ${copyBtnHtml}
    <div class="message-content">${formatted}</div>
  `;

  dom.messages.appendChild(div);

  // Attach message copy button handler
  if (role === 'assistant') {
    const btn = div.querySelector('.copy-msg-btn');
    if (btn) {
      const copyIcon = btn.querySelector('svg:first-child');
      const checkIcon = btn.querySelector('svg:last-child');
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
          if (copyIcon) copyIcon.style.display = 'none';
          if (checkIcon) checkIcon.style.display = '';
          btn.style.color = '#6fcf97';
          setStatus(i18n('btnCopy'), 'success');
          setTimeout(() => {
            if (copyIcon) copyIcon.style.display = '';
            if (checkIcon) checkIcon.style.display = 'none';
            btn.style.color = '';
          }, 1500);
        });
      });
    }
  }

  // Attach code block copy button handlers
  div.querySelectorAll('.copy-code-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const code = btn.closest('pre').querySelector('code').textContent;
      const copyIcon = btn.querySelector('.icon-copy');
      const checkIcon = btn.querySelector('.icon-check');
      navigator.clipboard.writeText(code).then(() => {
        if (copyIcon) copyIcon.style.display = 'none';
        if (checkIcon) checkIcon.style.display = '';
        btn.classList.add('copied');
        setStatus(i18n('btnCopy'), 'success');
        setTimeout(() => {
          if (copyIcon) copyIcon.style.display = '';
          if (checkIcon) checkIcon.style.display = 'none';
          btn.classList.remove('copied');
        }, 1500);
      });
    });
  });

  scrollToBottom();
  updateBadge();
}

function formatContent(text) {
  if (!text) return '';
  // Process in a single pass: code blocks first (before other patterns can corrupt them)
  let processed = text;
  // Restore code blocks immediately to avoid corruption
  processed = processed.replace(/```(\w*)\n?([\s\S]*?)```/g, (match) => {
    const lang = match.match(/```(\w*)/)?.[1] || '';
    const code = escapeHtml(match.replace(/```\w*\n?/g, '').replace(/```$/g, '').trim());
    const copySvg = `<svg class="icon-copy" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    const checkSvg = `<svg class="icon-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="20 6 9 17 4 12"/></svg>`;
    return `<pre class="code-block" data-lang="${lang}"><code>${code}</code><button class="copy-code-btn" aria-label="Copy">${copySvg}${checkSvg}</button></pre>`;
  });
  // Restore inline code immediately
  processed = processed.replace(/`([^`]+)`/g, (match, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });
  // Headings
  processed = processed.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  processed = processed.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  processed = processed.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  // Bold and italic
  processed = processed.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
  processed = processed.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>');
  processed = processed.replace(/_(.+?)_/g, '<em>$1</em>');
  // Blockquotes
  processed = processed.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Unordered lists
  processed = processed.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  // Ordered lists
  processed = processed.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Wrap consecutive list items
  processed = processed.replace(/(<li>[\s\S]*?<\/li>)(?=\s*(?!<li>))/g, '<ul>$1</ul>');
  // Tables
  processed = processed.replace(/^\|(.+)\|$/gm, (match, row) => {
    const cells = row.split('|').map((c) => c.trim());
    return `__TABLE_ROW__${JSON.stringify(cells)}__`;
  });
  const tableRows = [];
  processed = processed.replace(/__TABLE_ROW__(\[.*?\])__/g, (match, rowJson) => {
    const idx = tableRows.length;
    tableRows.push(JSON.parse(rowJson));
    return `__TROW_${idx}__`;
  });
  // Restore table rows
  if (tableRows.length > 0) {
    let tableHtml = '<div class="table-wrapper"><table>';
    let headerRow = null;
    for (let i = 0; i < tableRows.length; i++) {
      const cells = tableRows[i];
      const isHeader = cells.every((c) => c.match(/^[\-\=]+$/) || c.match(/^[A-Z\s]+$/));
      if (isHeader && i + 1 < tableRows.length) {
        headerRow = cells;
      } else {
        const tag = headerRow ? 'th' : 'td';
        const cellHtml = cells.map((c) => `<${tag}>${c}</${tag}>`).join('');
        tableHtml += `<tr>${cellHtml}</tr>`;
        if (headerRow) headerRow = null;
      }
    }
    tableHtml += '</table></div>';
    processed = processed.replace(/__TROW_(\d+)__/g, () => '');
    processed = processed.replace(/__TROW_0__[\s\S]*?(?=__TROW_|$)/, tableHtml);
  }
  // Line breaks
  processed = processed.replace(/\n/g, '<br>');
  // Clean up br tags around block elements
  processed = processed.replace(/<br><(h[234]|blockquote|ul|pre|div)/g, '<$1');
  processed = processed.replace(/<\/(h[234]|blockquote|ul|pre|div)><br>/g, '</$1>');
  return processed;
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

function updateBadge() {
  const count = state.messages.length;
  if (count === 0) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#9f7aea' });
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

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

let conversationProcessing = false;

async function processConversationEnd() {
  if (conversationProcessing || !state.settings.apiKey || state.messages.length < 2) return;
  conversationProcessing = true;

  const pageUrl = state.pageContext?.metadata?.url || state.pageContext?.url || '';
  const domain = extractDomain(pageUrl);
  const topics = extractTopicsFromMessages(state.messages);

  const result = await window.processConversationEnd(
    state.messages,
    pageUrl,
    domain,
    state.settings.apiKey,
    state.settings.model
  );

  if (!result) { conversationProcessing = false; return; }

  await sendBgMessage({
    type: 'memory.save',
    conversationId: state.currentConversationId || Date.now(),
    pageUrl,
    summary: result.summary,
    topics: result.topics,
    memEntries: result.memEntries,
    conversation: state.messages,
  });
  conversationProcessing = false;
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
