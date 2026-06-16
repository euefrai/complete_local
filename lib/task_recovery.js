const fs = require('fs');
const path = require('path');
const { logInfo, logError } = require('./observability');

const CHECKPOINTS_FILE = path.resolve(__dirname, '../data/db_task_checkpoints.json');

/**
 * Carrega todos os checkpoints do arquivo.
 * @returns {object}
 */
function loadCheckpoints() {
  if (!fs.existsSync(CHECKPOINTS_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf8'));
  } catch (err) {
    logError('[Task Recovery] Erro ao carregar checkpoints. Resetando.', err);
    return {};
  }
}

/**
 * Salva a lista de checkpoints no arquivo.
 * @param {object} data 
 */
function saveCheckpoints(data) {
  try {
    fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logError('[Task Recovery] Erro ao salvar checkpoints no arquivo.', err);
  }
}

/**
 * Grava ou atualiza um checkpoint para uma tarefa ativa.
 * @param {string} taskId - ID único da tarefa
 * @param {string} goal - Objetivo principal
 * @param {number} currentStep - Índice da etapa corrente
 * @param {object} details - Detalhes do estado atual
 */
function saveCheckpoint(taskId, goal, currentStep, details = {}) {
  const checkpoints = loadCheckpoints();
  checkpoints[taskId] = {
    goal,
    currentStep,
    details,
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS'
  };
  saveCheckpoints(checkpoints);
  logInfo(`[Task Recovery] Checkpoint salvo para tarefa ${taskId} na etapa ${currentStep}`);
}

/**
 * Obtém o estado de um checkpoint específico.
 * @param {string} taskId 
 * @returns {object|null}
 */
function getCheckpoint(taskId) {
  const checkpoints = loadCheckpoints();
  return checkpoints[taskId] || null;
}

/**
 * Lista todas as tarefas em aberto.
 * @returns {object}
 */
function listActiveCheckpoints() {
  const checkpoints = loadCheckpoints();
  const active = {};
  Object.entries(checkpoints).forEach(([id, item]) => {
    if (item.status === 'IN_PROGRESS') {
      active[id] = item;
    }
  });
  return active;
}

/**
 * Marca uma tarefa como concluída, fechando o checkpoint correspondente.
 * @param {string} taskId 
 */
function completeCheckpoint(taskId) {
  const checkpoints = loadCheckpoints();
  if (checkpoints[taskId]) {
    checkpoints[taskId].status = 'COMPLETED';
    checkpoints[taskId].completedAt = new Date().toISOString();
    saveCheckpoints(checkpoints);
    logInfo(`[Task Recovery] Checkpoint da tarefa ${taskId} marcado como COMPLETED.`);
  }
}

/**
 * Remove fisicamente o checkpoint do banco de dados.
 * @param {string} taskId 
 */
function deleteCheckpoint(taskId) {
  const checkpoints = loadCheckpoints();
  if (checkpoints[taskId]) {
    delete checkpoints[taskId];
    saveCheckpoints(checkpoints);
    logInfo(`[Task Recovery] Checkpoint da tarefa ${taskId} excluído.`);
  }
}

module.exports = {
  saveCheckpoint,
  getCheckpoint,
  listActiveCheckpoints,
  completeCheckpoint,
  deleteCheckpoint
};
