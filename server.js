require('dotenv').config();

const { setupGlobalSafetyGuards } = require('./lib/self_healing');
setupGlobalSafetyGuards();
const memory = require('./lib/memory/index');
memory.initialize();

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiting Config
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP a cada janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições originadas deste IP. Por favor, tente novamente após 15 minutos.' }
});

app.use(cors());
app.use('/api/', apiLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const { recordRequest, getSystemMetrics } = require('./lib/observability');

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  res.on('finish', () => {
    const duration = Date.now() - start;
    const success = res.statusCode < 400;
    recordRequest(req.path, duration, success);
    const statusColor = success ? '\x1b[32m' : '\x1b[31m';
    console.log(`[${timestamp}] ${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.path} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Telemetry metrics endpoint
app.get('/api/observability/metrics', (req, res) => {
  res.json(getSystemMetrics());
});

// Routers
app.use(require('./routes/search'));
app.use(require('./routes/image'));
app.use(require('./routes/chat'));
app.use(require('./routes/chat_uabl'));
app.use(require('./routes/terminal'));
app.use(require('./routes/scheduler'));
app.use(require('./routes/notes'));
app.use(require('./routes/skills'));
app.use(require('./routes/knowledge'));
app.use(require('./routes/rag'));
app.use(require('./routes/apps'));
app.use(require('./routes/planner'));
app.use(require('./routes/audit'));
app.use(require('./routes/insights'));
app.use(require('./routes/plugins'));
app.use(require('./routes/skills_runtime'));
app.use(require('./routes/scheduler_skills_bridge'));
app.use(require('./routes/auth'));
app.use(require('./routes/social_api'));
app.use(require('./routes/social_agents'));
app.use(require('./routes/memory_api'));



// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Express Error Handler]', err.stack || err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Vexx AI Debate Arena running at http://localhost:${PORT}`);
});
