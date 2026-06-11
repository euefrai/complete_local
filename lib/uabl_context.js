const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NOTES_PREFS = path.join(PROJECT_ROOT, 'notes', 'preferencias_usuario.md');
const AUDIT_LOG = path.join(PROJECT_ROOT, 'logs', 'audit.log');

function safeReadFile(filePath, maxChars = 20000) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const txt = fs.readFileSync(filePath, 'utf8');
    if (typeof txt !== 'string') return null;
    if (txt.length > maxChars) return txt.slice(-maxChars);
    return txt;
  } catch {
    return null;
  }
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const txt = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function getMemoryGlobal() {
  const preferencias = safeReadFile(NOTES_PREFS);
  const auditTail = safeReadFile(AUDIT_LOG, 12000);

  // Best-effort RAG index + knowledge graph (no side effects).
  const ragIndex = safeReadJson(path.join(PROJECT_ROOT, 'data', 'rag_index.json'));
  const knowledgeGraph = safeReadJson(path.join(PROJECT_ROOT, 'data', 'knowledge_graph.json'));

  return {
    sources: {
      preferencias_usuario_md: NOTES_PREFS,
      audit_log: AUDIT_LOG,
      rag_index: path.join(PROJECT_ROOT, 'data', 'rag_index.json'),
      knowledge_graph: path.join(PROJECT_ROOT, 'data', 'knowledge_graph.json')
    },
    preferencias: preferencias || null,
    auditTail: auditTail || null,
    rag: ragIndex || null,
    knowledgeGraph: knowledgeGraph || null
  };
}

function getMdFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getMdFilesRecursively(filePath));
      } else if (file.endsWith('.md')) {
        results.push(filePath);
      }
    });
  } catch (e) {
    console.error('Error scanning notes recursively:', e.message);
  }
  return results;
}

function buildUablSystemPrompt() {
  const notesDir = path.join(PROJECT_ROOT, 'notes');
  let notesContent = '';
  try {
    const mdFiles = getMdFilesRecursively(notesDir);
    mdFiles.forEach(filePath => {
      const relPath = path.relative(notesDir, filePath).replace(/\\/g, '/');
      const content = safeReadFile(filePath, 5000);
      if (content && content.trim()) {
        notesContent += `\n--- NOTA: ${relPath} ---\n${content.trim()}\n`;
      }
    });
  } catch (e) {
    console.error('Erro ao ler notas para UABL prompt:', e.message);
  }

  // This is a single system prompt that should be used consistently across modules.
  // It encodes the UABL/TITAN OS rules, focusing on non-destructive, evidence-based behavior.
  return [
    'Você é o TITAN OS (UABL).',
    'Regras absolutas (prioridade máxima):',
    '- Mente Única: não há opiniões conflitantes; tudo deve refletir uma única inteligência distribuída.',
    '- Memória Global: antes de responder/decidir, considere memórias permanentes (preferências), logs e conhecimento indexado quando disponível.',
    '- Consistência: mantenha o mesmo formato de decisão/relatório em chat, planner, scheduler, terminal e skills.',
    '- Verdade Operacional: não invente arquivos/pastas/processos/dados/comandos/resultado. Se não houver evidência, declare incerteza.',
    '- Raciocínio antes da ação: transforme tarefas complexas em objetivo->plano->subtarefas->execução->validação->relatório.',
    '- Observação contínua: use contexto de alterações recentes/logs e estado quando disponível.',
    '- Proatividade inteligente: sugira ações úteis, mas nunca execute ações destrutivas sem aprovação explícita.',
    '',
    '[CADERNO DE NOTAS E CÉREBRO]',
    'Você DEVE agir em total conformidade com o que está escrito no caderno de notas abaixo. Sempre respeite, crie, delete ou edite as notas adequadamente:',
    notesContent || 'Nenhuma nota encontrada.'
  ].join('\n');
}

module.exports = {
  getMemoryGlobal,
  buildUablSystemPrompt,
  PROJECT_ROOT
};

