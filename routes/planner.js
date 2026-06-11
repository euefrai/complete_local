const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getBrasiliaISOString } = require('../lib/timezone');

const { getMemoryGlobal } = require('../lib/uabl_context');
const { guardrailDecision } = require('../lib/uabl_guardrails');
const { makeUablReport } = require('../lib/uabl_report');
const { verifyToken } = require('../lib/auth');


const DATA_DIR = path.resolve(__dirname, '../data');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load plans
function loadPlans() {
  try {
    if (fs.existsSync(PLANS_FILE)) {
      const data = fs.readFileSync(PLANS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Planner] Error reading plans file:', e.message);
  }
  return [];
}

// Save plans
function savePlans(plans) {
  try {
    fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Planner] Error writing plans file:', e.message);
    return false;
  }
}

// 1. Get plans list
router.get('/api/planner/list', verifyToken, (req, res) => {
  try {
    const plans = loadPlans();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar planos.', details: err.message });
  }
});

// 2. Create plan
router.post('/api/planner/create', verifyToken, (req, res) => {
  try {
    const { title, steps } = req.body;
    if (!title || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'Título do plano e lista de passos são obrigatórios.' });
    }

    const plans = loadPlans();
    const newPlan = {
      id: 'plan_' + Date.now(),
      title,
      status: 'pending',
      createdAt: getBrasiliaISOString(),
      steps: steps.map((s, idx) => ({
        id: idx,
        type: s.type || 'command',
        payload: s.payload || '',
        targetPath: s.targetPath || '', // for file write/read/check
        status: 'pending',
        output: '',
        error: null
      }))
    };

    plans.push(newPlan);
    if (savePlans(plans)) {
      res.json({ success: true, plan: newPlan });
    } else {
      res.status(500).json({ error: 'Falha ao salvar plano no disco.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar plano.', details: err.message });
  }
});

// 3. Execute next pending step of a plan
router.post('/api/planner/execute-step', verifyToken, (req, res) => {
  try {
    const { planId, approved } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Parâmetro planId é obrigatório.' });
    }

    const plans = loadPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plano não encontrado.' });
    }

    if (plan.status === 'completed' || plan.status === 'failed') {
      return res.json({ success: false, info: 'Plano já finalizado.', plan });
    }

    // Find first pending step
    const nextStep = plan.steps.find(s => s.status === 'pending');
    if (!nextStep) {
      plan.status = 'completed';
      savePlans(plans);
      return res.json({ success: true, info: 'Todos os passos foram completados.', plan });
    }

    plan.status = 'running';
    nextStep.status = 'running';
    savePlans(plans);

    // Execute step based on type
    const projectRoot = path.resolve(__dirname, '..');
    
    if (nextStep.type === 'command') {
      console.log(`[Planner] Executing command: ${nextStep.payload}`);
      exec(nextStep.payload, { shell: 'powershell.exe', cwd: projectRoot }, (error, stdout, stderr) => {
        const out = stdout || '';
        const err = stderr || '';
        
        nextStep.output = out;
        nextStep.error = error ? error.message : null;
        nextStep.status = error ? 'failed' : 'success';

        // Update plan status
        if (error) {
          plan.status = 'failed';
        } else {
          const hasMore = plan.steps.some(s => s.status === 'pending');
          if (!hasMore) plan.status = 'completed';
        }

        savePlans(plans);
        res.json({ success: !error, step: nextStep, plan });
      });
    } else if (nextStep.type === 'write_file') {
      const target = path.isAbsolute(nextStep.targetPath) ? nextStep.targetPath : path.resolve(projectRoot, nextStep.targetPath);

      const memory = getMemoryGlobal();
      const approvalFlag = approved === true;
      const decision = guardrailDecision({
        kind: 'planner_write_file',
        targetPath: target,
        approved: approvalFlag
      });

      if (!decision.allow) {
        nextStep.status = 'failed';
        nextStep.error = 'Guardrail bloqueou escrita sensível (requires approved:true).';
        nextStep.uabl = makeUablReport({
          action: 'planner.write_file',
          status: 'failed',
          memoryUsed: memory ? 'global' : null,
          risks: decision.risks,
          impact: null,
          evidence: null,
          executed: false,
          validation: null,
          details: { targetPath: target, approvedRequired: true }
        }).uabl;
        plan.status = 'failed';

        savePlans(plans);
        return res.json({ success: false, step: nextStep, plan });
      }

      console.log(`[Planner] Writing file: ${target}`);

      const parentDir = path.dirname(target);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFile(target, nextStep.payload, 'utf8', (err) => {
        if (err) {
          nextStep.status = 'failed';
          nextStep.error = err.message;
          plan.status = 'failed';
        } else {
          nextStep.status = 'success';
          nextStep.output = `Written successfully to ${target}`;

          const hasMore = plan.steps.some(s => s.status === 'pending');
          if (!hasMore) plan.status = 'completed';
        }

        nextStep.uabl = makeUablReport({
          action: 'planner.write_file',
          status: err ? 'failed' : 'completed',
          memoryUsed: memory ? 'global' : null,
          risks: decision.risks,
          impact: null,
          evidence: null,
          executed: !err,
          validation: null,
          details: { targetPath: target }
        }).uabl;

        savePlans(plans);
        res.json({ success: !err, step: nextStep, plan });
      });
    } else if (nextStep.type === 'read_file') {

      const target = path.isAbsolute(nextStep.targetPath) ? nextStep.targetPath : path.resolve(projectRoot, nextStep.targetPath);
      console.log(`[Planner] Reading file: ${target}`);

      if (!fs.existsSync(target)) {
        nextStep.status = 'failed';
        nextStep.error = 'File not found';
        plan.status = 'failed';
        savePlans(plans);
        return res.json({ success: false, step: nextStep, plan });
      }

      fs.readFile(target, 'utf8', (err, data) => {
        if (err) {
          nextStep.status = 'failed';
          nextStep.error = err.message;
          plan.status = 'failed';
        } else {
          nextStep.status = 'success';
          nextStep.output = data;
          
          const hasMore = plan.steps.some(s => s.status === 'pending');
          if (!hasMore) plan.status = 'completed';
        }

        savePlans(plans);
        res.json({ success: !err, step: nextStep, plan });
      });
    } else if (nextStep.type === 'validate') {
      // Validation check - e.g. check if file exists or compile succeeds
      const target = path.isAbsolute(nextStep.targetPath) ? nextStep.targetPath : path.resolve(projectRoot, nextStep.targetPath);
      console.log(`[Planner] Validating file existence: ${target}`);
      
      const exists = fs.existsSync(target);
      nextStep.status = exists ? 'success' : 'failed';
      nextStep.output = exists ? `Validation passed: File exists` : `Validation failed: File not found`;
      nextStep.error = exists ? null : 'Validation failed';

      if (!exists) {
        plan.status = 'failed';
      } else {
        const hasMore = plan.steps.some(s => s.status === 'pending');
        if (!hasMore) plan.status = 'completed';
      }

      savePlans(plans);
      res.json({ success: exists, step: nextStep, plan });
    } else {
      // Unsupported / No-op
      nextStep.status = 'success';
      const hasMore = plan.steps.some(s => s.status === 'pending');
      if (!hasMore) plan.status = 'completed';
      savePlans(plans);
      res.json({ success: true, step: nextStep, plan });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao executar passo do plano.', details: err.message });
  }
});

// 4. Delete plan
router.post('/api/planner/delete', verifyToken, (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ error: 'Parâmetro planId é obrigatório.' });
    }

    let plans = loadPlans();
    plans = plans.filter(p => p.id !== planId);
    
    if (savePlans(plans)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Falha ao salvar plano no disco.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar plano.', details: err.message });
  }
});

module.exports = router;
