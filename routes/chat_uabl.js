const express = require('express');
const router = express.Router();

const { getMemoryGlobal, buildUablSystemPrompt } = require('../lib/uabl_context');

// Proxy chat endpoint that injects the UABL system prompt
router.post('/api/chat_uabl', async (req, res) => {
  const { provider, model, messages, temperature, max_tokens, apiKey } = req.body || {};

  try {
    const memory = getMemoryGlobal();

    const uablSystem = buildUablSystemPrompt();
    const baseMessages = Array.isArray(messages) ? messages : [];

    // Ensure we don't duplicate system prompts too aggressively.
    // If there is already a system message, prepend UABL system instructions.
    const hasSystem = baseMessages.some(m => m && m.role === 'system');
    const finalMessages = hasSystem
      ? baseMessages.map(m => (m.role === 'system' ? { ...m, content: `${uablSystem}\n\n${m.content}` } : m))
      : [{ role: 'system', content: uablSystem }, ...baseMessages];

    const payload = {
      provider,
      model,
      messages: finalMessages,
      temperature,
      max_tokens,
      apiKey
    };

    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    const r = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    // Attach evidence/memory sources (no mutation of model output)
    data.uabl = {
      memoryUsed: {
        preferencias_usuario_md: !!memory?.preferencias,
        audit_log: !!memory?.auditTail,
        rag_index: !!memory?.rag,
        knowledge_graph: !!memory?.knowledgeGraph
      }
    };

    if (!r.ok) {
      return res.status(r.status).json(data);
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'chat_uabl falhou', details: e.message });
  }
});

module.exports = router;

