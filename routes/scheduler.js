const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const { getMemoryGlobal } = require('../lib/uabl_context');
const { guardrailDecision } = require('../lib/uabl_guardrails');
const { makeUablReport } = require('../lib/uabl_report');
const { getBrasiliaISOString, parseBrasiliaDate } = require('../lib/timezone');




const SCHEDULER_FILE = path.join(__dirname, '..', 'scheduler.json');
let pendingAlerts = [];

// Initialize scheduler file
if (!fs.existsSync(SCHEDULER_FILE)) {
  fs.writeFileSync(SCHEDULER_FILE, JSON.stringify([], null, 2), 'utf8');
}

function getTasks() {
  try {
    const data = fs.readFileSync(SCHEDULER_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveTasks(tasks) {
  try {
    fs.writeFileSync(SCHEDULER_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar scheduler.json:', e.message);
  }
}

async function safeForwardSkillAutonomousRun(task) {
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  const r = await fetch(`${baseUrl}/api/scheduler/skills/autonomous-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task.payload || {})
  });

  const txt = await r.text();
  return { ok: r.ok, status: r.status, txt };
}




// Background Worker (reads tasks every second)
setInterval(() => {
  const tasks = getTasks();
  const now = new Date();
  let changed = false;

  tasks.forEach(task => {
    if (task.status !== 'pending') return;

    const taskTime = parseBrasiliaDate(task.time);
    if (now < taskTime) return;

    console.log(`[Scheduler] Executando tarefa autônoma: ${task.id} (${task.type})`);
    task.status = 'processing';
    changed = true;

    // UABL: memória global (best-effort)
    const memory = getMemoryGlobal();
    const approvalFlag = task?.approved === true; // if provided by UI/planner


    if (task.type === 'alert') {
      pendingAlerts.push({
        id: task.id,
        time: task.time,
        payload: task.payload,
        scheduledTime: task.time
      });
      task.status = 'completed';
      task.executedAt = getBrasiliaISOString();
      return;
    }

    if (task.type === 'execute') {
      const decision = guardrailDecision({
        kind: 'scheduler_execute',
        payload: task.payload,
        approved: approvalFlag
      });

      if (!decision.allow) {
        task.status = 'failed';
        task.error = 'Guardrail bloqueou a execução (requires approved:true).';
        task.executedAt = getBrasiliaISOString();
        task.uabl = makeUablReport({
          action: 'scheduler.execute',
          status: 'failed',
          memoryUsed: memory ? 'global' : null,
          risks: decision.risks,
          impact: 'Nenhum impacto no sistema (bloqueado)',
          evidence: 'Bloqueio preventivo pelo guardrail',
          executed: false,
          validation: 'Requer aprovação manual do usuário',
          details: { approvedRequired: true }
        }).uabl;
        saveTasks(tasks);
        return;
      }

      exec(task.payload, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
        const updatedTasks = getTasks();
        const targetTask = updatedTasks.find(t => t.id === task.id);
        if (!targetTask) return;

        targetTask.status = error ? 'failed' : 'completed';
        targetTask.error = error ? error.message : null;
        targetTask.stdout = stdout || '';
        targetTask.stderr = stderr || '';
        targetTask.executedAt = getBrasiliaISOString();
        targetTask.uabl = makeUablReport({
          action: 'scheduler.execute',
          status: targetTask.status,
          memoryUsed: memory ? 'global' : null,
          risks: decision.risks,
          impact: error ? 'Falha na execução do comando' : 'Comando executado com sucesso',
          evidence: error ? (stderr || error.message) : (stdout || 'Comando finalizado sem output'),
          executed: true,
          validation: error ? 'Código de saída diferente de zero / erro do processo' : 'Código de saída zero (sucesso)',
          details: { command: task.payload }
        }).uabl;
        saveTasks(updatedTasks);


        console.log(`[Scheduler] Comando autônomo concluído: ${task.id}`);
      });
      return;
    }


    if (task.type === 'skill_autonomous_run') {
      const decision = guardrailDecision({
        kind: 'skill_autonomous_run',
        payload: task.payload,
        approved: approvalFlag
      });

      if (!decision.allow) {
        task.status = 'failed';
        task.error = 'Guardrail bloqueou skill_autonomous_run (requires approved:true).';
        task.executedAt = getBrasiliaISOString();
        task.uabl = makeUablReport({
          action: 'scheduler.skill_autonomous_run',
          status: 'failed',
          memoryUsed: memory ? 'global' : null,
          risks: decision.risks,
          impact: 'Nenhuma habilidade gerada ou executada (bloqueada)',
          evidence: 'Bloqueio preventivo pelo guardrail',
          executed: false,
          validation: 'Requer aprovação manual do usuário',
          details: { approvedRequired: true }
        }).uabl;
        saveTasks(tasks);
        return;
      }

      safeForwardSkillAutonomousRun(task)
        .then(({ ok, txt }) => {
          const updatedTasks = getTasks();
          const targetTask = updatedTasks.find(t => t.id === task.id);
          if (!targetTask) return;

          targetTask.status = ok ? 'completed' : 'failed';
          targetTask.output = txt;
          targetTask.executedAt = getBrasiliaISOString();
          if (!ok) targetTask.error = txt;

          targetTask.uabl = makeUablReport({
            action: 'scheduler.skill_autonomous_run',
            status: targetTask.status,
            memoryUsed: memory ? 'global' : null,
            risks: decision.risks,
            impact: ok ? 'Habilidade gerada e executada com sucesso' : 'Falha na execução autônoma',
            evidence: txt || (ok ? 'Sucesso sem output' : 'Falha sem detalhes'),
            executed: true,
            validation: ok ? 'Execução e verificação da habilidade concluída' : 'Falha na execução/verificação',
            details: { forwarded: true }
          }).uabl;

          saveTasks(updatedTasks);
        })
        .catch(err => {
          const updatedTasks = getTasks();
          const targetTask = updatedTasks.find(t => t.id === task.id);
          if (!targetTask) return;

          targetTask.status = 'failed';
          targetTask.error = err.message;
          targetTask.executedAt = getBrasiliaISOString();
          targetTask.uabl = makeUablReport({
            action: 'scheduler.skill_autonomous_run',
            status: 'failed',
            memoryUsed: memory ? 'global' : null,
            risks: decision.risks,
            impact: 'Falha na geração/execução da habilidade',
            evidence: err.message || 'Erro de rede/comunicação',
            executed: true,
            validation: 'Falha na execução / erro interno',
            details: { forwarded: true, error: err.message }
          }).uabl;

          saveTasks(updatedTasks);
        });

      return;
    }


    // Unknown type: mark failed
    task.status = 'failed';
    task.error = `Tipo de tarefa não suportado: ${task.type}`;
    task.executedAt = getBrasiliaISOString();
  });

  if (changed) {
    saveTasks(tasks);
  }
}, 1000);

// scheduler endpoints
router.post('/api/scheduler/create', (req, res) => {
  const { time, type, payload } = req.body;
  if (!time || !type || payload === undefined) {
    return res.status(400).json({ error: 'Parâmetros time, type e payload são obrigatórios.' });
  }

  const tasks = getTasks();
  const newTask = {
    id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    time,
    type,
    payload,
    status: 'pending',
    createdAt: getBrasiliaISOString()
  };

  tasks.push(newTask);
  saveTasks(tasks);
  res.json({ success: true, task: newTask });
});

router.get('/api/scheduler/list', (req, res) => {
  res.json({ tasks: getTasks() });
});

router.delete('/api/scheduler/delete', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Parâmetro id é obrigatório.' });
  }

  let tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }

  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  res.json({ success: true, message: 'Tarefa removida com sucesso.' });
});

router.get('/api/scheduler/alerts', (req, res) => {
  const alertsToSend = [...pendingAlerts];
  pendingAlerts = []; // clear
  res.json({ alerts: alertsToSend });
});

module.exports = router;

