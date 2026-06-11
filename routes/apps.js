const express = require('express');
const router = express.Router();
const os = require('os');
const { exec, spawn } = require('child_process');

// 1. System status and metrics (CPU, Memory, Disk Space)
router.get('/api/apps/status', (req, res) => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    // Command to check disk space and volumes on Windows
    exec('Get-Volume | Select-Object -Property DriveLetter, FriendlyName, Size, SizeRemaining | ConvertTo-Json', 
    { shell: 'powershell.exe' }, (diskErr, diskStdout, diskStderr) => {
      let disks = [];
      try {
        if (diskStdout) {
          const parsed = JSON.parse(diskStdout);
          disks = Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
        }
      } catch (e) {
        // Fallback or empty
      }

      // Query active processes with sorting
      exec('Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 -Property Id, ProcessName, CPU, WorkingSet | ConvertTo-Json',
      { shell: 'powershell.exe' }, (procErr, procStdout, procStderr) => {
        let processes = [];
        try {
          if (procStdout) {
            const parsed = JSON.parse(procStdout);
            processes = Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
          }
        } catch (e) {
          // Fallback or empty
        }

        res.json({
          hardware: {
            platform: os.platform(),
            arch: os.arch(),
            cpuModel: cpus[0] ? cpus[0].model : 'Desconhecido',
            cpuCount: cpus.length,
            totalMemoryGB: (totalMem / (1024 ** 3)).toFixed(2),
            freeMemoryGB: (freeMem / (1024 ** 3)).toFixed(2),
            usedMemoryGB: ((totalMem - freeMem) / (1024 ** 3)).toFixed(2),
            memoryPercent: ((totalMem - freeMem) / totalMem * 100).toFixed(1),
            uptimeHours: (os.uptime() / 3600).toFixed(2)
          },
          disks: disks.map(d => ({
            drive: d.DriveLetter ? `${d.DriveLetter}:` : 'Unknown',
            label: d.FriendlyName || 'Local Disk',
            sizeGB: d.Size ? (d.Size / (1024 ** 3)).toFixed(1) : '0',
            freeGB: d.SizeRemaining ? (d.SizeRemaining / (1024 ** 3)).toFixed(1) : '0',
            usedPercent: d.Size && d.SizeRemaining ? (((d.Size - d.SizeRemaining) / d.Size) * 100).toFixed(1) : '0'
          })),
          processes: processes.map(p => ({
            pid: p.Id,
            name: p.ProcessName,
            cpu: p.CPU ? p.CPU.toFixed(1) : '0.0',
            ramMB: p.WorkingSet ? (p.WorkingSet / (1024 ** 2)).toFixed(1) : '0.0'
          }))
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao coletar métricas de hardware.', details: err.message });
  }
});

// 2. Launch an app/process
router.post('/api/apps/launch', (req, res) => {
  try {
    const { command, args } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Parâmetro command é obrigatório.' });
    }

    console.log(`[Apps] Launching process: ${command} with args:`, args || []);
    
    // Spawn application in background detached so server isn't blocked
    const subprocess = spawn(command, args || [], {
      detached: true,
      stdio: 'ignore',
      shell: true
    });

    subprocess.unref();

    res.json({
      success: true,
      pid: subprocess.pid,
      message: `Processo iniciado em segundo plano.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao iniciar aplicação.', details: err.message });
  }
});

// 3. Kill a process
router.post('/api/apps/kill', (req, res) => {
  try {
    const { pid } = req.body;
    if (!pid) {
      return res.status(400).json({ error: 'Parâmetro PID é obrigatório.' });
    }

    console.log(`[Apps] Killing process: ${pid}`);

    exec(`Stop-Process -Id ${pid} -Force`, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: `Falha ao parar o processo: ${error.message}`, details: stderr });
      }
      res.json({ success: true, message: `Processo ${pid} encerrado com sucesso.` });
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao parar processo.', details: err.message });
  }
});

module.exports = router;
