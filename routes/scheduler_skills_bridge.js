const express = require('express');
const router = express.Router();

// This small router provides a cleaner entry-point for scheduler-driven skill autonomy.
// It does not replace routes/scheduler.js; it only offers a backend endpoint that scheduler can call.

const SKILLS_AUTONOMOUS_RUN_URL = '/api/skills/autonomous-run';

router.post('/api/scheduler/skills/autonomous-run', async (req, res) => {
  // Simply forward body to the skills autonomous-run endpoint.
  // Using internal fetch ensures we reuse auth/validation done by the skills module.
  try {
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    // Propagate approval flag if scheduler provided it.
    // skills_runtime.js uses approved===true to allow destructive autonomy.
    const body = { ...(req.body || {}) };
    if (req.body && req.body.approved === true) body.approved = true;


    const r = await fetch(`${baseUrl}${SKILLS_AUTONOMOUS_RUN_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    if (!r.ok) {
      return res.status(r.status).json(data);
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Falha ao encaminhar autonomous-run para skills', details: e.message });
  }
});

module.exports = router;

