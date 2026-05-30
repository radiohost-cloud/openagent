// sidepanel.js - Side Panel UI Logic

const state = {
  messages: [],
  settings: { apiKey: '', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: '', systemPrompt: '', theme: 'dark', preset: 'default', language: 'en', vaultName: '', vaultApiUrl: '', vaultApiToken: '', fontSize: 'medium' },
  pageContext: null,
  pageLinks: [],
  pageScreenshot: null,
  domTree: null,
  highlightsVisible: false,
  visionModels: [],
  isLoading: false,
  allModels: [],
  autoVault: false,
  currentVaultFilename: null,
  vaultConnected: false,
  currentDomain: null,
  conversations: [],
  historyOpen: false,
  currentConversationId: null,
  memoryContext: null,
  vaultSavedCount: 0,
  vaultWritten: false,
  webSearch: false,
  webSearchProvider: 'openrouter',
  webSearchApiKey: '',
  vaultIntent: null,
  pastedImage: null,
};

// Shared utilities
const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const HTML_ESCAPE_RE = /[&<>"']/g;
const escapeHtml = (str) => String(str).replace(HTML_ESCAPE_RE, (m) => HTML_ESCAPE[m]);
const HTTPS_RE = /^https?:\/\//;

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
    statusVaultDisconnected: 'Obsidian vault not connected',
    settingsTitle: 'Settings',
    settingsApiKey: 'API Key',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsBaseUrl: 'API Base URL',
    settingsBaseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    settingsBaseUrlHint: 'OpenAI-compatible API endpoint (e.g. OpenRouter, local LLM, OpenAI, etc.)',
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
    settingsVaultName: 'Vault name',
    settingsVaultNamePlaceholder: '/obsidian',
    settingsVaultNameHint: 'Subfolder path within your Obsidian vault, e.g. /obsidian (no trailing slash)',
    settingsVaultApiUrl: 'API URL',
    settingsVaultApiUrlPlaceholder: 'http://127.0.0.1:27124',
    settingsVaultApiToken: 'API Token',
    settingsVaultApiTokenPlaceholder: 'Token from Local REST API plugin',
    settingsVaultApiHint: 'Requires Local REST API plugin in Obsidian.',
    settingsVaultApiTest: 'Test connection',
    settingsVaultApiTestOk: 'Connected',
    settingsVaultApiTestFail: 'Connection failed',
    settingsChangeFolder: 'Change folder',
    settingsFontSize: 'Font size',
    settingsCurrentModel: 'Current Model',
    settingsWebSearch: 'Web Search',
    settingsWebSearchHint: 'Agent will search the web when needed. OpenRouter uses built-in search; other providers use the API key below.',
    settingsWebSearchProvider: 'Search Provider',
    settingsWebSearchProviderHint: 'Choose which search engine to use. OpenRouter uses the main API key. Brave and SerpAPI require a separate API key below.',
    settingsWebSearchApiKey: 'Search API Key',
    settingsWebSearchApiKeyPlaceholder: 'API key...',
    settingsWebSearchApiKeyHint: 'API key for the selected search provider. Not needed for OpenRouter.',
    settingsOff: 'Off',
    settingsOn: 'On',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo · /o Obsidian · /i Intent',
    statusScreenshotAttached: 'Screenshot attached',
    statusScreenshotFailed: 'Screenshot failed',
    statusScreenshotSkipped: 'Screenshot skipped',
    msgScreenshotSkippedModel: 'Model does not support image input. Switch to a vision model and take a new screenshot.',
    msgScreenshotSaved: 'Screenshot saved to note (model does not support images).',
    msgPasteImageError: 'Failed to read pasted image.',
    actionResultTitle: 'Action results:',
    actionResultSuccess: 'Completed',
    actionResultFailed: 'Failed',
    historyTitle: 'Chat History',
    historyEmpty: 'No saved conversations',
    btnHistory: 'Chat history',
    btnCopy: 'Copy',
    btnDelete: 'Delete',
    historySearchPlaceholder: 'Search conversations...',
    emptyStateUrl: 'or just type a URL to open it',
    intentUpdated: 'Intent updated: $1',
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
    statusVaultDisconnected: 'Magazyn Obsidian nie jest połączony',
    settingsTitle: 'Ustawienia',
    settingsApiKey: 'Klucz API',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsBaseUrl: 'Bazowy URL API',
    settingsBaseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    settingsBaseUrlHint: 'Endpoint API kompatybilny z OpenAI (np. OpenRouter, lokalny LLM, OpenAI itp.)',
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
    settingsVaultName: 'Nazwa sejfu',
    settingsVaultNamePlaceholder: '/obsidian',
    settingsVaultNameHint: 'Ścieżka podfolderu w sejfie, np. /obsidian (bez ukośnika na końcu)',
    settingsVaultApiUrl: 'URL API',
    settingsVaultApiUrlPlaceholder: 'http://127.0.0.1:27124',
    settingsVaultApiToken: 'Token API',
    settingsVaultApiTokenPlaceholder: 'Token z wtyczki Local REST API',
    settingsVaultApiHint: 'Wymaga wtyczki Local REST API w Obsidian.',
    settingsVaultApiTest: 'Testuj połączenie',
    settingsVaultApiTestOk: 'Połączono',
    settingsVaultApiTestFail: 'Błąd połączenia',
    settingsFontSize: 'Wielkość czcionki',
    settingsCurrentModel: 'Aktualny model',
    settingsWebSearch: 'Wyszukiwanie w sieci',
    settingsWebSearchHint: 'Agent sam wyszuka w sieci gdy trzeba. OpenRouter używa wbudowanego wyszukiwania; inne dostawcy używają klucza API poniżej.',
    settingsWebSearchProvider: 'Dostawca wyszukiwania',
    settingsWebSearchProviderHint: 'Wybierz wyszukiwarkę. OpenRouter używa głównego klucza API. Brave i SerpAPI wymagają osobnego klucza API poniżej.',
    settingsWebSearchApiKey: 'Klucz API wyszukiwania',
    settingsWebSearchApiKeyPlaceholder: 'Klucz API...',
    settingsWebSearchApiKeyHint: 'Klucz API dla wybranego dostawcy wyszukiwania. Niepotrzebny dla OpenRouter.',
    settingsOff: 'Wył',
    settingsOn: 'Wł',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo · /o Obsidian · /i Intent',
    statusScreenshotAttached: 'Zrzut ekranu załączony',
    statusScreenshotFailed: 'Zrzut ekranu nieudany',
    statusScreenshotSkipped: 'Zrzut ekranu pominięty',
    msgScreenshotSkippedModel: 'Model nie obsługuje obrazów. Przełącz na model z vision i zrób nowy zrzut.',
    msgScreenshotSaved: 'Zrzut ekranu zapisany w notatce (model nie obsługuje obrazów).',
    msgPasteImageError: 'Nie udało się wczytać wklejonego obrazu.',
    actionResultTitle: 'Wyniki akcji:',
    actionResultSuccess: 'Wykonano',
    actionResultFailed: 'Niepowodzenie',
    historyTitle: 'Historia rozmów',
    historyEmpty: 'Brak zapisanych rozmów',
    btnHistory: 'Historia rozmów',
    btnCopy: 'Kopiuj',
    btnDelete: 'Usuń',
    historySearchPlaceholder: 'Szukaj rozmów...',
    emptyStateUrl: 'lub wpisz adres URL, aby go otworzyć',
    intentUpdated: 'Intent zaktualizowany: $1',
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
    statusVaultDisconnected: 'Almacén de Obsidian no conectado',
    settingsTitle: 'Ajustes',
    settingsApiKey: 'Clave API',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsBaseUrl: 'URL Base API',
    settingsBaseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    settingsBaseUrlHint: 'Endpoint API compatible con OpenAI (ej. OpenRouter, LLM local, OpenAI, etc.)',
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
    settingsVaultApiUrlPlaceholder: 'http://127.0.0.1:27124',
    settingsVaultApiToken: 'Token de API',
    settingsVaultApiTokenPlaceholder: 'Token del plugin Local REST API',
    settingsVaultApiHint: 'Requiere el plugin Local REST API en Obsidian.',
    settingsVaultApiTest: 'Probar conexión',
    settingsVaultApiTestOk: 'Conectado',
    settingsVaultApiTestFail: 'Error de conexión',
    settingsSelectFolder: 'Seleccionar carpeta',
    settingsChangeFolder: 'Cambiar carpeta',
    settingsFontSize: 'Tamaño de fuente',
    settingsCurrentModel: 'Modelo actual',
    settingsWebSearch: 'Búsqueda web',
    settingsWebSearchHint: 'El agente buscará en la web cuando sea necesario. OpenRouter usa búsqueda integrada; otros proveedores usan la clave API abajo.',
    settingsWebSearchProvider: 'Proveedor de búsqueda',
    settingsWebSearchProviderHint: 'Elige el motor de búsqueda. OpenRouter usa la clave API principal. Brave y SerpAPI requieren una clave API separada.',
    settingsWebSearchApiKey: 'Clave API de búsqueda',
    settingsWebSearchApiKeyPlaceholder: 'Clave API...',
    settingsWebSearchApiKeyHint: 'Clave API del proveedor de búsqueda seleccionado. No necesaria para OpenRouter.',
    settingsOff: 'Off',
    settingsOn: 'On',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo · /o Obsidian · /i Intent',
    statusScreenshotAttached: 'Captura adjunta',
    statusScreenshotFailed: 'Captura fallida',
    statusScreenshotSkipped: 'Captura omitida',
    msgScreenshotSkippedModel: 'El modelo no soporta imágenes. Cambia a un modelo vision y toma una nueva captura.',
    msgScreenshotSaved: 'Captura guardada en la nota (el modelo no soporta imágenes).',
    msgPasteImageError: 'Error al leer la imagen pegada.',
    actionResultTitle: 'Resultados de acciones:',
    actionResultSuccess: 'Completado',
    actionResultFailed: 'Fallido',
    historyTitle: 'Historial de chat',
    historyEmpty: 'Sin conversaciones guardadas',
    btnHistory: 'Historial de chat',
    btnCopy: 'Copiar',
    btnDelete: 'Eliminar',
    historySearchPlaceholder: 'Buscar conversaciones...',
    emptyStateUrl: 'o escribe una URL para abrirla',
    intentUpdated: 'Intent actualizado: $1',
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
    statusVaultDisconnected: "Coffre Obsidian non connecté",
    settingsTitle: 'Paramètres',
    settingsApiKey: 'Clé API',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsBaseUrl: 'URL de base API',
    settingsBaseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    settingsBaseUrlHint: 'Point de terminaison API compatible OpenAI (ex. OpenRouter, LLM local, OpenAI, etc.)',
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
    settingsVaultApiUrlPlaceholder: 'http://127.0.0.1:27124',
    settingsVaultApiToken: "Jeton d'API",
    settingsVaultApiTokenPlaceholder: "Jeton du plugin Local REST API",
    settingsVaultApiHint: "Nécessite le plugin Local REST API dans Obsidian.",
    settingsVaultApiTest: 'Tester la connexion',
    settingsVaultApiTestOk: 'Connecté',
    settingsVaultApiTestFail: 'Erreur de connexion',
    settingsSelectFolder: 'Sélectionner un dossier',
    settingsChangeFolder: 'Modifier le dossier',
    settingsFontSize: 'Taille de police',
    settingsCurrentModel: 'Modèle actuel',
    settingsWebSearch: 'Recherche web',
    settingsWebSearchHint: "L'agent recherchera sur le web si nécessaire. OpenRouter utilise la recherche intégrée ; les autres fournisseurs utilisent la clé API ci-dessous.",
    settingsWebSearchProvider: 'Fournisseur de recherche',
    settingsWebSearchProviderHint: "Choisissez le moteur de recherche. OpenRouter utilise la clé API principale. Brave et SerpAPI nécessitent une clé API distincte.",
    settingsWebSearchApiKey: 'Clé API de recherche',
    settingsWebSearchApiKeyPlaceholder: 'Clé API...',
    settingsWebSearchApiKeyHint: "Clé API du fournisseur de recherche sélectionné. Pas nécessaire pour OpenRouter.",
    settingsOff: 'Off',
    settingsOn: 'On',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo · /o Obsidian · /i Intent',
    statusScreenshotAttached: 'Capture jointe',
    statusScreenshotFailed: 'Capture échouée',
    statusScreenshotSkipped: 'Capture omise',
    msgScreenshotSkippedModel: 'Le modèle ne supporte pas les images. Passez à un modèle vision et prenez une nouvelle capture.',
    msgScreenshotSaved: 'Capture enregistrée dans la note (le modèle ne supporte pas les images).',
    msgPasteImageError: "Échec de la lecture de l'image collée.",
    actionResultTitle: 'Résultats des actions:',
    actionResultSuccess: 'Terminé',
    actionResultFailed: 'Échoué',
    historyTitle: 'Historique du chat',
    historyEmpty: 'Aucune conversation sauvegardée',
    btnHistory: 'Historique du chat',
    btnDelete: 'Supprimer',
    historySearchPlaceholder: 'Rechercher des conversations...',
    emptyStateUrl: "ou tapez une URL pour l'ouvrir",
    intentUpdated: 'Intention mise à jour: $1',
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
    statusVaultDisconnected: 'Obsidian-Tresor nicht verbunden',
    settingsTitle: 'Einstellungen',
    settingsApiKey: 'API-Schlüssel',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsBaseUrl: 'API-Basis-URL',
    settingsBaseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    settingsBaseUrlHint: 'OpenAI-kompatibler API-Endpunkt (z.B. OpenRouter, lokales LLM, OpenAI usw.)',
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
    settingsVaultApiUrlPlaceholder: 'http://127.0.0.1:27124',
    settingsVaultApiToken: 'API-Token',
    settingsVaultApiTokenPlaceholder: 'Token vom Local REST API Plugin',
    settingsVaultApiHint: 'Erfordert das Local REST API Plugin in Obsidian.',
    settingsVaultApiTest: 'Verbindung testen',
    settingsVaultApiTestOk: 'Verbunden',
    settingsVaultApiTestFail: 'Verbindungsfehler',
    settingsSelectFolder: 'Ordner auswählen',
    settingsChangeFolder: 'Ordner ändern',
    settingsFontSize: 'Schriftgröße',
    settingsCurrentModel: 'Aktuelles Modell',
    settingsWebSearch: 'Websuche',
    settingsWebSearchHint: 'Der Agent sucht bei Bedarf im Web. OpenRouter nutzt integrierte Suche; andere Anbieter verwenden den API-Schlüssel unten.',
    settingsWebSearchProvider: 'Suchanbieter',
    settingsWebSearchProviderHint: 'Wählen Sie die Suchmaschine. OpenRouter verwendet den Haupt-API-Schlüssel. Brave und SerpAPI benötigen einen separaten API-Schlüssel.',
    settingsWebSearchApiKey: 'Such-API-Schlüssel',
    settingsWebSearchApiKeyPlaceholder: 'API-Schlüssel...',
    settingsWebSearchApiKeyHint: 'API-Schlüssel für den ausgewählten Suchanbieter. Nicht erforderlich für OpenRouter.',
    settingsOff: 'Aus',
    settingsOn: 'An',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo · /o Obsidian · /i Intent',
    statusScreenshotAttached: 'Screenshot angehängt',
    statusScreenshotFailed: 'Screenshot fehlgeschlagen',
    statusScreenshotSkipped: 'Screenshot übersprungen',
    msgScreenshotSkippedModel: 'Modell unterstützt keine Bilder. Wechsle zu einem Vision-Modell und mach einen neuen Screenshot.',
    msgScreenshotSaved: 'Screenshot in der Notiz gespeichert (Modell unterstützt keine Bilder).',
    msgPasteImageError: 'Fehler beim Lesen des eingefügten Bildes.',
    actionResultTitle: 'Aktionsergebnisse:',
    actionResultSuccess: 'Abgeschlossen',
    actionResultFailed: 'Fehlgeschlagen',
    historyTitle: 'Chat-Verlauf',
    historyEmpty: 'Keine gespeicherten Gespräche',
    btnHistory: 'Chat-Verlauf',
    btnCopy: 'Kopieren',
    btnDelete: 'Löschen',
    historySearchPlaceholder: 'Gespräche suchen...',
    emptyStateUrl: 'oder URL eingeben zum Öffnen',
    intentUpdated: 'Absicht aktualisiert: $1',
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
    statusVaultDisconnected: 'Хранилище Obsidian не подключено',
    settingsTitle: 'Настройки',
    settingsApiKey: 'API-ключ',
    settingsApiKeyPlaceholder: 'sk-or-...',
    settingsBaseUrl: 'Базовый URL API',
    settingsBaseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    settingsBaseUrlHint: 'API-эндпоинт, совместимый с OpenAI (напр. OpenRouter, локальный LLM, OpenAI и т.д.)',
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
    settingsVaultApiUrlPlaceholder: 'http://127.0.0.1:27124',
    settingsVaultApiToken: 'Токен API',
    settingsVaultApiTokenPlaceholder: 'Токен из плагина Local REST API',
    settingsVaultApiHint: 'Требуется плагин Local REST API в Obsidian.',
    settingsVaultApiTest: 'Проверить соединение',
    settingsVaultApiTestOk: 'Подключено',
    settingsVaultApiTestFail: 'Ошибка соединения',
    settingsSelectFolder: 'Выбрать папку',
    settingsChangeFolder: 'Изменить папку',
    settingsFontSize: 'Размер шрифта',
    settingsCurrentModel: 'Текущая модель',
    settingsWebSearch: 'Веб-поиск',
    settingsWebSearchHint: 'Агент выполнит поиск в интернете при необходимости. OpenRouter использует встроенный поиск; другие провайдеры используют ключ API ниже.',
    settingsWebSearchProvider: 'Поисковый провайдер',
    settingsWebSearchProviderHint: 'Выберите поисковую систему. OpenRouter использует основной ключ API. Brave и SerpAPI требуют отдельный ключ API.',
    settingsWebSearchApiKey: 'Ключ API поиска',
    settingsWebSearchApiKeyPlaceholder: 'Ключ API...',
    settingsWebSearchApiKeyHint: 'Ключ API для выбранного поискового провайдера. Не требуется для OpenRouter.',
    settingsOff: 'Выкл',
    settingsOn: 'Вкл',
    emptyStateSearch: '/g Google · /y YouTube · /x X.com · /w Wiki · /r Reddit · /gh GitHub · /d DuckDuckGo · /o Obsidian · /i Intent',
    statusScreenshotAttached: 'Скриншот прикреплён',
    statusScreenshotFailed: 'Скриншот не удался',
    statusScreenshotSkipped: 'Скриншот пропущен',
    msgScreenshotSkippedModel: 'Модель не поддерживает изображения. Переключитесь на vision-модель и сделайте новый скриншот.',
    msgScreenshotSaved: 'Скриншот сохранён в заметке (модель не поддерживает изображения).',
    msgPasteImageError: 'Не удалось прочитать вставленное изображение.',
    actionResultTitle: 'Результаты действий:',
    actionResultSuccess: 'Выполнено',
    actionResultFailed: 'Не удалось',
    historyTitle: 'История чата',
    historyEmpty: 'Нет сохранённых разговоров',
    btnHistory: 'История чата',
    btnCopy: 'Копировать',
    btnDelete: 'Удалить',
    historySearchPlaceholder: 'Поиск разговоров...',
    emptyStateUrl: 'или введите URL для открытия',
    intentUpdated: 'Намерение обновлено: $1',
  },
};

// ─── DOM ─────────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

const dom = {
  messages: $('#messages'),
  inputWrapper: $('.input-wrapper'),
  input: $('#input'),
  sendBtn: $('#sendBtn'),
  collectBtn: $('#collectBtn'),
  highlightToggleBtn: $('#highlightToggleBtn'),
  screenshotBtn: $('#screenshotBtn'),
  historyBtn: $('#historyBtn'),
  vaultBtn: $('#vaultBtn'),
  clearBtn: $('#clearBtn'),
  settingsBtn: $('#settingsBtn'),
  settingsModal: $('#settingsModal'),
  closeSettings: $('#closeSettings'),
  saveSettings: $('#saveSettings'),
  apiKeyInput: $('#apiKeyInput'),
  baseUrlInput: $('#baseUrlInput'),
  currentModelDisplay: $('#currentModelDisplay'),
  modelList: $('#modelList'),
  modelSearch: $('#modelSearch'),
  webSearchOff: $('#webSearchOff'),
  webSearchOn: $('#webSearchOn'),
  webSearchProvider: $('#webSearchProvider'),
  webSearchApiKeyInput: $('#webSearchApiKeyInput'),
  webSearchProviderGroup: $('#webSearchProviderGroup'),
  webSearchApiKeyGroup: $('#webSearchApiKeyGroup'),
  modelHint: $('#modelHint'),
  headerCtx: $('#headerCtx'),
  historyDrawerList: $('#historyDrawerList'),
  historyDrawerClose: $('#historyDrawerClose'),
  historySearch: $('#historySearch'),
  systemPromptInput: $('#systemPromptInput'),
  settingsStatus: $('#settingsStatus'),
  status: $('#status'),
  themeDark: $('#themeDark'),
  themeLight: $('#themeLight'),
  themePreset: $('#themePreset'),
  langSelect: $('#langSelect'),
  fontSizeSelect: $('#fontSizeSelect'),
  vaultApiUrlInput: $('#vaultApiUrlInput'),
  vaultApiTokenInput: $('#vaultApiTokenInput'),
  vaultApiTestBtn: $('#vaultApiTestBtn'),
  vaultApiStatus: $('#vaultApiStatus'),
  vaultNameInput: $('#vaultNameInput'),
  vaultNoteIndicator: $('#vaultNoteIndicator'),
  statusModel: $('#statusModel'),
  statusVault: $('#statusVault'),
  statusVaultName: $('#statusVaultName'),
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

// ─── Vault (Obsidian Local REST API) ─────────────────────────────────────────

async function vaultWrite(filename, content) {
  if (!state.vaultConnected) return { error: 'Obsidian vault not connected.' };
  return await vaultApiWrite(filename, content);
}

async function vaultApiWrite(filename, content) {
  try {
    const sourceUrl = state.pageContext?.url || state.pageContext?.metadata?.url || '';
    const intent = state.vaultIntent || (() => {
      const firstUser = state.messages.find((m) => m.role === 'user');
      const extracted = firstUser ? (firstUser.content || '').replace(/^<[^>]+>\s*/, '').replace(/\n.+$/s, '').trim().slice(0, 200) : '';
      if (extracted) state.vaultIntent = extracted;
      return extracted;
    })();
    return await sendBgMessage({
      type: 'vault.api.write',
      filename,
      content,
      sourceUrl,
      intent: intent,
      model: state.settings.model || '',
      provider: state.settings.provider || 'openrouter',
    });
  } catch (err) {
    console.error('[SP] vaultApiWrite error:', err);
    return { error: err.message };
  }
}

function getOrCreateSessionFilename() {
  if (state.currentVaultFilename) return state.currentVaultFilename;
  const date = new Date();
  const dateStr = formatDate(date);
  const domain = state.pageContext?.metadata?.domain || state.pageContext?.url ? (() => { try { return new URL(state.pageContext?.metadata?.url || state.pageContext?.url).hostname.replace(/^www\./, '').replace(/\./g, '-'); } catch { return 'openagent'; } })() : 'openagent';
  state.currentVaultFilename = `${domain}-${dateStr}.md`;
  state.vaultSavedCount = 0;
  return state.currentVaultFilename;
}

async function vaultReadFiles(query = '', limit = 20) {
  if (!state.vaultConnected) {
    return { error: 'Obsidian vault not connected', notes: [] };
  }
  return await vaultApiReadFiles(query, limit);
}

async function vaultApiReadFiles(query, limit) {
  return await sendBgMessage({
    type: 'vault.api.read',
    query,
    limit,
  });
}

async function vaultApiTest() {
  const url = state.settings.vaultApiUrl;
  const token = state.settings.vaultApiToken;
  if (!url || !token) return { error: 'URL or token missing' };
  try {
    const result = await sendBgMessage({
      type: 'vault.api.test',
      url,
      token,
    });
    return result;
  } catch (err) {
    return { error: err.message };
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
  updateVaultNoteIndicator();
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
  const hasApiUrl = !!(state.settings.vaultApiUrl && state.settings.vaultApiToken);
  const isOn = state.autoVault;

  dom.vaultBtn.classList.remove('active');
  dom.vaultBtn.classList.toggle('vault-active', hasApiUrl && isOn && state.vaultConnected);
  if (!hasApiUrl) {
    dom.vaultBtn.title = i18n('btnVaultNotSet');
  } else {
    dom.vaultBtn.title = isOn ? i18n('btnVaultOn') : i18n('btnVaultOff');
  }
}

function toggleVaultOnBtn() {
  if (!state.settings.vaultApiUrl || !state.settings.vaultApiToken) return;
  state.autoVault = !state.autoVault;
  state.vaultSavedCount = 0;
  if (!state.autoVault) state.vaultIntent = null;
  saveAutoVault();
  updateVaultBtn();
  updateBadge();
  if (state.autoVault && !state.currentVaultFilename) getOrCreateSessionFilename();
  updateVaultNoteIndicator();
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
      const now = Date.now();
      // Always load if no recent load (>1.5s), or if URL is different
      if (now - lastContextTime > 1500 || message.force) {
        lastTabUrl = '';
        collectPageContext();
        lastContextTime = now;
      }
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

  // Paste handler for images (Cmd+V on Mac, Ctrl+V on Windows/Linux)
  dom.input.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) {
          renderMessage('error', i18n('msgPasteImageError'));
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          state.pastedImage = dataUrl;
          const empty = dom.messages.querySelector('.empty-state');
          if (empty) empty.remove();
          const div = document.createElement('div');
          div.className = 'message user';
          div.innerHTML = `
            <div class="message-label">${i18n('msgLabelYou')}</div>
            <div class="message-content"><img class="screenshot-thumb" src="${dataUrl}" /></div>
          `;
          dom.messages.appendChild(div);
          state.messages.push({ role: 'user', content: '[screenshot]', domain: state.currentDomain, imageData: dataUrl });
          requestAnimationFrame(() => {
            dom.messages.scrollTop = dom.messages.scrollHeight;
          });
          setStatus(i18n('statusScreenshotAttached'), 'success');
          // Create vault note immediately if this is the first message
          if (state.autoVault && state.vaultConnected && !state.currentVaultFilename) {
            state.currentVaultFilename = getOrCreateSessionFilename();
          }
          if (state.autoVault && state.vaultConnected && state.currentVaultFilename && !state.vaultWritten) {
            forceCreateVaultNote().catch((err) => console.error('[SP] auto-vault error:', err));
          } else if (state.autoVault && state.vaultConnected && state.currentVaultFilename) {
            saveAutoVaultNote().catch((err) => console.error('[SP] auto-vault error:', err));
          }
        };
        reader.onerror = () => {
          renderMessage('error', i18n('msgPasteImageError'));
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
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

  if (dom.baseUrlInput) {
    dom.baseUrlInput.addEventListener('change', () => {
      state.settings.baseUrl = dom.baseUrlInput.value.trim() || 'https://openrouter.ai/api/v1';
      loadModels();
    });
  }

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

  dom.webSearchOn.addEventListener('click', () => {
    state.webSearch = true;
    dom.webSearchOn.classList.add('active');
    dom.webSearchOff.classList.remove('active');
    dom.inputWrapper.classList.add('web-search-active');
    dom.webSearchProviderGroup.classList.remove('hidden');
    updateWebSearchApiKeyVisibility();
    sendBgMessage({ type: 'settings.save', data: { ...state.settings, webSearch: true, webSearchProvider: state.webSearchProvider, webSearchApiKey: state.webSearchApiKey } }).catch(() => {});
  });

  dom.webSearchOff.addEventListener('click', () => {
    state.webSearch = false;
    dom.webSearchOff.classList.add('active');
    dom.webSearchOn.classList.remove('active');
    dom.inputWrapper.classList.remove('web-search-active');
    dom.webSearchProviderGroup.classList.add('hidden');
    dom.webSearchApiKeyGroup.classList.add('hidden');
    sendBgMessage({ type: 'settings.save', data: { ...state.settings, webSearch: false, webSearchProvider: state.webSearchProvider, webSearchApiKey: state.webSearchApiKey } }).catch(() => {});
  });

  if (dom.webSearchProvider) {
    dom.webSearchProvider.addEventListener('change', () => {
      state.webSearchProvider = dom.webSearchProvider.value;
      updateWebSearchApiKeyVisibility();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings, webSearchProvider: state.webSearchProvider, webSearchApiKey: state.webSearchApiKey } }).catch(() => {});
    });
  }

  if (dom.webSearchApiKeyInput) {
    dom.webSearchApiKeyInput.addEventListener('change', () => {
      state.webSearchApiKey = dom.webSearchApiKeyInput.value.trim();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings, webSearchProvider: state.webSearchProvider, webSearchApiKey: state.webSearchApiKey } }).catch(() => {});
    });
  }

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

  dom.collectBtn.addEventListener('click', () => { lastTabUrl = ''; collectPageContext(); });

  if (dom.highlightToggleBtn) {
    dom.highlightToggleBtn.addEventListener('click', async () => {
      state.highlightsVisible = !state.highlightsVisible;
      const tab = await chrome.tabs.query({ active: true, currentWindow: true }).then(t => t[0]).catch(() => null);
      if (!tab?.id) {
        setStatus('No active tab', 'error');
        return;
      }

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'page.highlight.toggle',
          visible: state.highlightsVisible
        });
      } catch (e) {}
      setStatus(state.highlightsVisible ? 'Highlights shown' : 'Highlights hidden', 'success');
    });
  }

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

  dom.historySearch.addEventListener('input', (e) => {
    filterHistory(e.target.value);
  });

  dom.vaultBtn.addEventListener('click', toggleVaultOnBtn);

  if (dom.vaultApiUrlInput) {
    dom.vaultApiUrlInput.addEventListener('change', () => {
      state.settings.vaultApiUrl = dom.vaultApiUrlInput.value.trim();
      updateVaultBtn();
      updateBadge();
      updateVaultNoteIndicator();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
    });
  }

  if (dom.vaultApiTokenInput) {
    dom.vaultApiTokenInput.addEventListener('change', () => {
      state.settings.vaultApiToken = dom.vaultApiTokenInput.value.trim();
      updateVaultBtn();
      updateBadge();
      updateVaultNoteIndicator();
      sendBgMessage({ type: 'settings.save', data: { ...state.settings } }).catch(() => {});
    });
  }

  if (dom.vaultApiTestBtn) {
    dom.vaultApiTestBtn.addEventListener('click', async () => {
      if (!dom.vaultApiStatus) return;
      dom.vaultApiStatus.textContent = '...';
      dom.vaultApiStatus.className = 'form-hint';

      const url = dom.vaultApiUrlInput?.value.trim() || '';
      const token = dom.vaultApiTokenInput?.value.trim() || '';

      if (!url || !token) {
        dom.vaultApiStatus.textContent = i18n('settingsVaultApiTestFail') + ': URL or token empty';
        dom.vaultApiStatus.className = 'form-hint error';
        return;
      }

      try {
        const result = await sendBgMessage({
          type: 'vault.api.test',
          url,
          token,
        });
        if (result && !result.error) {
          dom.vaultApiStatus.textContent = i18n('settingsVaultApiTestOk');
          dom.vaultApiStatus.className = 'form-hint ok';
          state.vaultConnected = true;
          state.autoVault = true;
          updateVaultBtn();
          updateBadge();
          if (state.autoVault && !state.currentVaultFilename) getOrCreateSessionFilename();
          updateVaultNoteIndicator();
        } else {
          dom.vaultApiStatus.textContent = `${i18n('settingsVaultApiTestFail')}: ${result?.error || 'Unknown'}`;
          dom.vaultApiStatus.className = 'form-hint error';
          state.vaultConnected = false;
          updateVaultBtn();
          updateBadge();
          updateVaultNoteIndicator();
        }
      } catch (err) {
        dom.vaultApiStatus.textContent = `${i18n('settingsVaultApiTestFail')}: ${err.message}`;
        dom.vaultApiStatus.className = 'form-hint error';
      }
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
    if (dom.baseUrlInput) dom.baseUrlInput.value = state.settings.baseUrl || 'https://openrouter.ai/api/v1';
    updateCurrentModelDisplay();
    dom.systemPromptInput.value = state.settings.systemPrompt || '';

    chrome.storage.local.get(['openagent_vision_models'], (res) => {
      if (res.openagent_vision_models) {
        state.visionModels = res.openagent_vision_models;
      }
      loadModels();
    });

    // Vault name (subfolder path)
    if (dom.vaultNameInput) dom.vaultNameInput.value = state.settings.vaultName || '';

    // Vault API settings
    if (dom.vaultApiUrlInput) dom.vaultApiUrlInput.value = state.settings.vaultApiUrl || '';
    if (dom.vaultApiTokenInput) dom.vaultApiTokenInput.value = state.settings.vaultApiToken || '';

    const autoData = await sendBgMessage({ type: 'autovault.load' });
    state.autoVault = autoData?.autoVault || false;
    state.webSearch = data.webSearch || false;
    state.webSearchProvider = data.webSearchProvider || 'openrouter';
    state.webSearchApiKey = data.webSearchApiKey || '';

    // Apply web search toggle UI
    if (state.webSearch) {
      dom.webSearchOn.classList.add('active');
      dom.webSearchOff.classList.remove('active');
      if (dom.inputWrapper) dom.inputWrapper.classList.add('web-search-active');
      if (dom.webSearchProviderGroup) dom.webSearchProviderGroup.classList.remove('hidden');
      if (dom.webSearchProvider) dom.webSearchProvider.value = state.webSearchProvider;
      if (dom.webSearchApiKeyInput) dom.webSearchApiKeyInput.value = state.webSearchApiKey;
      updateWebSearchApiKeyVisibility();
    } else {
      dom.webSearchOff.classList.add('active');
      dom.webSearchOn.classList.remove('active');
      if (dom.inputWrapper) dom.inputWrapper.classList.remove('web-search-active');
      if (dom.webSearchProviderGroup) dom.webSearchProviderGroup.classList.add('hidden');
      if (dom.webSearchApiKeyGroup) dom.webSearchApiKeyGroup.classList.add('hidden');
    }

    // Auto-connect vault if URL+token are configured
    if (state.settings.vaultApiUrl && state.settings.vaultApiToken) {
      const result = await vaultApiTest();
      state.vaultConnected = !result.error;
      if (dom.vaultApiStatus) {
        if (state.vaultConnected) {
          dom.vaultApiStatus.textContent = i18n('settingsVaultApiTestOk');
          dom.vaultApiStatus.className = 'form-hint ok';
        } else {
          dom.vaultApiStatus.textContent = result?.error ? result.error.replace(/^.*?: /, '') : '';
          dom.vaultApiStatus.className = 'form-hint error';
        }
      }
      // Auto-enable vault if not already set
      if (state.vaultConnected && !autoData?.autoVault) {
        state.autoVault = true;
      }
      // Create vault filename immediately so it shows in status bar
      if (state.vaultConnected && state.autoVault && !state.currentVaultFilename) {
        getOrCreateSessionFilename();
      }
    }

    updateVaultBtn();
    updateBadge();
    updateVaultNoteIndicator();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function handleSaveSettings() {
  const apiKey = dom.apiKeyInput.value.trim();
  const baseUrl = dom.baseUrlInput ? dom.baseUrlInput.value.trim() || 'https://openrouter.ai/api/v1' : state.settings.baseUrl;
  const model = state.settings.model;
  const systemPrompt = dom.systemPromptInput.value.trim();
  const theme = state.settings.theme;
  const preset = dom.themePreset.value;
  const language = state.settings.language;
  const vaultApiUrl = dom.vaultApiUrlInput ? dom.vaultApiUrlInput.value.trim() : state.settings.vaultApiUrl;
  const vaultApiToken = dom.vaultApiTokenInput ? dom.vaultApiTokenInput.value.trim() : state.settings.vaultApiToken;
  const vaultName = dom.vaultNameInput ? dom.vaultNameInput.value.trim() : state.settings.vaultName;
  const fontSize = dom.fontSizeSelect.value;

  try {
    await sendBgMessage({
      type: 'settings.save',
      data: { apiKey, provider: 'openrouter', baseUrl, model, systemPrompt, theme, preset, language, vaultApiUrl, vaultApiToken, vaultName, fontSize, webSearch: state.webSearch, webSearchProvider: state.webSearchProvider, webSearchApiKey: state.webSearchApiKey },
    });
    state.settings = { ...state.settings, apiKey, provider: 'openrouter', baseUrl, model, systemPrompt, theme, preset, language, vaultApiUrl, vaultApiToken, vaultName, fontSize, webSearch: state.webSearch, webSearchProvider: state.webSearchProvider, webSearchApiKey: state.webSearchApiKey };
    dom.settingsStatus.textContent = i18n('settingsSaved');
    dom.settingsStatus.className = 'settings-status';
    toggleModal(false);
    loadModels();
    updateModelBadge();
    updateVaultBtn();
    updateBadge();
    if (state.autoVault && !state.currentVaultFilename) getOrCreateSessionFilename();
    updateVaultNoteIndicator();
  } catch (err) {
    dom.settingsStatus.textContent = 'Error: ' + err.message;
    dom.settingsStatus.className = 'settings-status error';
  }
}

// ─── Model Loading ────────────────────────────────────────────────────────────

async function loadModels() {
  const apiKey = dom.apiKeyInput.value.trim() || state.settings.apiKey;
  const baseUrl = (dom.baseUrlInput ? dom.baseUrlInput.value.trim() : '') || state.settings.baseUrl || 'https://openrouter.ai/api/v1';
  const normalizedUrl = baseUrl.replace(/\/+$/, '');

  dom.modelList.innerHTML = `<div class="model-loading">${i18n('settingsLoading')}</div>`;

  if (!apiKey) {
    dom.modelList.innerHTML = `<div class="model-loading">${i18n('settingsEnterApiKey')}</div>`;
    dom.modelHint.textContent = '';
    return;
  }

  try {
    const resp = await fetch(normalizedUrl + '/models', {
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
  state.messages.push({ role: 'user', content: originalText, domain: state.currentDomain });

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

    loadingDiv.querySelector('.message-content').textContent = i18n('actionResultSuccess');
    state.messages.push({ role: 'assistant', content: i18n('actionResultSuccess'), domain: state.currentDomain });

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
    loadingDiv.querySelector('.message-content').textContent = i18n('actionResultFailed') + ': ' + err.message;
    loadingDiv.querySelector('.message-content').style.color = '#f87171';
    state.messages.push({ role: 'assistant', content: i18n('actionResultFailed') + ': ' + err.message, domain: state.currentDomain });
  }
}

// ─── Send ─────────────────────────────────────────────────────────────────────

const NAV_PATTERNS = [
  /^(?:go\s*to|open|visit|navigate|nav)\s+(.+)/i,
  /^((?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})+(?:\/\S*)?))$/i,
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
    if (!HTTPS_RE.test(url)) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        return null;
      }
    }
    return { type: 'url', url };
  }

  const bareMatch = trimmed.match(NAV_PATTERNS[1]);
  if (bareMatch) {
    const url = bareMatch[1];
    if (!HTTPS_RE.test(url)) {
      return { type: 'url', url: 'https://' + url };
    }
    return { type: 'url', url };
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

async function handleObsidianSearch(query) {
  if (!state.vaultConnected) {
    setStatus(i18n('statusVaultDisconnected'), 'error');
    return;
  }
  dom.input.value = '';
  dom.input.style.height = 'auto';
  state.messages.push({ role: 'user', content: `/o ${query}`, domain: state.currentDomain });
  renderMessage('user', `/o ${query}`);
  showTyping();
  state.isLoading = true;

  try {
    const result = await vaultReadFiles(query, 10);
    if (result?.error) {
      renderMessage('assistant', `Vault search failed: ${result.error}`);
    } else if (result?.notes?.length > 0) {
      const lines = result.notes.map((n) => `**${n.displayFilename || n.filename}**\n${(n.content || '').slice(0, 4000)}`).join('\n\n---\n\n');
      renderMessage('assistant', `Found ${result.notes.length} note(s):\n\n${lines}`);
    } else {
      renderMessage('assistant', `No results found for "${query}" in vault.`);
    }
  } catch (err) {
    renderMessage('assistant', `Vault search error: ${err.message}`);
  }
  removeTyping();
  state.isLoading = false;
}

async function handleSend() {
  const text = dom.input.value.trim();
  if (!text || state.isLoading) return;

  if (!state.settings.apiKey) {
    toggleModal(true);
    setStatus(i18n('statusApiKeyNeeded'), 'error');
    return;
  }

  // /o — search Obsidian vault
  const obsidianMatch = text.trim().match(/^\/o\s+(.+)/i);
  if (obsidianMatch) {
    await handleObsidianSearch(obsidianMatch[1].trim());
    return;
  }

  // /i — update intent without calling agent
  const intentMatch = text.trim().match(/^\/i\s+(.+)/i);
  if (intentMatch) {
    state.vaultIntent = intentMatch[1].trim().slice(0, 200);
    dom.input.value = '';
    dom.input.style.height = 'auto';
    state.isLoading = false;
    dom.sendBtn.disabled = false;
    // Rewrite frontmatter with new intent (no new content)
    if (state.currentVaultFilename) {
      vaultWrite(state.currentVaultFilename, '').catch(() => {});
    }
    state.messages.push({ role: 'assistant', content: i18n('intentUpdated').replace('$1', state.vaultIntent), domain: state.currentDomain });
    renderMessage('assistant', i18n('intentUpdated').replace('$1', state.vaultIntent));
    return;
  }

  const navIntent = extractNavigationIntent(text);
  if (navIntent) {
    await handleNavigation(navIntent.url, text);
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
  state.messages.push({ role: 'user', content: text, domain: state.currentDomain });
  renderMessage('user', text);

  showTyping();
  state.isLoading = true;
  dom.sendBtn.disabled = true;

  // Ensure vault filename exists before sending
  if (state.autoVault && state.vaultConnected && !state.currentVaultFilename) {
    state.currentVaultFilename = getOrCreateSessionFilename();
    updateVaultNoteIndicator();
  }

  try {
    const model = state.settings.model;
    const screenshotToSend = state.pageScreenshot || state.pastedImage || null;
    if (screenshotToSend && !model) {
      // No model selected — clear both
      screenshotToSend = null;
      state.pageScreenshot = null;
      state.pastedImage = null;
    } else if (screenshotToSend && !modelSupportsVision(model)) {
      // Model doesn't support vision — show info but send text without image
      const infoMsg = i18n('msgScreenshotSaved');
      removeTyping();
      renderMessage('info', infoMsg);
      state.isLoading = false;
      dom.sendBtn.disabled = false;
      // Send the message without the screenshot so AI can still respond
      const textOnlyMessages = state.messages.map((m) => {
        if (m.content === '[screenshot]') {
          return { ...m, content: '[Screenshot omitted — model lacks vision support]' };
        }
        return m;
      });
      const response = await sendBgMessage({
        type: 'prompt.send',
        conversationHistory: textOnlyMessages,
        pageContext: state.pageContext,
        pageScreenshot: null, // Don't send image
        pageLinks: state.pageLinks,
        domTree: state.domTree,
        autoVault: state.autoVault,
        vaultConnected: state.vaultConnected,
        vaultApiUrl: state.settings.vaultApiUrl,
        vaultName: state.settings.vaultName,
        vaultFilename: state.currentVaultFilename,
        memoryContext: state.memoryContext,
        webSearch: state.webSearch,
        webSearchProvider: state.webSearchProvider,
        webSearchApiKey: state.webSearchApiKey,
        vaultIntent: state.vaultIntent,
      });
      removeTyping();
      state.pageScreenshot = null;
      state.pastedImage = null;
      if (response.error) {
        renderMessage('error', response.error);
      } else {
        const content = response.content || '';
        const { readResults, writeResults, errors } = await processVaultToolCalls(content);
        let finalContent = content;
        if (errors.length > 0) finalContent += '\n\n**Vault errors:**\n' + errors.join('\n');
        if (writeResults.length > 0) {
          const confirmed = writeResults.map((p) => `✓ Saved: ${p.split('/').pop()}`).join('\n');
          finalContent = content.replace(/<vault_write[^>]*>[\s\S]*?<\/vault_write>/gi, '');
          finalContent += '\n\n' + confirmed;
        }
        if (readResults.length > 0) {
          finalContent += '\n\n**From vault:**\n' + readResults.map((n) => `## ${n.filename}\n${n.content}`).join('\n\n---\n\n');
        }
        if (response.actionResult) {
          let actionMsgs = [];
          if (Array.isArray(response.actionResult)) {
            for (const r of response.actionResult) {
              if (r && typeof r === 'object') {
                const innerResult = r.result || r;
                const ok = innerResult?.ok ?? r.ok ?? false;
                const msg = innerResult?.message || innerResult?.summary || r.message || r.summary || i18n('actionResultSuccess');
                const err = innerResult?.error || innerResult?.message || r.error || r.message || i18n('actionResultFailed');
                actionMsgs.push(ok ? `✓ ${msg}` : `✗ ${err}`);
              }
            }
          } else if (response.actionResult && typeof response.actionResult === 'object') {
            const r = response.actionResult;
            const innerResult = r.result || r;
            const ok = innerResult?.ok ?? r.ok ?? false;
            const msg = innerResult?.message || innerResult?.summary || r.message || r.summary || i18n('actionResultSuccess');
            const err = innerResult?.error || innerResult?.message || r.error || r.message || i18n('actionResultFailed');
            actionMsgs.push(ok ? `✓ ${msg}` : `✗ ${err}`);
          }
          if (actionMsgs.length > 0) {
            finalContent += '\n\n**' + i18n('actionResultTitle') + '**\n' + actionMsgs.join('\n');
          }
        }
        state.messages.push({ role: 'assistant', content: finalContent, domain: state.currentDomain });
        renderMessage('assistant', finalContent);
        if (state.autoVault && state.vaultConnected) saveAutoVaultNote().catch((err) => console.error('[SP] auto-vault error:', err));
        saveConversation();
        processConversationEnd().catch((err) => console.error('[SP] memory process error:', err));
      }
      state.isLoading = false;
      dom.sendBtn.disabled = false;
      return;
    }

    const response = await sendBgMessage({
      type: 'prompt.send',
      conversationHistory: state.messages,
      pageContext: state.pageContext,
      pageScreenshot: screenshotToSend,
      pageLinks: state.pageLinks,
      domTree: state.domTree,
      autoVault: state.autoVault,
      vaultConnected: state.vaultConnected,
      vaultApiUrl: state.settings.vaultApiUrl,
      vaultName: state.settings.vaultName,
      vaultFilename: state.currentVaultFilename,
      memoryContext: state.memoryContext,
      webSearch: state.webSearch,
      webSearchProvider: state.webSearchProvider,
      webSearchApiKey: state.webSearchApiKey,
      vaultIntent: state.vaultIntent,
    });

    removeTyping();

    if (response.error) {
      const isVisionError = response.error.includes('image') || response.error.includes('vision') || response.error.includes('endpoint');
      if (isVisionError && screenshotToSend) {
        // Already showed info message — clear screenshots but still save to vault
        state.pageScreenshot = null;
        state.pastedImage = null;
        if (state.autoVault && state.vaultConnected) {
          saveAutoVaultNote().catch((err) => console.error('[SP] auto-vault error:', err));
        }
        saveConversation();
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

      // Handle action results (click, scroll, etc.)
      if (response.actionResult) {
        let actionMsgs = [];
        if (Array.isArray(response.actionResult)) {
          for (const r of response.actionResult) {
            if (r && typeof r === 'object') {
              const innerResult = r.result || r;
              const ok = innerResult?.ok ?? r.ok ?? false;
              const msg = innerResult?.message || innerResult?.summary || r.message || r.summary || i18n('actionResultSuccess');
              const err = innerResult?.error || innerResult?.message || r.error || r.message || i18n('actionResultFailed');
              actionMsgs.push(ok ? `✓ ${msg}` : `✗ ${err}`);
            }
          }
        } else if (response.actionResult && typeof response.actionResult === 'object') {
          const r = response.actionResult;
          const innerResult = r.result || r;
          const ok = innerResult?.ok ?? r.ok ?? false;
          const msg = innerResult?.message || innerResult?.summary || r.message || r.summary || i18n('actionResultSuccess');
          const err = innerResult?.error || innerResult?.message || r.error || r.message || i18n('actionResultFailed');
          actionMsgs.push(ok ? `✓ ${msg}` : `✗ ${err}`);
        }
        if (actionMsgs.length > 0) {
          finalContent += '\n\n**' + i18n('actionResultTitle') + '**\n' + actionMsgs.join('\n');
        }
      }

      state.messages.push({ role: 'assistant', content: finalContent, domain: state.currentDomain });
      renderMessage('assistant', finalContent);

      // Clear screenshots after successful response
      state.pageScreenshot = null;
      state.pastedImage = null;

      if (state.autoVault && state.vaultConnected) {
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

let lastTabUrl = '';
let lastContextTime = 0;

async function collectPageContext() {
  const tab = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(t => t[0]).catch(() => null);
  if (!tab?.id || !tab.url?.startsWith('http')) {
    return;
  }

  const tabUrl = tab.url;

  if (tabUrl === lastTabUrl) {
    return;
  }

  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); } catch (e) {}
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['buildDomTree.js'] }); } catch (e) {}

  await new Promise(r => setTimeout(r, 500));

  let data = null;
  try {
    data = await chrome.tabs.sendMessage(tab.id, { type: 'page.collect', overrideUrl: tabUrl }).catch(e => ({ rawCapture: null, error: e.message }));
  } catch (e) {}

  if (data?.rawCapture && !data.error) {
    const respUrl = data.rawCapture.metadata?.url || '';
    if (respUrl === tabUrl) {
      lastTabUrl = tabUrl;
      const domain = (() => { try { return new URL(tabUrl).hostname.replace(/^www\./, '').replace(/\./g, '-'); } catch { return 'openagent'; } })();
      state.pageContext = {
        metadata: {
          url: tabUrl,
          title: tab.title || '',
          favicon: tab.favIconUrl || '',
          domain,
        },
        bodyText: data.rawCapture.bodyText || '',
        images: data.rawCapture.images || [],
      };
      prependPageContext(state.pageContext.metadata);
      state.currentDomain = domain;
    }
  }

  try {
    const linksData = await chrome.tabs.sendMessage(tab.id, { type: 'page.links.collect' }).catch(e => ({ links: [] }));
    if (linksData?.links) {
      state.pageLinks = linksData.links;
    }
  } catch (e) {}

  try {
    const domData = await chrome.tabs.sendMessage(tab.id, { type: 'page.dom.tree' }).catch(e => ({ error: e.message }));
    if (domData && !domData.error && domData.elements) {
      state.domTree = domData;

      // Auto-highlight interactive elements
      const interactiveElements = domData.elements.filter(el => el && el.highlightIndex != null);
      if (interactiveElements.length > 0) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'page.highlight',
          elements: interactiveElements
        }).catch(e => console.error('[OpenAgent] highlight error:', e));
      }
    }
  } catch (e) { console.error('[OpenAgent] DOM tree block error:', e); }
}

async function loadCachedContext() {
  lastTabUrl = '';
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
    // Track screenshot as user message for history
    state.messages.push({ role: 'user', content: '[screenshot]', domain: state.currentDomain, imageData: data.dataUrl });
    dom.messages.scrollTop = dom.messages.scrollHeight;

    // Create vault note immediately if this is the first message
    if (state.autoVault && state.vaultConnected && !state.currentVaultFilename) {
      state.currentVaultFilename = getOrCreateSessionFilename();
    }
    if (state.autoVault && state.vaultConnected && state.currentVaultFilename && !state.vaultWritten) {
      forceCreateVaultNote().catch((err) => console.error('[SP] auto-vault error:', err));
    } else if (state.autoVault && state.vaultConnected && state.currentVaultFilename) {
      saveAutoVaultNote().catch((err) => console.error('[SP] auto-vault error:', err));
    }
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

  state.currentDomain = metadata.domain || null;
  // Update vault filename only when visiting a different page
  if (state.autoVault && state.vaultConnected) {
    const currentUrl = metadata.url || state.pageContext?.metadata?.url || '';
    const candidateFilename = (() => {
      const url = currentUrl;
      if (!url) return 'openagent';
      try {
        const date = new Date();
        const dateStr = formatDate(date);
        const domain = new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-');
        return `${domain}-${dateStr}.md`;
      } catch {
        return 'openagent';
      }
    })();
    if (state.currentVaultFilename && state.currentVaultFilename !== candidateFilename) {
      state.currentVaultFilename = candidateFilename;
      state.vaultSavedCount = 0;
      state.vaultWritten = false;
      // keep vaultIntent — it's per-file, not per-page
      updateVaultNoteIndicator();
    } else if (!state.currentVaultFilename) {
      state.currentVaultFilename = candidateFilename;
      updateVaultNoteIndicator();
    }
  }
}

function clearConversation() {
  if (state.messages.length > 0) {
    saveConversation();
    processConversationEnd().catch((err) => console.error('[SP] memory process error:', err));
  }
  state.messages = [];
  state.currentConversationId = null;
  state.currentVaultFilename = null;
  state.vaultSavedCount = 0;
  state.vaultWritten = false;
  state.vaultIntent = null;
  state.currentDomain = null;
  state.memoryContext = null;
  state.pageScreenshot = null;
  state.pastedImage = null;
  lastTabUrl = '';
  renderMessages();
  if (state.pageContext?.metadata) prependPageContext(state.pageContext.metadata);
  updateBadge();
}

function saveConversation() {
  if (state.messages.length === 0) return;

  const url = state.pageContext?.metadata?.url || state.pageContext?.url || '';
  const domain = (() => {
    if (!url) return 'openagent';
    try { return new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-'); } catch { return 'openagent'; }
  })();
  const date = new Date();
  const dateStr = formatDate(date);
  const convId = `${domain}-${dateStr}`;

  // Only save messages that belong to this conversation's domain
  const convMessages = state.messages.filter((m) => m.domain === domain);
  if (convMessages.length === 0 && state.messages.length > 0) return; // no messages for this domain yet

  const existing = state.conversations.find((c) => c.id === convId);
  if (existing) {
    // Append only new messages (deduped by first 50 chars of content)
    const existingIds = new Set(existing.messages.map((m) => m.content?.slice(0, 50)));
    const newMsgs = convMessages.filter((m) => !existingIds.has(m.content?.slice(0, 50)));
    if (newMsgs.length > 0) {
      existing.messages = existing.messages.concat(newMsgs);
    }
    existing.timestamp = Date.now();
    existing.bodyText = state.pageContext?.bodyText || existing.bodyText;
    existing.images = state.pageContext?.images || existing.images;
    existing.vaultFilename = state.currentVaultFilename || existing.vaultFilename;
    chrome.storage.local.set({ openagent_conversations: state.conversations });
    state.currentConversationId = convId;
    return;
  }

  const conv = {
    id: convId,
    pageUrl: url,
    pageTitle: state.pageContext?.metadata?.title || document.title,
    timestamp: Date.now(),
    messages: convMessages,
    bodyText: state.pageContext?.bodyText || '',
    images: state.pageContext?.images || [],
    vaultFilename: state.currentVaultFilename || null,
  };
  state.conversations = [conv, ...state.conversations].slice(0, 50);
  state.currentConversationId = convId;
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

function filterHistory(query) {
  const term = query.toLowerCase().trim();
  if (!term) {
    document.querySelectorAll('.history-drawer-item').forEach((el) => { el.style.display = ''; });
    return;
  }
  const words = term.split(/\s+/).filter(Boolean);
  const items = document.querySelectorAll('.history-drawer-item');
  items.forEach((el) => {
    const elId = el.dataset.id;
    const conv = state.conversations.find((c) => c.id === elId);
    if (!conv) { el.style.display = 'none'; return; }
    // Check title (domain-date id)
    const titleText = (conv.id || '').toLowerCase();
    const titleWordMatch = words.every((w) => titleText.includes(w));
    // Check messages
    const msgText = (conv.messages || []).map((m) => m.content || '').join(' ').toLowerCase();
    const msgWordMatch = words.every((w) => msgText.includes(w));
    // Show only if ALL words match in title OR in messages
    el.style.display = (titleWordMatch || msgWordMatch) ? '' : 'none';
  });
}

function renderHistoryPanel() {
  dom.historyDrawerClose.textContent = '×';
  dom.historySearch.value = '';
  if (state.conversations.length === 0) {
    dom.historyDrawerList.innerHTML = `<div class="history-drawer-empty">${i18n('historyEmpty')}</div>`;
  } else {
    dom.historyDrawerList.innerHTML = state.conversations.map((conv) => {
      const date = new Date(conv.timestamp);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="history-drawer-item" data-id="${conv.id}">
        <div class="history-drawer-row">
          <div class="history-drawer-title">${escapeHtml(conv.id)}</div>
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
      restoreConversation(el.dataset.id);
    });
  });
  dom.historyDrawerList.querySelectorAll('.history-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(btn.dataset.delete);
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
  state.currentVaultFilename = conv.vaultFilename || null;
  state.vaultWritten = !!conv.vaultFilename;
  state.vaultIntent = null;
  // Restore messages with screenshot imageData preserved
  state.messages = conv.messages.map((m) => ({ ...m }));
  state.vaultSavedCount = conv.messages.length;

  state.historyOpen = false;
  document.getElementById('historyPanel').classList.add('hidden');

  // Always load current page context after restoring conversation
  lastTabUrl = '';
  collectPageContext();

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
    const imgData = msg.content === '[screenshot]' ? msg.imageData : null;
    renderMessage(msg.role === 'user' ? 'user' : 'assistant', msg.content, imgData);
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

function renderMessage(role, content, imageData) {
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

  const contentHtml = imageData
    ? `<img class="screenshot-thumb" src="${imageData}" />`
    : formatted;

  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="message-label">${label}</div>
    ${copyBtnHtml}
    <div class="message-content">${contentHtml}</div>
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
  // Links — make URLs and markdown links clickable (skip if already inside a tag or link)
  processed = processed.replace(/(<a\b[^>]*>[\s\S]*?<\/a>|<code\b[^>]*>[\s\S]*?<\/code>|<pre\b[^>]*>[\s\S]*?<\/pre>)/g, (match) => `__SKIP__${match}__SKIP__`);
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  processed = processed.replace(/(?:^|(?<=[ ">=\]]))(https?:\/\/[^\s<]+)/gm, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  processed = processed.replace(/__SKIP__|__SKIP__/g, '');
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
  // Tables — build HTML and replace markers
  if (tableRows.length > 0) {
    let tableHtml = '<div class="table-wrapper"><table>';
    // Detect header row (the separator row with ---)
    let headerIdx = -1;
    for (let i = 0; i < tableRows.length; i++) {
      if (tableRows[i].some((c) => /^-+$/.test(c))) { headerIdx = i; break; }
    }
    for (let i = 0; i < tableRows.length; i++) {
      if (i === headerIdx) continue; // skip separator row
      const tag = headerIdx !== -1 && i < headerIdx ? 'th' : 'td';
      const cellHtml = tableRows[i].map((c) => `<${tag}>${c}</${tag}>`).join('');
      tableHtml += `<tr>${cellHtml}</tr>`;
    }
    tableHtml += '</table></div>';
    processed = processed.replace(/__TROW_(\d+)__/g, (match, idx) => {
      return parseInt(idx) === tableRows.length - 1 ? tableHtml : '';
    });
  }
  // Line breaks — collapse runs of <br> to max 1
  processed = processed.replace(/\n/g, '<br>');
  processed = processed.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
  processed = processed.replace(/<br\s*\/?>\s*$/gi, '');
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
  dom.status.className = 'status' + (type ? ` ${type}` : '');
  if (!type) {
    setTimeout(() => {
      dom.status.className = 'status';
    }, 3000);
  }
}

function updateModelBadge() {
  const model = state.settings.model;
  if (model) {
    dom.statusModel.textContent = i18n('statusModel') + ' ' + (model.includes('/') ? model.split('/')[1].replace(/-(?:2024|2025)[0-9]*$/, '') : model);
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

function updateWebSearchApiKeyVisibility() {
  if (!dom.webSearchApiKeyGroup) return;
  if (state.webSearchProvider === 'openrouter') {
    dom.webSearchApiKeyGroup.classList.add('hidden');
  } else {
    dom.webSearchApiKeyGroup.classList.remove('hidden');
  }
}

function updateBadge() {
  const hasApiUrl = !!(state.settings.vaultApiUrl && state.settings.vaultApiToken);
  const isVaultActive = hasApiUrl && state.autoVault && state.vaultConnected;
  const iconPath = isVaultActive
    ? chrome.runtime.getURL('icons/openagent-purple-16.png')
    : null;
  chrome.action.setIcon({ path: { '16': iconPath || 'icons/openagent-16.png', '24': iconPath || 'icons/openagent-24.png', '32': iconPath || 'icons/openagent-32.png', '48': iconPath || 'icons/openagent-48.png', '128': iconPath || 'icons/openagent-128.png' } });
  chrome.action.setBadgeText({ text: '' });
}

function updateVaultNoteIndicator() {
  const hasApiUrl = !!(state.settings.vaultApiUrl && state.settings.vaultApiToken);
  const isVaultActive = hasApiUrl && state.autoVault && state.vaultConnected;
  if (isVaultActive && state.currentVaultFilename) {
    dom.statusVault.classList.remove('hidden');
    dom.statusVaultName.textContent = state.currentVaultFilename;
  } else {
    dom.statusVault.classList.add('hidden');
    dom.statusVaultName.textContent = '';
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
    state.settings.model,
    state.settings.baseUrl
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

  // Support both query= and path= attributes for vault_read
  const readMatches = [...messageContent.matchAll(/<vault_read\s+(?:query|path)="([^"]*)"\s*\/>/gi)];

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
    const result = await vaultWrite(filename, content);
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

// Creates or overwrites the vault note with current messages (for first-screenshot scenarios)
async function forceCreateVaultNote() {
  if (!state.autoVault || !state.vaultConnected || !state.currentVaultFilename) return;
  if (state.messages.length === 0) return;

  const pageUrl = state.pageContext?.metadata?.url || state.pageContext?.url || '';
  const date = new Date();
  const dateStr = formatDate(date);
  const timeStr = formatTime(date);

  const lines = [`# Session — ${dateStr} ${timeStr}`, pageUrl ? `**URL:** ${pageUrl}` : ''];
  for (const msg of state.messages) {
    if (msg.content === '[screenshot]' && msg.imageData) {
      lines.push(`\n**You**:\n![screenshot](${msg.imageData})`);
      continue;
    }
    const role = msg.role === 'user' ? '**You**' : '**OpenAgent**';
    let text = (msg.content || '').replace(/<vault_write[^>]*>[\s\S]*?<\/vault_write>/gi, '').replace(/<vault_read[^>]*\/>/gi, '').replace(/\*\*From vault:\*\*[\s\S]*/gi, '').replace(/^✓ Saved:.*$/gm, '').trim();
    if (text) lines.push(`\n${role}:\n${text}`);
  }
  lines.push('\n---\n*OpenAgent Chrome Extension*');

  const content = lines.join('\n');
  const result = await vaultWrite(state.currentVaultFilename, content);
  if (result?.error) return;
  state.vaultWritten = true;
  state.vaultSavedCount = state.messages.length;
}

async function saveAutoVaultNote() {
  if (!state.autoVault || !state.vaultConnected) return;
  const filename = getOrCreateSessionFilename();
  if (!filename) return;

  const newMessages = state.messages.slice(state.vaultSavedCount);
  if (newMessages.length === 0) return;

  const pageUrl = state.pageContext?.metadata?.url || state.pageContext?.url || '';

  let content;
  if (state.vaultWritten) {
    // Already written — just append new messages
    const lines = [];
    for (const msg of newMessages) {
      if (msg.content === '[screenshot]' && msg.imageData) {
        // Embed screenshot as base64 image in markdown
        lines.push(`**You**:\n![screenshot](${msg.imageData})`);
        continue;
      }
      const role = msg.role === 'user' ? '**You**' : '**OpenAgent**';
      let text = (msg.content || '').replace(/<vault_write[^>]*>[\s\S]*?<\/vault_write>/gi, '').replace(/<vault_read[^>]*\/>/gi, '').replace(/\*\*From vault:\*\*[\s\S]*/gi, '').replace(/^✓ Saved:.*$/gm, '').trim();
      if (text) lines.push(`${role}:\n${text}`);
    }
    if (lines.length === 0) return;
    content = lines.join('\n\n');
    const result = await vaultWrite(filename, content);
    if (result?.error) return;
  } else {
    // First save for this session: full header + all messages
    const date = new Date();
    const dateStr = formatDate(date);
    const timeStr = formatTime(date);
    const lines = [`# Session — ${dateStr} ${timeStr}`, pageUrl ? `**URL:** ${pageUrl}` : ''];
    for (const msg of newMessages) {
      if (msg.content === '[screenshot]' && msg.imageData) {
        lines.push(`\n**You**:\n![screenshot](${msg.imageData})`);
        continue;
      }
      const role = msg.role === 'user' ? '**You**' : '**OpenAgent**';
      let text = (msg.content || '').replace(/<vault_write[^>]*>[\s\S]*?<\/vault_write>/gi, '').replace(/<vault_read[^>]*\/>/gi, '').replace(/\*\*From vault:\*\*[\s\S]*/gi, '').replace(/^✓ Saved:.*$/gm, '').trim();
      if (text) lines.push(`\n${role}:\n${text}`);
    }
    lines.push('\n---\n*OpenAgent Chrome Extension*');
    content = lines.join('\n');
    const result = await vaultWrite(filename, content);
    if (result?.error) return;
    state.vaultWritten = true;
  }

  state.vaultSavedCount = state.messages.length;
}

// ─── Start ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
