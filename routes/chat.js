const express = require('express');
const router = express.Router();
const { buildUablSystemPrompt, getMemoryGlobal } = require('../lib/uabl_context');

// Core LLM proxy endpoint.
// routes/chat_uabl.js injects the UABL system prompt and forwards here.
// This implementation supports OpenAI-compatible chat/completions endpoints.
//
// Expected request body:
// { provider, model, messages, temperature, max_tokens, apiKey }
//
// Returns: { ... , choices:[{ message:{ content:string } }] }
// similar to OpenAI.

function getBaseUrlFromEnv(provider, explicitBaseUrl) {
  if (explicitBaseUrl) return explicitBaseUrl;

  // First try env variables
  const norm = String(provider || '').toUpperCase().replace(/\s+/g, '').replace(/\d+/g, ''); // strip numbers (e.g. GEMINI2 -> GEMINI)
  const normWithNum = String(provider || '').toUpperCase().replace(/\s+/g, '');
  
  if (normWithNum && process.env[`${normWithNum}_BASE_URL`]) return process.env[`${normWithNum}_BASE_URL`];
  if (norm && process.env[`${norm}_BASE_URL`]) return process.env[`${norm}_BASE_URL`];

  // Common envs (also supports blank provider)
  if (process.env.OPENAI_BASE_URL) return process.env.OPENAI_BASE_URL;
  if (process.env.OPEN_ROUTER_BASE_URL) return process.env.OPEN_ROUTER_BASE_URL;
  if (process.env.OPENROUTER_BASE_URL) return process.env.OPENROUTER_BASE_URL;
  if (process.env.GROQ_BASE_URL) return process.env.GROQ_BASE_URL;
  if (process.env.OLLAMA_BASE_URL) return process.env.OLLAMA_BASE_URL;

  // Hardcoded default fallbacks for public endpoints
  const providerLower = String(provider || '').toLowerCase().trim();
  if (providerLower.startsWith('gemini')) {
    return 'https://generativelanguage.googleapis.com/v1beta/openai';
  }
  if (providerLower.startsWith('groq')) {
    return 'https://api.groq.com/openai';
  }
  if (providerLower.startsWith('openrouter')) {
    return 'https://openrouter.ai/api';
  }
  if (providerLower.startsWith('openai')) {
    return 'https://api.openai.com';
  }
  if (providerLower.startsWith('cohere')) {
    return 'https://api.cohere.com/compatibility';
  }
  if (providerLower.startsWith('cerebras')) {
    return 'https://api.cerebras.ai';
  }
  if (providerLower.startsWith('huggingface')) {
    return 'https://router.huggingface.co';
  }

  // Final fallback
  return 'https://api.openai.com';
}


function pickDefaultModel(model) {
  return model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';
}

function getApiKeyFromEnv(provider) {
  const p = String(provider || '').toLowerCase().trim();
  if (p === 'gemini2') return process.env.GEMINI_API_KEY_2 || process.env.GEMINI2_API_KEY;
  if (p === 'openai2') return process.env.OPENAI_API_KEY_2 || process.env.OPENAI2_API_KEY;
  if (p === 'huggingface2') return process.env.HUGGINGFACE_API_KEY_2 || process.env.HUGGINGFACE2_API_KEY;
  if (p === 'huggingface3') return process.env.HUGGINGFACE_API_KEY_3 || process.env.HUGGINGFACE3_API_KEY;
  
  const providerKeyName = `${p.toUpperCase()}_API_KEY`;
  if (process.env[providerKeyName]) return process.env[providerKeyName];

  if (p === 'openai' || p === 'openai2' || !p) {
    return process.env.API_KEY || process.env.OPENAI_API_KEY;
  }
  return null;
}

// Configured providers endpoint
router.get('/api/chat/providers', (req, res) => {
  const providers = {
    gemini: !!process.env.GEMINI_API_KEY,
    gemini2: !!(process.env.GEMINI_API_KEY_2 || process.env.GEMINI2_API_KEY),
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    openai2: !!(process.env.OPENAI_API_KEY_2 || process.env.OPENAI2_API_KEY),
    huggingface: !!process.env.HUGGINGFACE_API_KEY,
    huggingface2: !!(process.env.HUGGINGFACE_API_KEY_2 || process.env.HUGGINGFACE2_API_KEY || process.env.HUGGINGFACE_API_KEY),
    huggingface3: !!(process.env.HUGGINGFACE_API_KEY_3 || process.env.HUGGINGFACE3_API_KEY || process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY_2),
    cohere: !!process.env.COHERE_API_KEY,
    claude: !!process.env.CLAUDE_API_KEY,
    cerebras: !!process.env.CEREBRAS_API_KEY
  };
  res.json({ providers });
});

router.post('/api/chat', async (req, res) => {
  const {
    provider,
    model,
    messages,
    temperature,
    max_tokens,
    apiKey,
    baseUrl: baseUrlOverride
  } = req.body || {};

  const finalModel = pickDefaultModel(model);
  const finalTemperature = temperature ?? 0.3;

  const finalApiKey = apiKey || getApiKeyFromEnv(provider);

  const baseUrl = getBaseUrlFromEnv(provider, baseUrlOverride || process.env.OPENAI_BASE_URL);

  if (!finalApiKey) {
    const p = String(provider || '').toLowerCase().trim();
    const keyLabel = p === 'gemini2' ? 'GEMINI_API_KEY_2' : (p === 'openai2' ? 'OPENAI_API_KEY_2' : `${p.toUpperCase()}_API_KEY`);
    return res.status(500).json({
      error: 'API key não configurada',
      details: {
        provider: provider || null,
        providerEnvKey: keyLabel,
        haveApiKey: false
      }
    });
  }
  if (!baseUrl) {
    return res.status(500).json({
      error: 'Base URL do provedor não configurada',
      details: { provider: provider || null, haveBaseUrl: false }
    });
  }

  const baseMessages = Array.isArray(messages) ? messages : [];
  const uablKeywords = ['Você é o TITAN OS (UABL)', 'Mente Única', 'Memória Global'];
  const hasUabl = baseMessages.some(m => m && m.role === 'system' && uablKeywords.some(kw => m.content.includes(kw)));
  
  let finalMessages = baseMessages;
  if (!hasUabl) {
    const uablSystem = buildUablSystemPrompt();
    const hasSystem = baseMessages.some(m => m && m.role === 'system');
    finalMessages = hasSystem
      ? baseMessages.map(m => (m.role === 'system' ? { ...m, content: `${uablSystem}\n\n${m.content}` } : m))
      : [{ role: 'system', content: uablSystem }, ...baseMessages];
  }

  const payload = {
    model: finalModel,
    messages: finalMessages,
    temperature: finalTemperature,
    max_tokens: max_tokens ?? process.env.DEFAULT_MAX_TOKENS ?? 2048
  };

  // OpenAI-compatible endpoint
  const url = `${baseUrl.replace(/\/+$/,'')}/v1/chat/completions`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(payload)
    });

    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    if (!r.ok) {
      return res.status(r.status).json({
        error: 'Falha ao chamar provedor LLM',
        details: data
      });
    }

    const memory = getMemoryGlobal();
    data.uabl = {
      memoryUsed: {
        preferencias_usuario_md: !!memory?.preferencias,
        audit_log: !!memory?.auditTail,
        rag_index: !!memory?.rag,
        knowledge_graph: !!memory?.knowledgeGraph
      }
    };

    res.json(data);
  } catch (e) {
    res.status(500).json({
      error: 'chat falhou',
      details: e.message
    });
  }
});

module.exports = router;


