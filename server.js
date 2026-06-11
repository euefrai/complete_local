require('dotenv').config();

// Global Error Handling
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`[${timestamp}] ${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.path} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
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



// Start server
app.listen(PORT, () => {
  console.log(`Vexx AI Debate Arena running at http://localhost:${PORT}`);
});
