const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { writeAuditLog } = require('./audit');

const { getMemoryGlobal } = require('../lib/uabl_context');
const { guardrailDecision } = require('../lib/uabl_guardrails');
const { makeUablReport } = require('../lib/uabl_report');


// Helper function to truncate strings
function truncateOutput(str, maxChars = 8000) {
  if (!str || str.length <= maxChars) return str;
  const half = Math.floor(maxChars / 2);
  const firstPart = str.substring(0, half);
  const lastPart = str.substring(str.length - half);
  return `${firstPart}\n\n[... SAÍDA TRUNCADA DEVIDO AO LIMITE DE CONTEXTO (${(str.length / 1024).toFixed(1)} KB total) ...]\n\n${lastPart}`;
}

// 0. Get system paths
router.get('/api/terminal/paths', (req, res) => {
  const os = require('os');
  const homedir = os.homedir();
  res.json({
    projectDir: path.resolve(__dirname, '..'),
    homeDir: homedir,
    documentsDir: path.join(homedir, 'Documents'),
    desktopDir: path.join(homedir, 'Desktop')
  });
});

// 0.1. Get system information / diagnostics
router.get('/api/terminal/sysinfo', (req, res) => {
  const os = require('os');
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  exec('Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 -Property Id, ProcessName, CPU, WorkingSet | ConvertTo-Json', 
  { shell: 'powershell.exe' }, (error, stdout, stderr) => {
    let processes = [];
    try {
      if (stdout) {
        processes = JSON.parse(stdout);
      }
    } catch (e) {
      // Fallback
    }
    
    res.json({
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpuModel: cpus[0] ? cpus[0].model : 'Unknown',
      cpuCount: cpus.length,
      totalMemoryGB: (totalMem / (1024 ** 3)).toFixed(2),
      freeMemoryGB: (freeMem / (1024 ** 3)).toFixed(2),
      memoryUsagePercent: ((totalMem - freeMem) / totalMem * 100).toFixed(1),
      uptimeHours: (os.uptime() / 3600).toFixed(2),
      processes: Array.isArray(processes) ? processes : [processes].filter(Boolean)
    });
  });
});

// 0.2. Find files recursively in a fast/controlled way
router.post('/api/terminal/find', (req, res) => {
  const { query, dirPath } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'query parameter is required' });
  }
  const projectRoot = path.resolve(__dirname, '..');
  const targetDir = dirPath ? (path.isAbsolute(dirPath) ? dirPath : path.resolve(projectRoot, dirPath)) : projectRoot;
  
  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'Directory not found', path: targetDir });
  }
  
  const escapedQuery = query.replace(/'/g, "''");
  const searchCmd = `Get-ChildItem -Path "${targetDir}" -Filter "*${escapedQuery}*" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 20 -Property FullName, Name, Length, LastWriteTime | ConvertTo-Json`;
  
  exec(searchCmd, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
    let results = [];
    try {
      if (stdout) {
        results = JSON.parse(stdout);
      }
    } catch (e) {
      // Fallback
    }
    res.json({
      path: targetDir,
      query: query,
      results: Array.isArray(results) ? results : [results].filter(Boolean)
    });
  });
});

// 1. Execute terminal command
router.post('/api/terminal/execute', async (req, res) => {
  const { command, approved } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command parameter is required' });
  }

  const memory = getMemoryGlobal();
  const approvalFlag = approved === true;
  const decision = guardrailDecision({
    kind: 'scheduler_execute',
    payload: command,
    approved: approvalFlag
  });

  if (!decision.allow) {
    return res.json({
      error: 'Guardrail bloqueou a execução do comando (requires approved:true).',
      uabl: makeUablReport({
        action: 'terminal.execute',
        status: 'failed',
        memoryUsed: memory ? 'global' : null,
        risks: decision.risks,
        impact: null,
        evidence: null,
        executed: false,
        validation: null,
        details: { approvedRequired: true }
      }).uabl
    });
  }

  console.log(`[Terminal] Executing command: ${command}`);
  writeAuditLog('command', command);

  exec(command, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
    res.json({
      stdout: truncateOutput(stdout || '', 8000),
      stderr: truncateOutput(stderr || '', 4000),
      error: error ? error.message : null,
      code: error ? error.code : 0,
      uabl: makeUablReport({
        action: 'terminal.execute',
        status: error ? 'failed' : 'completed',
        memoryUsed: memory ? 'global' : null,
        risks: decision.risks,
        impact: null,
        evidence: null,
        executed: true,
        validation: null,
        details: { command }
      }).uabl
    });
  });
});


// 2. Write file
router.post('/api/terminal/write-file', async (req, res) => {
  const { filePath, content, approved } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'filePath parameter is required' });
  }

  const projectRoot = path.resolve(__dirname, '..');
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);

  const memory = getMemoryGlobal();
  const approvalFlag = approved === true;
  const decision = guardrailDecision({
    kind: 'planner_write_file',
    targetPath: resolvedPath,
    approved: approvalFlag
  });

  if (!decision.allow) {
    return res.json({
      error: 'Guardrail bloqueou escrita sensível (requires approved:true).',
      uabl: makeUablReport({
        action: 'terminal.write-file',
        status: 'failed',
        memoryUsed: memory ? 'global' : null,
        risks: decision.risks,
        impact: null,
        evidence: null,
        executed: false,
        validation: null,
        details: { filePath: resolvedPath, approvedRequired: true }
      }).uabl
    });
  }

  console.log(`[Terminal] Writing file to: ${resolvedPath}`);
  writeAuditLog('write', resolvedPath);

  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFile(resolvedPath, content || '', 'utf8', (err) => {
    if (err) {
      console.error('[Terminal] Write file error:', err.message);
      return res.status(500).json({
        error: 'Failed to write file',
        details: err.message,
        uabl: makeUablReport({
          action: 'terminal.write-file',
          status: 'failed',
          memoryUsed: memory ? 'global' : null,
          risks: decision.risks,
          impact: null,
          evidence: null,
          executed: false,
          validation: null,
          details: { filePath: resolvedPath }
        }).uabl
      });
    }
    res.json({
      success: true,
      path: resolvedPath,
      uabl: makeUablReport({
        action: 'terminal.write-file',
        status: 'completed',
        memoryUsed: memory ? 'global' : null,
        risks: decision.risks,
        impact: null,
        evidence: null,
        executed: true,
        validation: null,
        details: { filePath: resolvedPath }
      }).uabl
    });
  });
});


// 3. Read file
router.post('/api/terminal/read-file', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'filePath parameter is required' });
  }

  const projectRoot = path.resolve(__dirname, '..');
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
  console.log(`[Terminal] Reading file from: ${resolvedPath}`);

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'File not found', path: resolvedPath });
  }

  fs.readFile(resolvedPath, 'utf8', (err, data) => {
    if (err) {
      console.error('[Terminal] Read file error:', err.message);
      return res.status(500).json({ error: 'Failed to read file', details: err.message });
    }
    res.json({ content: data, path: resolvedPath });
  });
});

// 4. List directory
router.post('/api/terminal/list-dir', (req, res) => {
  const { dirPath } = req.body;
  const projectRoot = path.resolve(__dirname, '..');
  const targetDir = dirPath ? (path.isAbsolute(dirPath) ? dirPath : path.resolve(projectRoot, dirPath)) : projectRoot;
  console.log(`[Terminal] Listing directory: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'Directory not found', path: targetDir });
  }

  fs.readdir(targetDir, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error('[Terminal] List dir error:', err.message);
      return res.status(500).json({ error: 'Failed to list directory', details: err.message });
    }

    const items = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      isFile: file.isFile(),
      ext: path.extname(file.name)
    }));

    res.json({ path: targetDir, items });
  });
});

// 5. Delete file or directory
router.post('/api/terminal/delete', async (req, res) => {
  const { targetPath, approved } = req.body;
  if (!targetPath) {
    return res.status(400).json({ error: 'targetPath parameter is required' });
  }

  const projectRoot = path.resolve(__dirname, '..');
  const resolvedPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(projectRoot, targetPath);

  const memory = getMemoryGlobal();
  const approvalFlag = approved === true;
  const decision = guardrailDecision({
    kind: 'terminal_delete',
    approved: approvalFlag
  });

  if (!decision.allow) {
    return res.json({
      error: 'Guardrail bloqueou delete destrutivo (requires approved:true).',
      uabl: makeUablReport({
        action: 'terminal.delete',
        status: 'failed',
        memoryUsed: memory ? 'global' : null,
        risks: decision.risks,
        impact: null,
        evidence: null,
        executed: false,
        validation: null,
        details: { filePath: resolvedPath, approvedRequired: true }
      }).uabl
    });
  }

  console.log(`[Terminal] Deleting target: ${resolvedPath}`);
  writeAuditLog('delete', resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'Target not found', path: resolvedPath });
  }

  fs.rm(resolvedPath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('[Terminal] Delete target error:', err.message);
      return res.status(500).json({
        error: 'Failed to delete target',
        details: err.message,
        uabl: makeUablReport({
          action: 'terminal.delete',
          status: 'failed',
          memoryUsed: memory ? 'global' : null,
          risks: decision.risks,
          impact: null,
          evidence: null,
          executed: false,
          validation: null,
          details: { filePath: resolvedPath }
        }).uabl
      });
    }

    res.json({
      success: true,
      path: resolvedPath,
      uabl: makeUablReport({
        action: 'terminal.delete',
        status: 'completed',
        memoryUsed: memory ? 'global' : null,
        risks: decision.risks,
        impact: null,
        evidence: null,
        executed: true,
        validation: null,
        details: { filePath: resolvedPath }
      }).uabl
    });
  });
});


// 6. Move/Rename file or directory
router.post('/api/terminal/move', (req, res) => {
  const { sourcePath, destPath } = req.body;
  if (!sourcePath || !destPath) {
    return res.status(400).json({ error: 'sourcePath and destPath parameters are required' });
  }

  const projectRoot = path.resolve(__dirname, '..');
  const resolvedSource = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(projectRoot, sourcePath);
  const resolvedDest = path.isAbsolute(destPath) ? destPath : path.resolve(projectRoot, destPath);
  console.log(`[Terminal] Moving: ${resolvedSource} -> ${resolvedDest}`);

  if (!fs.existsSync(resolvedSource)) {
    return res.status(404).json({ error: 'Source not found', path: resolvedSource });
  }

  // Ensure destination parent directory exists
  const destParent = path.dirname(resolvedDest);
  if (!fs.existsSync(destParent)) {
    fs.mkdirSync(destParent, { recursive: true });
  }

  fs.rename(resolvedSource, resolvedDest, (err) => {
    if (err) {
      console.error('[Terminal] Move error:', err.message);
      return res.status(500).json({ error: 'Failed to move/rename', details: err.message });
    }
    res.json({ success: true, from: resolvedSource, to: resolvedDest });
  });
});

// 7. Copy file or directory
router.post('/api/terminal/copy', (req, res) => {
  const { sourcePath, destPath } = req.body;
  if (!sourcePath || !destPath) {
    return res.status(400).json({ error: 'sourcePath and destPath parameters are required' });
  }

  const projectRoot = path.resolve(__dirname, '..');
  const resolvedSource = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(projectRoot, sourcePath);
  const resolvedDest = path.isAbsolute(destPath) ? destPath : path.resolve(projectRoot, destPath);
  console.log(`[Terminal] Copying: ${resolvedSource} -> ${resolvedDest}`);

  if (!fs.existsSync(resolvedSource)) {
    return res.status(404).json({ error: 'Source not found', path: resolvedSource });
  }

  // Ensure destination parent directory exists
  const destParent = path.dirname(resolvedDest);
  if (!fs.existsSync(destParent)) {
    fs.mkdirSync(destParent, { recursive: true });
  }

  try {
    fs.cpSync(resolvedSource, resolvedDest, { recursive: true });
    res.json({ success: true, from: resolvedSource, to: resolvedDest });
  } catch (err) {
    console.error('[Terminal] Copy error:', err.message);
    res.status(500).json({ error: 'Failed to copy', details: err.message });
  }
});

module.exports = router;
