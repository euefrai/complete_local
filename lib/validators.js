const { logWarn, logAudit } = require('./observability');

/**
 * Validação pré-voo (Pre-flight Validator) de parâmetros recebidos pelas APIs.
 * @param {object} inputData - Dados recebidos na requisição
 * @param {object} schema - Definição do formato esperado { [chave]: 'string'|'number'|'boolean'|'object'|'array' }
 * @returns {{valid: boolean, error?: string}}
 */
function validateInput(inputData, schema) {
  if (!inputData || typeof inputData !== 'object') {
    return { valid: false, error: 'Corpo da requisição deve ser um objeto válido.' };
  }

  for (const [key, expectedType] of Object.entries(schema)) {
    const value = inputData[key];
    if (value === undefined || value === null) {
      return { valid: false, error: `Campo obrigatório ausente: '${key}'` };
    }

    let actualType = typeof value;
    if (expectedType === 'array') {
      if (!Array.isArray(value)) {
        return { valid: false, error: `Tipo inválido para o campo '${key}'. Esperava array, obteve ${actualType}.` };
      }
    } else if (expectedType === 'object') {
      if (Array.isArray(value) || actualType !== 'object') {
        return { valid: false, error: `Tipo inválido para o campo '${key}'. Esperava objeto, obteve ${actualType}.` };
      }
    } else if (actualType !== expectedType) {
      return { valid: false, error: `Tipo inválido para o campo '${key}'. Esperava ${expectedType}, obteve ${actualType}.` };
    }
  }

  return { valid: true };
}

/**
 * Detector de injeção de prompt (Prompt Injection Guard).
 * Analisa prompts de usuários ou insumos de terceiros para evitar sequestro de instruções.
 * @param {string} prompt 
 * @returns {{safe: boolean, reason?: string, cleanedPrompt: string}}
 */
function detectPromptInjection(prompt) {
  const p = String(prompt || '');
  const lower = p.toLowerCase();

  // Lista de assinaturas clássicas de injeção/sequestro de contexto
  const injectionSignatures = [
    'ignore as instrucoes',
    'ignore as diretrizes',
    'ignore as regras',
    'ignore os prompts',
    'ignore tudo o que foi',
    'ignore previous instructions',
    'disregard original prompt',
    'system override',
    'voce agora e root',
    'reveal your system prompt',
    'revelar o prompt do sistema',
    'mostre as instrucoes do sistema',
    'act as developer mode',
    'como modo desenvolvedor',
    'ignore as configuracoes de segurança',
    'esqueça o que'
  ];

  const foundSignature = injectionSignatures.find(sig => {
    // Normalização básica sem acentos
    const normSig = sig.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normLower = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normLower.includes(normSig);
  });

  if (foundSignature) {
    logWarn(`[Security Guard] Tentativa de Prompt Injection detectada! Assinatura: "${foundSignature}"`);
    return {
      safe: false,
      reason: `Assinatura de injeção de prompt identificada (${foundSignature}).`,
      cleanedPrompt: "[REMOVIDO POR QUESTÕES DE SEGURANÇA]"
    };
  }

  return {
    safe: true,
    cleanedPrompt: p
  };
}

/**
 * Validador pós-ação (Post-Action Validator).
 * Verifica se a saída de um comando ou escrita de arquivo obteve o estado desejado.
 * @param {string} actionType - Tipo da ação realizada (ex: write_file, execute_command)
 * @param {object} result - Resultado da execução
 * @returns {boolean}
 */
function validateActionOutcome(actionType, result) {
  if (actionType === 'write_file') {
    // Ex: espera-se que o resultado contenha { success: true, bytesWritten > 0 }
    const ok = result && result.success === true;
    logAudit('write_file_validation', 'system', result.path, ok ? 'SUCCESS' : 'FAILED', result);
    return ok;
  }

  if (actionType === 'execute_command') {
    // Ex: verifica se retornou código de saída 0 ou se contém erros na string
    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    const hasErrorMsg = /err|error|failed|invalido|critical/i.test(stderr + stdout);
    const codeOk = result.code === 0 || result.code === undefined;
    const ok = codeOk && !hasErrorMsg;
    logAudit('command_validation', 'system', result.command, ok ? 'SUCCESS' : 'WARNING_FAIL', result);
    return ok;
  }

  return true;
}

module.exports = {
  validateInput,
  detectPromptInjection,
  validateActionOutcome
};
