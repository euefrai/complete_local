const { logWarn, logError, logInfo } = require('./observability');

/**
 * Função utilitária que adiciona política de retentativas a chamadas assíncronas.
 * @param {Function} fn - Função assíncrona a ser executada
 * @param {number} retries - Número máximo de retentativas (padrão 3)
 * @param {number} delay - Tempo inicial de espera em milissegundos (padrão 1000)
 * @param {string} [contextName] - Nome do contexto para logs
 * @returns {Promise<any>}
 */
async function withRetry(fn, retries = 3, delay = 1000, contextName = 'anonymous') {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) {
        logError(`[Self-Healing] Excedeu limite de retentativas (${retries}) para: ${contextName}`, err);
        throw err;
      }
      const backoff = delay * Math.pow(2, attempt - 1);
      logWarn(`[Self-Healing] Tentativa ${attempt} falhou para: ${contextName}. Retentando em ${backoff}ms. Erro: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Wrapper para rotas do Express capturarem erros assíncronos automaticamente.
 * Evita crash do servidor caso ocorram erros não capturados dentro das rotas.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      logError(`[Self-Healing] Erro capturado na rota ${req.method} ${req.path}`, err, {
        ip: req.ip,
        body: req.body,
        query: req.query
      });
      next(err);
    });
  };
}

/**
 * Inicializa os tratadores globais do Node.js.
 */
function setupGlobalSafetyGuards() {
  process.on('uncaughtException', (err) => {
    logError('CRITICAL: Uncaught Exception disparada no processo principal', err);
    // Tentativa de logar no console sem parar o loop do Electron se possível
    console.error('CRITICAL Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logError('CRITICAL: Unhandled Rejection detectada', err, {
      promiseDetails: String(promise)
    });
    console.error('CRITICAL Unhandled Rejection:', reason);
  });

  logInfo('[Self-Healing] Protetores globais ativados com sucesso.');
}

module.exports = {
  withRetry,
  asyncHandler,
  setupGlobalSafetyGuards
};
