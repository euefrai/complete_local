const path = require('path');
const fs = require('fs');

const SENSITIVE_WRITE_DIRS = [
  'server.js',
  'routes',
  'public',
  'lib',
  'vexx-copilot-extension',
  'package.json',
  'package-lock.json'
];

function isUnderSensitiveDir(resolvedPath) {
  const norm = resolvedPath.replace(/\\/g, '/');
  return SENSITIVE_WRITE_DIRS.some(token => norm.includes(token));
}

function analyzeCommandRisks(command) {
  const cmd = String(command || '');
  const lower = cmd.toLowerCase().trim();

  const criticalPatterns = [
    'rm ', 'rmdir ', 'del ', 'erase ',
    'unlink', 'fs.rm', 'fs.unlink', 'remove-item',
    'shutdown', 'reboot', 'stop-process', 'kill '
  ];

  const dangerousPatterns = [
    'move-item', 'rename-item', 'mv ', 'rename ',
    'set-content', 'out-file', 'new-item', 'add-content',
    'powershell', 'cmd ', 'exec', 'npm install', 'npm run'
  ];

  const risks = [];
  let level = 'SAFE';

  const isCritical = criticalPatterns.some(p => lower.includes(p));
  const isDangerous = dangerousPatterns.some(p => lower.includes(p));

  if (isCritical) {
    level = 'CRITICAL';
    risks.push({
      level: 'CRITICAL',
      type: 'destructive',
      message: 'Comando destrutivo ou de alteração crítica do sistema operacional.'
    });
  } else if (isDangerous) {
    level = 'DANGEROUS';
    risks.push({
      level: 'DANGEROUS',
      type: 'sensitive-write',
      message: 'Comando sensível que escreve, altera ou executa scripts.'
    });
  } else {
    // If command writes or downloads something, classify as MODERATE
    const moderatePatterns = ['wget', 'curl', 'git clone', 'git pull', 'git push', 'mkdir', 'md '];
    const isModerate = moderatePatterns.some(p => lower.includes(p));
    if (isModerate) {
      level = 'MODERATE';
      risks.push({
        level: 'MODERATE',
        type: 'state-modifying',
        message: 'Comando moderado de download ou criação de pastas básicas.'
      });
    } else {
      level = 'SAFE';
      risks.push({
        level: 'SAFE',
        type: 'read-only',
        message: 'Comando inofensivo de leitura de dados ou status.'
      });
    }
  }

  return {
    level,
    risks,
    critical: isCritical,
    dangerous: isDangerous
  };
}

function guardrailDecision({ kind, payload, targetPath, approved }) {
  if (kind === 'terminal_delete') {
    return {
      level: 'CRITICAL',
      allow: approved === true,
      risks: [{ level: 'CRITICAL', type: 'destructive', message: 'Remoção de arquivo física requer aprovação explícita (approved:true).' }]
    };
  }

  if (kind === 'planner_write_file') {
    const resolved = path.resolve(targetPath);
    const isSensitive = isUnderSensitiveDir(resolved);
    
    if (isSensitive) {
      return {
        level: 'DANGEROUS',
        allow: approved === true,
        risks: [{ level: 'DANGEROUS', type: 'system-write', message: 'Gravação em pastas do sistema/código requer aprovação explícita (approved:true).' }]
      };
    }
    
    return {
      level: 'MODERATE',
      allow: true,
      risks: [{ level: 'MODERATE', type: 'data-write', message: 'Escrita de arquivo em diretório não-sensível.' }]
    };
  }

  if (kind === 'scheduler_execute') {
    const analysis = analyzeCommandRisks(payload);
    
    // SAFE and MODERATE execute directly
    // DANGEROUS and CRITICAL require explicit approval
    const requireApproval = analysis.level === 'DANGEROUS' || analysis.level === 'CRITICAL';
    
    return {
      level: analysis.level,
      allow: requireApproval ? (approved === true) : true,
      risks: analysis.risks
    };
  }

  if (kind === 'skill_autonomous_run') {
    const cmd = String(payload || '');
    const lower = cmd.toLowerCase();
    const destructiveMentions = ['delete', 'remove', 'del ', 'rmdir', 'rm ', 'unlink', 'shutdown', 'reboot'];
    const isDestructive = destructiveMentions.some(p => lower.includes(p));

    return {
      level: isDestructive ? 'DANGEROUS' : 'SAFE',
      allow: isDestructive ? (approved === true) : true,
      risks: isDestructive
        ? [{ level: 'DANGEROUS', type: 'destructive-mention', message: 'Execução autônoma contém palavras destrutivas; requer aprovação.' }]
        : [{ level: 'SAFE', type: 'autonomous-skill', message: 'Execução autônoma de skill permitida.' }]
    };
  }

  return {
    level: 'SAFE',
    allow: true,
    risks: [{ level: 'SAFE', type: 'default', message: 'Sem restrições aplicadas.' }]
  };
}

module.exports = {
  analyzeCommandRisks,
  guardrailDecision
};
