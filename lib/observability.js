const fs = require('fs');
const path = require('path');
const os = require('os');

const LOGS_DIR = path.resolve(__dirname, '../logs');
const LOG_FILE = path.join(LOGS_DIR, 'vexx_system.log');

// Garantir que a pasta de logs existe
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Métricas em memória
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  routeLatencies: {}
};

/**
 * Grava uma linha de log estruturada no arquivo.
 * @param {string} level - INFO, WARN, ERROR, AUDIT
 * @param {string} message - Mensagem descritiva
 * @param {object} [meta] - Metadados adicionais
 */
function writeLog(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (err) {
    console.error('[Observability] Falha ao escrever no log:', err.message);
  }
}

function logInfo(message, meta) {
  writeLog('INFO', message, meta);
}

function logWarn(message, meta) {
  writeLog('WARN', message, meta);
}

function logError(message, error, meta = {}) {
  const errorDetails = error ? {
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack
  } : {};
  writeLog('ERROR', message, { ...errorDetails, ...meta });
}

function logAudit(action, actor, target, status, details = {}) {
  writeLog('AUDIT', `Ação realizada: ${action}`, {
    audit: { action, actor, target, status, details }
  });
}

/**
 * Registra o tempo de uma requisição para estatísticas.
 * @param {string} route 
 * @param {number} latencyMs 
 * @param {boolean} success 
 */
function recordRequest(route, latencyMs, success) {
  metrics.totalRequests++;
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  metrics.totalLatency += latencyMs;
  
  if (!metrics.routeLatencies[route]) {
    metrics.routeLatencies[route] = { count: 0, totalLatency: 0 };
  }
  metrics.routeLatencies[route].count++;
  metrics.routeLatencies[route].totalLatency += latencyMs;
}

/**
 * Obtém métricas atuais do sistema.
 * @returns {object}
 */
function getSystemMetrics() {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const cpuLoad = os.loadavg(); // carga do sistema [1, 5, 15 min]
  
  // Média de latência por rota
  const routeAverages = {};
  for (const [route, data] of Object.entries(metrics.routeLatencies)) {
    routeAverages[route] = {
      count: data.count,
      avgLatencyMs: Math.round(data.totalLatency / data.count)
    };
  }

  return {
    uptime: process.uptime(),
    memory: {
      freeGB: parseFloat((freeMem / (1024 ** 3)).toFixed(2)),
      totalGB: parseFloat((totalMem / (1024 ** 3)).toFixed(2)),
      usagePct: parseFloat(((totalMem - freeMem) / totalMem * 100).toFixed(1))
    },
    cpu: {
      load1m: cpuLoad[0],
      load5m: cpuLoad[1],
      load15m: cpuLoad[2]
    },
    api: {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      avgLatencyMs: metrics.totalRequests > 0 ? Math.round(metrics.totalLatency / metrics.totalRequests) : 0,
      routes: routeAverages
    }
  };
}

module.exports = {
  logInfo,
  logWarn,
  logError,
  logAudit,
  recordRequest,
  getSystemMetrics
};
