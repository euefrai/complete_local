const path = require('path');
const fs = require('fs');

const SENSITIVE_WRITE_DIRS = [
  'server.js',
  'routes',
  'public',
  'skills_runtime.js',
  'scheduler.json',
  'package.json',
  'package-lock.json'
];

function isUnderSensitiveDir(resolvedPath) {
  // Best-effort: if resolved path contains any sensitive token.
  const norm = resolvedPath.replace(/\\/g, '/');
  return SENSITIVE_WRITE_DIRS.some(token => norm.includes(token));
}

function analyzeCommandRisks(command) {
  const cmd = String(command || '');
  const lower = cmd.toLowerCase();

  const destructivePatterns = [
    'rm ', 'rmdir ', 'del ', 'erase ',
    'unlink', 'fs.rm', 'fs.unlink', 'Remove-Item',
    'Move-Item', 'Rename-Item',
    'cp ', 'copy-item',
    'shutdown', 'reboot', 'stop-process'
  ];

  const sensitivePatterns = [
    'Set-Content', 'Out-File', 'New-Item', 'Add-Content'
  ];

  const risks = [];

  const destructive = destructivePatterns.some(p => lower.includes(p));
  if (destructive) {
    risks.push({
      level: 'high',
      type: 'destructive',
      message: 'Comando parece destrutivo/afetando estado do sistema ou arquivos.'
    });
  }

  const sensitive = !destructive && sensitivePatterns.some(p => lower.includes(p));
  if (sensitive) {
    risks.push({
      level: 'medium',
      type: 'sensitive-write',
      message: 'Comando pode escrever/alterar arquivos de forma sensível.'
    });
  }

  if (risks.length === 0) {
    risks.push({ level: 'low', type: 'benign', message: 'Sem padrões óbvios de destruição detectados.' });
  }

  return {
    risks,
    destructive
  };
}

function requireApprovalForTerminalDelete({ approved }) {
  // UABL: nunca ações destrutivas sem aprovação.
  return approved === true;
}

function shouldBlockPlannerWriteFile({ targetPath }) {
  // Approve required if writing to sensitive directories.
  const resolved = path.resolve(targetPath);
  if (isUnderSensitiveDir(resolved)) {
    return true;
  }
  return false;
}

function guardrailDecision({ kind, payload, targetPath, approved }) {
  if (kind === 'terminal_delete') {
    return {
      allow: requireApprovalForTerminalDelete({ approved }),
      risks: [{ level: 'high', type: 'destructive', message: 'Delete requer aprovação explícita (approved:true).' }]
    };
  }

  if (kind === 'planner_write_file') {
    const blocked = shouldBlockPlannerWriteFile({ targetPath });
    if (blocked) {
      return {
        allow: approved === true,
        risks: [{ level: 'medium', type: 'sensitive-write', message: 'Escrita em área sensível requer aprovação explícita (approved:true).' }]
      };
    }
    return { allow: true, risks: [{ level: 'low', type: 'write', message: 'Write_file em área não-sensível.' }] };
  }

  if (kind === 'scheduler_execute') {
    const { risks, destructive } = analyzeCommandRisks(payload);
    return {
      allow: destructive ? approved === true : true,
      risks
    };
  }

  if (kind === 'skill_autonomous_run') {
    // Autonomy still needs guardrails: require approval if goal mentions destructive actions (best-effort).
    const cmd = String(payload || '');
    const lower = cmd.toLowerCase();
    const destructiveMentions = ['delete', 'remove', 'del ', 'rmdir', 'rm ', 'unlink', 'shutdown', 'reboot'];
    const destructive = destructiveMentions.some(p => lower.includes(p));

    return {
      allow: destructive ? approved === true : true,
      risks: destructive
        ? [{ level: 'high', type: 'destructive-mention', message: 'Autonomous skill parece envolver ação destrutiva; requer aprovação.' }]
        : [{ level: 'low', type: 'autonomous-skill', message: 'Sem menção óbvia de destruição; permitido.' }]
    };
  }

  return { allow: true, risks: [{ level: 'low', type: 'default', message: 'No guardrail rule matched.' }] };
}

module.exports = {
  analyzeCommandRisks,
  guardrailDecision
};

