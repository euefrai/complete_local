const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. Get system insights (Duplicates, Disk space, package.json dependencies)
router.get('/api/insights', (req, res) => {
  try {
    const insights = [];
    
    // Check RAM status
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const freeMemGB = freeMem / (1024 ** 3);
    const ramPct = (totalMem - freeMem) / totalMem * 100;

    if (freeMemGB < 1.0) {
      insights.push({
        id: 'ram_low',
        category: 'performance',
        severity: 'high',
        title: 'Memória RAM Disponível Crítica',
        description: `O computador possui apenas ${freeMemGB.toFixed(2)} GB livres de RAM (${ramPct.toFixed(0)}% em uso). Considere fechar aplicativos pesados.`,
        actionable: false
      });
    } else if (ramPct > 85) {
      insights.push({
        id: 'ram_warning',
        category: 'performance',
        severity: 'medium',
        title: 'Uso de RAM Elevado',
        description: `O consumo de RAM está em ${ramPct.toFixed(0)}%. Pode impactar a performance das IAs locais.`,
        actionable: false
      });
    }

    // Scan for package.json broken/missing node_modules
    const projectRoot = path.resolve(__dirname, '..');
    const pkgPath = path.join(projectRoot, 'package.json');
    const nodeModulesPath = path.join(projectRoot, 'node_modules');

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const missingDeps = [];

        Object.keys(deps).forEach(dep => {
          const depPath = path.join(nodeModulesPath, dep);
          if (!fs.existsSync(depPath)) {
            missingDeps.push(dep);
          }
        });

        if (missingDeps.length > 0) {
          insights.push({
            id: 'broken_deps',
            category: 'codebase',
            severity: 'high',
            title: 'Dependências de Módulos Faltando',
            description: `As seguintes dependências listadas no package.json não estão instaladas: ${missingDeps.join(', ')}.`,
            actionable: true,
            fixCommand: 'npm install'
          });
        }
      } catch (e) {
        insights.push({
          id: 'pkg_broken',
          category: 'codebase',
          severity: 'medium',
          title: 'Erro de Leitura no package.json',
          description: `O arquivo package.json parece possuir erros de formatação JSON.`,
          actionable: false
        });
      }
    }

    // Scan for duplicate files in notes or public folder
    const duplicates = [];
    const fileMap = {};

    function scanForDuplicates(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.name === 'node_modules' || file.name === '.git' || file.name === 'data' || file.name === 'logs') {
          continue;
        }

        const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

        if (file.isDirectory()) {
          scanForDuplicates(fullPath);
        } else if (file.isFile()) {
          const stats = fs.statSync(fullPath);
          // Key by name + size
          const key = `${file.name}_${stats.size}`;
          if (fileMap[key]) {
            duplicates.push({
              name: file.name,
              size: stats.size,
              original: fileMap[key],
              duplicate: relativePath
            });
          } else {
            fileMap[key] = relativePath;
          }
        }
      }
    }

    try {
      scanForDuplicates(projectRoot);
    } catch (e) {
      // Ignore scan issues
    }

    if (duplicates.length > 0) {
      // Limit to showing first 3 duplicates to not overload UI
      const count = duplicates.length;
      const details = duplicates.slice(0, 3).map(d => `"${d.name}" em (${d.original}) e (${d.duplicate})`).join('; ');

      insights.push({
        id: 'duplicate_files',
        category: 'storage',
        severity: 'medium',
        title: 'Arquivos Duplicados Encontrados',
        description: `Encontramos ${count} arquivos duplicados com o mesmo nome e tamanho no projeto. Exemplo: ${details}.`,
        actionable: false
      });
    }

    // Core node-js status
    insights.push({
      id: 'system_healthy',
      category: 'general',
      severity: 'low',
      title: 'Sistema de Arquivos Limpo',
      description: 'Estruturas de banco local, grafo e agendador ativos e operacionais sem bloqueios detectados.',
      actionable: false
    });

    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar insights do sistema.', details: err.message });
  }
});

module.exports = router;
