const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const { getMemoryGlobal } = require('../lib/uabl_context');
const { guardrailDecision } = require('../lib/uabl_guardrails');
const { makeUablReport } = require('../lib/uabl_report');


const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const SKILL_RUNTIME_LOG = path.join(LOGS_DIR, 'skills-runtime.log');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeFilename(filename) {
  // allow only base name; block traversal
  if (typeof filename !== 'string') return null;
  const normalized = filename.replace(/\\/g, '/').split('/').pop();
  if (!normalized) return null;
  if (normalized.includes('..')) return null;
  // block odd characters
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) return null;
  return normalized;
}

function guessRuntime(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.py':
      return { cmd: 'python', args: [/* file filled later */] };
    case '.js':
      return { cmd: 'node', args: [/* file filled later */] };
    case '.sh':
      return { cmd: 'bash', args: [/* file filled later */] };
    case '.ps1':
      // Use PowerShell to run script (no profile)
      return {
        cmd: 'powershell.exe',
        args: [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          /* file filled later */
        ]
      };
    case '.bat':
    case '.cmd':
      return { cmd: 'cmd.exe', args: ['/c', /* file filled later */] };
    default:
      return null;
  }
}

function appendRuntimeLog(line) {
  try {
    ensureDir(LOGS_DIR);
    fs.appendFileSync(SKILL_RUNTIME_LOG, line + '\n', 'utf8');
  } catch (e) {
    // ignore logging failures
  }
}

// Minimal code generation helper (uses backend LLM proxy in routes/chat.js by calling fetch to itself)
async function generateSkillCode({ goal, filename, language, provider, model, temperature, max_tokens, apiKey }) {
  // This endpoint does not assume any particular UI format; it just asks for a full script.
  // We call our own UABL chat endpoint using fetch.
  const sys = `Você é um engenheiro de software. Crie um script executável completo para a habilidade solicitada.

Regras:
- Responda SOMENTE o código (sem markdown).
- Código deve ser auto-contido, sem dependências externas não padrão.
- Se for Python: use shebang opcional e def main().
- Se for JS Node: apenas código executável.
- A habilidade deve imprimir uma saída clara quando executada.
`;

  const user = `Gere a habilidade para: ${goal}\n\nNome do arquivo: ${filename}\nLinguagem (se aplicável): ${language || 'auto'}\n\nRequisitos:
- Quando executada, deve imprimir algo que indique sucesso.
- Não use web sockets / servidores persistentes.
`;

  const payload = {
    provider: provider || 'openai',
    model: model || 'gpt-4o-mini',
    temperature: temperature ?? 0.3,
    max_tokens: max_tokens ?? 2048,
    apiKey: apiKey,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ]
  };

  // Determine base URL from current env
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  const response = await fetch(`${baseUrl}/api/chat_uabl`, {
    method: 'POST',

    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    throw new Error(`LLM generation failed: ${response.status} ${txt}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('LLM returned empty content');
  }

  // Remove any accidental code fences if present
  const stripped = content.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```\s*$/, '');
  return stripped;
}

router.post('/api/skills/execute', async (req, res) => {
  const { filename, args } = req.body || {};

  const safe = safeFilename(filename);
  if (!safe) return res.status(400).json({ error: 'filename inválido' });

  const skillPath = path.join(SKILLS_DIR, safe);
  if (!fs.existsSync(skillPath)) return res.status(404).json({ error: 'Habilidade não encontrada', filename: safe });

  const runtime = guessRuntime(safe);
  if (!runtime) return res.status(400).json({ error: 'Extensão não suportada para execução', filename: safe });

  const startedAt = new Date().toISOString();
  const execId = crypto.randomUUID();

  const finalArgs = [...runtime.args];
  // replace placeholder(s) with actual path
  const fileIndex = finalArgs.findIndex(a => a === /* file filled later */ undefined);
  // if placeholder not found (since JS), we simply insert at the end
  // For safety, we explicitly overwrite last placeholder value if it exists.
  for (let i = 0; i < finalArgs.length; i++) {
    if (finalArgs[i] && typeof finalArgs[i] === 'string' && finalArgs[i].includes('/* file filled later */')) {
      finalArgs[i] = skillPath;
    }
  }
  // If file not included, append
  if (!finalArgs.includes(skillPath)) {
    finalArgs[finalArgs.length - 1] = skillPath;
  }

  const extraArgs = Array.isArray(args) ? args.map(String) : [];
  const commandArgs = finalArgs.concat(extraArgs);

  appendRuntimeLog(JSON.stringify({
    execId,
    type: 'execute',
    filename: safe,
    startedAt,
    command: `${runtime.cmd} ${commandArgs.join(' ')}`
  }));

  const child = spawn(runtime.cmd, commandArgs, {
    shell: false,
    cwd: path.resolve(__dirname, '..'),
    windowsHide: true
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (d) => {
    stdout += d.toString('utf8');
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString('utf8');
  });

  const timeoutMs = Number(process.env.SKILL_EXEC_TIMEOUT_MS || 30000);

  const timeout = setTimeout(() => {
    try {
      child.kill();
    } catch (e) {}
  }, timeoutMs);

  child.on('close', (code, signal) => {
    clearTimeout(timeout);

    const finishedAt = new Date().toISOString();
    const status = code === 0 ? 'completed' : 'failed';

    appendRuntimeLog(JSON.stringify({
      execId,
      type: 'execute_result',
      filename: safe,
      finishedAt,
      status,
      code,
      signal,
      stdout: stdout.slice(0, 8000),
      stderr: stderr.slice(0, 4000)
    }));

    res.json({
      execId,
      filename: safe,
      status,
      code: code ?? 0,
      signal: signal || null,
      stdout: stdout.slice(0, 8000),
      stderr: stderr.slice(0, 4000),
      startedAt,
      finishedAt
    });
  });

  child.on('error', (err) => {
    clearTimeout(timeout);
    const finishedAt = new Date().toISOString();
    appendRuntimeLog(JSON.stringify({
      execId,
      type: 'execute_error',
      filename: safe,
      finishedAt,
      error: err.message
    }));

    res.status(500).json({
      execId,
      filename: safe,
      status: 'failed',
      error: err.message,
      stdout: stdout.slice(0, 8000),
      stderr: stderr.slice(0, 4000),
      startedAt,
      finishedAt
    });
  });
});

router.post('/api/skills/autogenerate', async (req, res) => {
  const { goal, filenameHint, language, provider, model, temperature, max_tokens, apiKey } = req.body || {};

  if (!goal || typeof goal !== 'string') {
    return res.status(400).json({ error: 'goal é obrigatório e deve ser string' });
  }

  let filename = safeFilename(filenameHint || '');

  if (!filename) {
    // choose extension based on language preference or default .py
    const ext = (language || '').toLowerCase();
    let chosen = '.py';
    if (ext.includes('js')) chosen = '.js';
    else if (ext.includes('python')) chosen = '.py';
    else if (ext.includes('shell') || ext.includes('sh')) chosen = '.sh';
    else if (ext.includes('ps1') || ext.includes('powershell')) chosen = '.ps1';

    const slug = goal
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

    const unique = Date.now().toString(36);
    filename = `${slug || 'skill'}_${unique}${chosen}`;
  }

  // Safety: ensure final filename stays safe
  filename = safeFilename(filename);
  if (!filename) return res.status(400).json({ error: 'filename inválido após sanitização' });

  ensureDir(SKILLS_DIR);

  let content;
  try {
    content = await generateSkillCode({
      goal,
      filename,
      language,
      provider,
      model,
      temperature,
      max_tokens,
      apiKey
    });
  } catch (e) {
    return res.status(500).json({ error: 'Falha ao gerar código da habilidade', details: e.message });
  }

  const skillPath = path.join(SKILLS_DIR, filename);

  try {
    fs.writeFileSync(skillPath, content, 'utf8');
  } catch (e) {
    return res.status(500).json({ error: 'Falha ao salvar habilidade em skills/', details: e.message });
  }

  appendRuntimeLog(JSON.stringify({
    type: 'autogenerate',
    filename,
    goal,
    savedAt: new Date().toISOString()
  }));

  res.json({ success: true, filename, path: skillPath });
});

router.post('/api/skills/autonomous-run', async (req, res) => {
  const { goal, filenameHint, language, executeArgs, llm, approved } = req.body || {};

  if (!goal || typeof goal !== 'string') {
    return res.status(400).json({ error: 'goal é obrigatório e deve ser string' });
  }

  const memory = getMemoryGlobal();
  const approvalFlag = approved === true;
  const decision = guardrailDecision({
    kind: 'skill_autonomous_run',
    payload: goal,
    approved: approvalFlag
  });

  if (!decision.allow) {
    return res.json({
      error: 'Guardrail bloqueou skill_autonomous_run (requires approved:true).',
      uabl: makeUablReport({
        action: 'skills.autonomous-run',
        status: 'failed',
        memoryUsed: memory ? 'global' : null,
        risks: decision.risks,
        impact: null,
        evidence: null,
        executed: false,
        validation: null,
        details: { approvedRequired: true }
      }).uabl
    });
  }


  // 1) generate
  const genRes = await fetch('/api/skills/autogenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      filenameHint,
      language,
      provider: llm?.provider,
      model: llm?.model,
      temperature: llm?.temperature,
      max_tokens: llm?.max_tokens,
      apiKey: llm?.apiKey
    })
  });

  if (!genRes.ok) {
    const txt = await genRes.text().catch(() => '');
    return res.status(500).json({ error: 'autogenerate falhou', details: txt });
  }

  const genData = await genRes.json();
  const filename = genData.filename;

  // 2) execute
  const execRes = await fetch('/api/skills/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, args: executeArgs })
  });

  if (!execRes.ok) {
    const txt = await execRes.text().catch(() => '');
    return res.status(500).json({ error: 'execute falhou', details: txt, filename });
  }

  const execData = await execRes.json();

  res.json({
    success: true,
    filename,
    generate: genData,
    execute: execData,
    uabl: makeUablReport({
      action: 'skills.autonomous-run',
      status: execData?.status || 'completed',
      memoryUsed: memory ? 'global' : null,
      risks: decision.risks,
      impact: null,
      evidence: null,
      executed: true,
      validation: null,
      details: { forwarded: true }
    }).uabl
  });
});


module.exports = router;

