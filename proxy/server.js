// server.js - Local proxy server for OpenAgent Chrome Extension
// OpenRouter API proxy

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8787;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ─── Health Check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', provider: 'openrouter', timestamp: new Date().toISOString() });
});

// ─── Chat ─────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages, apiKey, model, stream } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'API key is required' });
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array is required' });

  const effectiveModel = model || 'anthropic/claude-sonnet-4-20250514';

  try {
    await handleOpenRouter(req, res, messages, apiKey, effectiveModel, !!stream);
  } catch (err) {
    console.error('API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── OpenRouter ───────────────────────────────────────────────────────────────

async function handleOpenRouter(req, res, messages, apiKey, model, stream) {
  const parts = model.split('/');
  const providerName = parts.length > 1 ? parts[0] : null;
  const providerParam = providerName
    ? { order: [providerName, 'OpenAI', 'Anthropic'] }
    : undefined;

  const body = { model, messages, stream, max_tokens: 8192 };
  if (providerParam) body.provider = providerParam;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://openagent.local',
      'X-Title': 'OpenAgent',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${error}`);
  }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();
  } else {
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    res.json({ content });
  }
}

// ─── Models List ──────────────────────────────────────────────────────────────

app.get('/api/models', async (req, res) => {
  const { apiKey } = req.query;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!resp.ok) throw new Error(`OpenRouter models error: ${resp.status}`);
    const data = await resp.json();

    const models = data.data
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        provider: m.id.split('/')[0],
      }))
      .sort((a, b) => {
        if (a.provider === 'anthropic' && b.provider !== 'anthropic') return -1;
        if (b.provider === 'anthropic' && a.provider !== 'anthropic') return 1;
        return a.name.localeCompare(b.name);
      });

    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Vault (Obsidian) ─────────────────────────────────────────────────────────

app.post('/api/vault/read', (req, res) => {
  const { vaultPath, query = '', limit = 20 } = req.body;
  if (!vaultPath) return res.status(400).json({ error: 'vaultPath is required' });

  let files;
  try {
    files = fs.readdirSync(vaultPath);
  } catch {
    return res.json({ notes: [], count: 0 });
  }

  const q = query.toLowerCase();
  const notes = files
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const filePath = path.join(vaultPath, f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      return { filename: f, path: filePath, content, metadata: { created: stat.birthtime, modified: stat.mtime } };
    })
    .filter((n) => !q || n.filename.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    .slice(0, limit);

  res.json({ notes, count: notes.length });
});

app.post('/api/vault/write', (req, res) => {
  const { vaultPath, filename, content } = req.body;
  if (!vaultPath) return res.status(400).json({ error: 'vaultPath is required' });
  if (!filename) return res.status(400).json({ error: 'filename is required' });
  if (!content) return res.status(400).json({ error: 'content is required' });

  // Normalize path: replace escaped spaces and tildes with actual characters
  const normalizedVaultPath = vaultPath.replace(/\\ /g, ' ').replace(/\\~/g, '~');
  const safe = filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
  const finalName = safe.endsWith('.md') ? safe : safe + '.md';
  const filePath = path.join(normalizedVaultPath, finalName);

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ ok: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`OpenAgent Proxy running at http://localhost:${PORT}`);
  console.log('Provider: OpenRouter');
});
