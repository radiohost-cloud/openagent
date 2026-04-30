// db.js - IndexedDB wrapper for OpenAgent
// Stores conversations, summaries, and memory

const DB_NAME = 'openagent_db';
const DB_VERSION = 1;

const STORES = {
  CONVERSATIONS: 'conversations',
  SUMMARIES: 'summaries',
  MEMORY: 'memory',
};

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // conversations: full chat logs
      if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
        const convStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
        convStore.createIndex('domain', 'domain', { unique: false });
        convStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // summaries: conversation summaries with metadata
      if (!db.objectStoreNames.contains(STORES.SUMMARIES)) {
        const sumStore = db.createObjectStore(STORES.SUMMARIES, { keyPath: 'id' });
        sumStore.createIndex('domain', 'domain', { unique: false });
        sumStore.createIndex('topics', 'topics', { unique: false });
        sumStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // memory: key facts extracted from conversations
      if (!db.objectStoreNames.contains(STORES.MEMORY)) {
        const memStore = db.createObjectStore(STORES.MEMORY, { keyPath: 'id', autoIncrement: true });
        memStore.createIndex('domain', 'domain', { unique: false });
        memStore.createIndex('topics', 'topics', { unique: false });
      }
    };
  });
}

// ─── Conversations ────────────────────────────────────────────────────────────

async function saveConversation(conv) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONVERSATIONS, 'readwrite');
    const store = tx.objectStore(STORES.CONVERSATIONS);
    const request = store.put(conv);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getConversation(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONVERSATIONS, 'readonly');
    const store = tx.objectStore(STORES.CONVERSATIONS);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getConversationsByDomain(domain, limit = 5) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONVERSATIONS, 'readonly');
    const store = tx.objectStore(STORES.CONVERSATIONS);
    const index = store.index('domain');
    const request = index.getAll(domain);
    request.onsuccess = () => {
      const results = request.result
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getRecentConversations(limit = 10) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONVERSATIONS, 'readonly');
    const store = tx.objectStore(STORES.CONVERSATIONS);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── Summaries ────────────────────────────────────────────────────────────────

async function saveSummary(summary) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SUMMARIES, 'readwrite');
    const store = tx.objectStore(STORES.SUMMARIES);
    const request = store.put(summary);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSummary(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SUMMARIES, 'readonly');
    const store = tx.objectStore(STORES.SUMMARIES);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSummariesByDomain(domain, limit = 5) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SUMMARIES, 'readonly');
    const store = tx.objectStore(STORES.SUMMARIES);
    const index = store.index('domain');
    const request = index.getAll(domain);
    request.onsuccess = () => {
      const results = request.result
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getRecentSummaries(limit = 10) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SUMMARIES, 'readonly');
    const store = tx.objectStore(STORES.SUMMARIES);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── Memory (Key Facts) ────────────────────────────────────────────────────────

async function saveMemory(memory) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEMORY, 'readwrite');
    const store = tx.objectStore(STORES.MEMORY);
    const request = store.add(memory);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMemories(memories) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEMORY, 'readwrite');
    const store = tx.objectStore(STORES.MEMORY);
    let added = 0;
    memories.forEach((mem) => {
      const request = store.add(mem);
      request.onsuccess = () => added++;
      request.onerror = () => {};
    });
    tx.oncomplete = () => resolve(added);
    tx.onerror = () => reject(tx.error);
  });
}

async function getMemoriesByDomain(domain) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEMORY, 'readonly');
    const store = tx.objectStore(STORES.MEMORY);
    const index = store.index('domain');
    const request = index.getAll(domain);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function searchMemories(query, domain = null, limit = 10) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEMORY, 'readonly');
    const store = tx.objectStore(STORES.MEMORY);
    const request = store.getAll();
    request.onsuccess = () => {
      const queryLower = query.toLowerCase();
      const results = request.result
        .filter((mem) => {
          const matchesQuery = mem.fact.toLowerCase().includes(queryLower) ||
            (mem.topics || []).some((t) => t.toLowerCase().includes(queryLower));
          const matchesDomain = !domain || mem.domain === domain;
          return matchesQuery && matchesDomain;
        })
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllMemories(limit = 50) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEMORY, 'readonly');
    const store = tx.objectStore(STORES.MEMORY);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result.slice(0, limit);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

async function getRelevantContext(domain, topics = [], limit = 3) {
  // Get recent summaries from same domain or with overlapping topics
  const [summaries, memories] = await Promise.all([
    getSummariesByDomain(domain, limit),
    getMemoriesByDomain(domain),
  ]);

  // Also search by topics
  const topicMemories = [];
  for (const topic of topics.slice(0, 3)) {
    const found = await searchMemories(topic, domain, 5);
    topicMemories.push(...found);
  }

  // Dedupe and combine
  const seen = new Set();
  const allMemories = [...memories, ...topicMemories].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  }).slice(0, 20);

  return {
    summaries: summaries.slice(0, limit),
    memories: allMemories,
  };
}

async function clearAllData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.CONVERSATIONS, STORES.SUMMARIES, STORES.MEMORY], 'readwrite');
    tx.objectStore(STORES.CONVERSATIONS).clear();
    tx.objectStore(STORES.SUMMARIES).clear();
    tx.objectStore(STORES.MEMORY).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
