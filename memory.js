// memory.js - Memory extraction and matching for OpenAgent
// Extracts key facts from conversations and matches relevant memories

// ─── Fact Extraction ───────────────────────────────────────────────────────────

function extractFactsFromMessages(messages) {
  const facts = [];
  const conversationText = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => m.content)
    .join(' ');

  // Extract URLs
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const urls = conversationText.match(urlRegex) || [];
  if (urls.length > 0) {
    facts.push({
      type: 'url',
      fact: `Links discussed: ${urls.join(', ')}`,
      topics: ['urls', 'links'],
    });
  }

  // Extract code snippets (simple heuristic)
  const codeRegex = /`{1,3}[\s\S]*?`{1,3}/g;
  const codeMatches = conversationText.match(codeRegex) || [];
  if (codeMatches.length > 0) {
    const codeSummary = codeMatches.slice(0, 3).map((c) => c.slice(0, 80)).join('; ');
    facts.push({
      type: 'code',
      fact: `Code snippets: ${codeSummary}`,
      topics: ['code', 'programming'],
    });
  }

  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = conversationText.match(emailRegex) || [];
  if (emails.length > 0) {
    facts.push({
      type: 'email',
      fact: `Emails: ${emails.join(', ')}`,
      topics: ['contact', 'email'],
    });
  }

  // Extract numbers (prices, versions, counts)
  const numberRegex = /\$\d+[\d,]*|\d+\.\d+ version|version \d+[\d.]*|\d+ (items?|entries?|results?)/gi;
  const numbers = conversationText.match(numberRegex) || [];
  if (numbers.length > 0) {
    facts.push({
      type: 'numbers',
      fact: `Numbers: ${[...new Set(numbers)].slice(0, 5).join(', ')}`,
      topics: ['data', 'numbers'],
    });
  }

  return facts;
}

// ─── Topic Extraction ────────────────────────────────────────────────────────────

function extractTopicsFromMessages(messages) {
  const text = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();

  const topicKeywords = {
    coding: ['code', 'function', 'variable', 'debug', 'bug', 'api', '编程', 'код', 'codigo'],
    design: ['design', 'ui', 'ux', 'layout', 'color', 'font', 'дизайн', 'diseño'],
    research: ['research', 'study', 'paper', 'article', 'findings', 'badania', 'исследование'],
    shopping: ['buy', 'price', 'order', 'product', 'cart', 'купить', 'comprar', 'kaufen'],
    travel: ['flight', 'hotel', 'trip', 'travel', 'booking', 'путешествие', 'viaje'],
    news: ['news', 'update', 'release', 'announcement', 'новины', 'noticias'],
    config: ['settings', 'config', 'setup', 'install', 'configuration', 'настройка'],
  };

  const foundTopics = [];
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      foundTopics.push(topic);
    }
  }

  // Extract domain as topic
  const domainRegex = /(?:https?:\/\/)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g;
  const domains = text.match(domainRegex) || [];
  if (domains.length > 0) {
    foundTopics.push(...new Set(domains.map((d) => d.replace('www.', ''))));
  }

  return [...new Set(foundTopics)].slice(0, 5);
}

// ─── Summary Generation ───────────────────────────────────────────────────────

async function generateConversationSummary(messages, pageUrl, apiKey, model) {
  if (!apiKey || messages.length === 0) return null;

  const conversationText = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')
    .slice(0, 4000);

  const prompt = `Analyze this conversation and create a brief summary (2-3 sentences) covering the main topic and key points discussed. Also extract 3-5 keywords (topics) that describe what this conversation was about.

Return JSON with this exact format:
{
  "summary": "...",
  "topics": ["topic1", "topic2", "topic3"],
  "key_facts": ["fact 1", "fact 2"]
}

Conversation:
${conversationText}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL('/'),
        'X-Title': 'OpenAgent Chrome Extension',
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '',
          topics: parsed.topics || [],
          keyFacts: parsed.key_facts || [],
        };
      }
    } catch {
      // Fallback: treat content as summary
      return { summary: content, topics: [], keyFacts: [] };
    }
  } catch {
    return null;
  }
}

// ─── Memory Bank Assembly ─────────────────────────────────────────────────────

function buildMemoryContext(summaries, memories) {
  const parts = [];

  if (summaries.length > 0) {
    parts.push('## Previous Conversations\n');
    summaries.forEach((s) => {
      parts.push(`- [${new Date(s.timestamp).toLocaleDateString()}] ${s.summary}`);
    });
  }

  if (memories.length > 0) {
    parts.push('\n## Key Facts Remembered\n');
    memories.forEach((m) => {
      parts.push(`- ${m.fact}`);
    });
  }

  return parts.join('\n');
}

// ─── Post-Conversation Processing ─────────────────────────────────────────────

async function processConversationEnd(messages, pageUrl, domain, apiKey, model) {
  if (messages.length < 2) return null;

  // Generate AI summary
  const summaryData = await generateConversationSummary(messages, pageUrl, apiKey, model);

  // Extract basic facts even without AI summary
  const basicFacts = extractFactsFromMessages(messages);
  const topics = summaryData?.topics || extractTopicsFromMessages(messages);

  // Build memory entries
  const memEntries = [];
  if (summaryData?.keyFacts) {
    for (const fact of summaryData.keyFacts) {
      memEntries.push({
        domain,
        fact,
        topics,
        timestamp: Date.now(),
        source: 'summary',
      });
    }
  }
  for (const fact of basicFacts) {
    memEntries.push({
      domain,
      fact: fact.fact,
      topics: fact.topics,
      timestamp: Date.now(),
      source: fact.type,
    });
  }

  return {
    summary: summaryData?.summary || '',
    topics,
    memEntries,
  };
}
