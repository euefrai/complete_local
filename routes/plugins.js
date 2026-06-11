const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.resolve(__dirname, '../plugins');

// Ensure plugins directory exists
if (!fs.existsSync(PLUGINS_DIR)) {
  fs.mkdirSync(PLUGINS_DIR, { recursive: true });
}

// Helper to list plugins
function loadPluginManifests() {
  const manifests = [];
  try {
    const folders = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const manifestPath = path.join(PLUGINS_DIR, folder.name, 'plugin.json');
        if (fs.existsSync(manifestPath)) {
          const content = fs.readFileSync(manifestPath, 'utf8');
          try {
            const parsed = JSON.parse(content);
            // Inject folder name for asset routing
            parsed.folderName = folder.name;
            manifests.push(parsed);
          } catch (e) {
            console.error(`[Plugins] Failed to parse manifest for ${folder.name}:`, e.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Plugins] Error reading plugins directory:', err.message);
  }
  return manifests;
}

// 1. List installed plugins
router.get('/api/plugins/list', (req, res) => {
  try {
    const plugins = loadPluginManifests();
    res.json(plugins);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar plugins.', details: err.message });
  }
});

// 2. Create/Install a plugin
router.post('/api/plugins/create', (req, res) => {
  try {
    const { name, id, description, version, code, css } = req.body;
    if (!name || !id) {
      return res.status(400).json({ error: 'Nome e ID do plugin são obrigatórios.' });
    }

    const pluginFolder = path.join(PLUGINS_DIR, id);
    if (fs.existsSync(pluginFolder)) {
      return res.status(400).json({ error: `Plugin com ID "${id}" já existe.` });
    }

    fs.mkdirSync(pluginFolder, { recursive: true });

    const manifest = {
      id,
      name,
      version: version || '1.0.0',
      description: description || 'Nenhuma descrição fornecida.',
      main: 'index.js',
      styles: css ? 'styles.css' : undefined
    };

    fs.writeFileSync(path.join(pluginFolder, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(pluginFolder, 'index.js'), code || '// Plugin Entrypoint\nconsole.log("Plugin loaded");', 'utf8');
    
    if (css) {
      fs.writeFileSync(path.join(pluginFolder, 'styles.css'), css, 'utf8');
    }

    res.json({ success: true, manifest });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar plugin.', details: err.message });
  }
});

// 3. Delete a plugin
router.post('/api/plugins/delete', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Parâmetro ID é obrigatório.' });
    }

    const pluginFolder = path.join(PLUGINS_DIR, id);
    if (!fs.existsSync(pluginFolder)) {
      return res.status(404).json({ error: 'Plugin não encontrado.' });
    }

    fs.rmSync(pluginFolder, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover plugin.', details: err.message });
  }
});

// 4. Serve plugin static assets (index.js, styles.css)
router.get('/api/plugins/assets/:folderName/:fileName', (req, res) => {
  try {
    const { folderName, fileName } = req.params;
    
    // Safety check to prevent directory traversal
    if (folderName.includes('..') || fileName.includes('..')) {
      return res.status(400).json({ error: 'Nome de arquivo inválido.' });
    }

    const assetPath = path.join(PLUGINS_DIR, folderName, fileName);
    if (!fs.existsSync(assetPath)) {
      return res.status(404).json({ error: 'Asset do plugin não encontrado.' });
    }

    // Set MIME types accordingly
    if (fileName.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (fileName.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }

    res.sendFile(assetPath);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter asset de plugin.', details: err.message });
  }
});

module.exports = router;
