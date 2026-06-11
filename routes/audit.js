const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getBrasiliaISOString } = require('../lib/timezone');

const LOGS_DIR = path.resolve(__dirname, '../logs');
const AUDIT_FILE = path.join(LOGS_DIR, 'audit.log');

// Ensure directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Log writer helper
function writeAuditLog(action, details) {
  try {
    const timestamp = getBrasiliaISOString();
    const logLine = `[${timestamp}] [${action.toUpperCase()}] ${details}\n`;
    fs.appendFileSync(AUDIT_FILE, logLine, 'utf8');
  } catch (e) {
    console.error('[Audit] Failed to write log:', e.message);
  }
}

// 1. Get recent audit logs
router.get('/api/audit/logs', (req, res) => {
  try {
    if (!fs.existsSync(AUDIT_FILE)) {
      return res.json({ logs: [] });
    }

    const content = fs.readFileSync(AUDIT_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    // Return last 100 lines
    const last100 = lines.slice(-100).reverse();
    res.json({ logs: last100 });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler logs de auditoria.', details: err.message });
  }
});

// 2. Log manual event
router.post('/api/audit/log', (req, res) => {
  try {
    const { action, details } = req.body;
    if (!action || !details) {
      return res.status(400).json({ error: 'Parâmetros action e details são obrigatórios.' });
    }

    writeAuditLog(action, details);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar evento de auditoria.', details: err.message });
  }
});

// 3. Stats from logs
router.get('/api/audit/stats', (req, res) => {
  try {
    if (!fs.existsSync(AUDIT_FILE)) {
      return res.json({ stats: { command: 0, file: 0, agent: 0, total: 0 } });
    }

    const content = fs.readFileSync(AUDIT_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    const stats = {
      command: 0,
      file: 0,
      agent: 0,
      total: lines.length
    };

    lines.forEach(line => {
      if (line.includes('[COMMAND]')) stats.command++;
      else if (line.includes('[FILE]') || line.includes('[WRITE]')) stats.file++;
      else if (line.includes('[AGENT]')) stats.agent++;
    });

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar estatísticas de auditoria.', details: err.message });
  }
});

module.exports = router;
module.exports.writeAuditLog = writeAuditLog; // Export helper for other routers to use
