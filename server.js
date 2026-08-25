// GAINZ AI Coach backend — Gemini free-tier build
// Keeps GEMINI_API_KEY off the browser and calls the Gemini Developer API.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MAX_BODY = 20000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, data, contentType = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  if (contentType.startsWith('application/json')) {
    res.end(JSON.stringify(data));
  } else if (typeof data === 'string' || Buffer.isBuffer(data)) {
    res.end(data);
  } else {
    res.end(String(data ?? ''));
  }
}

function safeText(value, max = 1200) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max);
}

function loadDotEnv(file = path.join(ROOT, '.env')) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
    return true;
  } catch (_) {
    return false;
  }
}

const envLoaded = loadDotEnv();
const PORT = Number(process.env.PORT || 3000);
const EXPLICIT_MODEL = String(process.env.GEMINI_MODEL || '').trim();

// Prefer a currently supported, lightweight model suitable for a student project.
// Gemini 2.0 Flash was shut down on June 1, 2026, so stale 2.0 values are ignored.
const isRetiredModel = /^gemini-2\.0-/i.test(EXPLICIT_MODEL);
const MODEL_CANDIDATES = [
  (!isRetiredModel && EXPLICIT_MODEL) || null,
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
].filter(Boolean);

const resolvedModel = MODEL_CANDIDATES[0];

function buildPrompt(payload) {
  const profile = payload.profile || {};
  const plan = payload.plan || {};
  const progress = payload.progress || {};
  const availableExercises = Array.isArray(payload.availableExercises)
    ? payload.availableExercises.slice(0, 120) : [];
  const availableMeals = Array.isArray(payload.availableMeals)
    ? payload.availableMeals.slice(0, 120) : [];
  const history = Array.isArray(payload.history)
    ? payload.history.slice(-8) : [];

  return `You are GAINZ AI, a practical fitness coach inside a student fitness web app.

USER PROFILE:
${JSON.stringify(profile)}

CURRENT PLAN:
${JSON.stringify(plan)}

PROGRESS:
${JSON.stringify(progress)}

AVAILABLE EXERCISE OPTIONS:
${JSON.stringify(availableExercises)}

AVAILABLE MEAL OPTIONS:
${JSON.stringify(availableMeals)}

RECENT CHAT:
${JSON.stringify(history)}

USER MESSAGE:
${safeText(payload.message, 1200)}

Return ONLY valid JSON with this shape:
{
  "reply": "short helpful answer",
  "action": null | {"type":"replace_exercise","target":"current exercise name","replacementKey":"available exercise key","reason":"brief reason"} | {"type":"swap_meal","target":"current meal name","replacementMeal":"available meal name","reason":"brief reason"},
  "followUp": "optional short question or empty string"
}

Rules:
- Do not invent exercise keys or meal names.
- Only return an action when it directly satisfies the user's request and the replacement exists in the supplied lists.
- For difficulty changes, explain the change in reply and leave action null unless a specific replacement is appropriate.
- Never diagnose medical conditions. If the user mentions significant pain, injury, illness, eating disorders, or medication, recommend a qualified professional.
- Do not claim to have performed an action that the JSON action does not represent.
- Keep reply under 100 words.`;
}

function parseCoachJSON(text) {
  const clean = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(clean);
    return {
      reply: safeText(parsed.reply || 'I am ready to help with your plan.', 1000),
      action: parsed.action || null,
      followUp: safeText(parsed.followUp || '', 500)
    };
  } catch (_) {
    // Keep the app usable if a model ignores the JSON-only instruction.
    return { reply: clean || 'I could not generate a response. Please try again.', action: null, followUp: '' };
  }
}

async function geminiRequest(model, body) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Add it to .env beside server.js and restart the server.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error(`Could not reach Gemini. Check your internet connection. (${err.message})`);
  }

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (_) {
    throw new Error(`Gemini returned an unexpected response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const apiMessage = data?.error?.message || `HTTP ${response.status}`;
    const status = response.status;

    if (status === 400) throw new Error(`Gemini rejected the request: ${apiMessage}`);
    if (status === 401 || status === 403) throw new Error(`Gemini API key was rejected or lacks access: ${apiMessage}`);
    if (status === 404) throw new Error(`Gemini model "${model}" is unavailable to this API key: ${apiMessage}`);
    if (status === 429) throw new Error(`Gemini rate limit/quota reached: ${apiMessage}`);
    throw new Error(`Gemini API error (${status}): ${apiMessage}`);
  }

  return data;
}

async function callGemini(payload) {
  let lastError = null;

  // Try the selected model first, then fallbacks only for model/access failures.
  for (const model of MODEL_CANDIDATES) {
    try {
      const data = await geminiRequest(model, {
        contents: [{
          role: 'user',
          parts: [{ text: buildPrompt(payload) }]
        }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 500,
          responseMimeType: 'application/json'
        }
      });

      const text = data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || '')
        .join('') || '';

      if (!text) {
        const finish = data?.candidates?.[0]?.finishReason;
        throw new Error(`Gemini returned no text${finish ? ` (finish reason: ${finish})` : ''}.`);
      }

      return { ...parseCoachJSON(text), modelUsed: model };
    } catch (err) {
      lastError = err;
      const msg = String(err.message || '');
      const canFallback = /unavailable|not found|does not exist|not supported|404/i.test(msg);
      if (!canFallback) throw err;
    }
  }

  throw lastError || new Error('No Gemini model was available.');
}

async function testGemini() {
  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const data = await geminiRequest(model, {
        contents: [{
          role: 'user',
          parts: [{ text: 'Reply with exactly: GAINZ AI connection successful.' }]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 30
        }
      });

      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts
        ?.map(p => typeof p.text === 'string' ? p.text : '')
        .join('')
        .trim() || '';

      if (!text) {
        const block = data?.promptFeedback?.blockReason;
        const finish = candidate?.finishReason;
        const details = [
          block ? `prompt blocked: ${block}` : '',
          finish ? `finish reason: ${finish}` : '',
          Array.isArray(candidate?.content?.parts) ? `parts: ${candidate.content.parts.length}` : 'no parts'
        ].filter(Boolean).join('; ');
        throw new Error(`Gemini returned no text${details ? ` (${details})` : ''}.`);
      }
      return { ok: true, model, reply: text };
    } catch (err) {
      lastError = err;
      const msg = String(err.message || '');
      if (!/unavailable|not found|does not exist|not supported|404/i.test(msg)) throw err;
    }
  }

  throw lastError || new Error('No Gemini model was available.');
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname
    );
  } catch (_) {
    return send(res, 400, { error: 'Invalid URL' });
  }

  if (pathname === '/') pathname = '/index.html';

  const requestedName = path.basename(pathname);
  if (
    requestedName === '.env' ||
    requestedName.startsWith('.env.') ||
    requestedName.startsWith('.')
  ) {
    return send(res, 404, { error: 'Not found' });
  }

  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    return send(res, 403, { error: 'Forbidden' });
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      return send(
        res,
        err.code === 'ENOENT' ? 404 : 500,
        { error: err.code === 'ENOENT' ? 'Not found' : 'Server error' }
      );
    }

    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, type);
  });
}

const server = http.createServer((req, res) => {
  const route = req.url.split('?')[0];

  if (req.method === 'GET' && route === '/api/health') {
    return send(res, 200, {
      ok: Boolean(process.env.GEMINI_API_KEY),
      apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      envLoaded,
      provider: 'gemini',
      model: resolvedModel,
      message: process.env.GEMINI_API_KEY
        ? 'GAINZ AI is configured. Use Test AI connection for a live Gemini request.'
        : 'Create .env beside server.js and add GEMINI_API_KEY.'
    });
  }

  if (req.method === 'POST' && route === '/api/test-ai') {
    return testGemini()
      .then(result => send(res, 200, result))
      .catch(err => send(res, 502, { ok: false, error: err.message }));
  }

  if (req.method === 'POST' && route === '/api/coach') {
    let raw = '';
    let tooLarge = false;

    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY) tooLarge = true;
    });

    req.on('end', async () => {
      if (tooLarge) return send(res, 413, { error: 'Request is too large.' });

      try {
        const payload = JSON.parse(raw || '{}');
        if (!safeText(payload.message, 1200).trim()) {
          return send(res, 400, { error: 'Message is required.' });
        }

        const result = await callGemini(payload);
        return send(res, 200, result);
      } catch (err) {
        console.error('[GAINZ AI]', err.message);
        return send(res, 502, { error: err.message || 'AI request failed.' });
      }
    });
    return;
  }

  if (req.method === 'GET') return serveStatic(req, res);
  return send(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`GAINZ running at http://localhost:${PORT}`);
  console.log(`Gemini model: ${resolvedModel}`);
});
