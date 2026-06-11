const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Helper to get notes directory path
function getNotesDir(vaultPath) {
  if (vaultPath && vaultPath.trim() !== '') {
    return path.isAbsolute(vaultPath) ? vaultPath : path.resolve(__dirname, '..', vaultPath);
  }
  return path.join(__dirname, '..', 'notes');
}

router.post('/api/notes', (req, res) => {
  const { vaultPath } = req.body;
  const notesDir = getNotesDir(vaultPath);

  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }

  fs.readdir(notesDir, (err, files) => {
    if (err) {
      console.error('[Notes] List error:', err.message);
      return res.status(500).json({ error: 'Falha ao listar notas.', details: err.message });
    }

    const notes = files
      .filter(f => f.endsWith('.md'))
      .map(name => {
        const stats = fs.statSync(path.join(notesDir, name));
        return {
          name,
          size: stats.size,
          mtime: stats.mtime
        };
      });

    res.json({ success: true, path: notesDir, notes });
  });
});

router.post('/api/notes/read', (req, res) => {
  const { filename, vaultPath } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Parâmetro filename é obrigatório.' });
  }

  const notesDir = getNotesDir(vaultPath);
  const filePath = path.join(notesDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Nota não encontrada.', path: filePath });
  }

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
      console.error('[Notes] Read error:', err.message);
      return res.status(500).json({ error: 'Falha ao ler nota.', details: err.message });
    }
    res.json({ success: true, filename, content });
  });
});

router.post('/api/notes/write', (req, res) => {
  const { filename, content, vaultPath } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Parâmetro filename é obrigatório.' });
  }

  const notesDir = getNotesDir(vaultPath);
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }

  const filePath = path.join(notesDir, filename);
  console.log(`[Notes] Escrevendo nota em: ${filePath}`);

  fs.writeFile(filePath, content || '', 'utf8', (err) => {
    if (err) {
      console.error('[Notes] Write error:', err.message);
      return res.status(500).json({ error: 'Falha ao salvar nota.', details: err.message });
    }
    res.json({ success: true, filename, path: filePath });
  });
});

router.post('/api/notes/delete', (req, res) => {
  const { filename, vaultPath } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Parâmetro filename é obrigatório.' });
  }

  const notesDir = getNotesDir(vaultPath);
  const filePath = path.join(notesDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Nota não encontrada.', path: filePath });
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('[Notes] Delete error:', err.message);
      return res.status(500).json({ error: 'Falha ao excluir nota.', details: err.message });
    }
    res.json({ success: true, filename });
  });
});

function getMdFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
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
  return results;
}

router.post('/api/notes/all-contents', (req, res) => {
  const { vaultPath } = req.body;
  const notesDir = getNotesDir(vaultPath);

  if (!fs.existsSync(notesDir)) {
    return res.json({ success: true, path: notesDir, notes: [] });
  }

  try {
    const mdFiles = getMdFilesRecursively(notesDir);
    const notes = mdFiles.map(filePath => {
      const relPath = path.relative(notesDir, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        name: relPath.replace(/\\/g, '/'),
        content
      };
    });
    res.json({ success: true, path: notesDir, notes });
  } catch (err) {
    console.error('[Notes] All contents error:', err.message);
    res.status(500).json({ error: 'Falha ao ler todas as notas.', details: err.message });
  }
});

module.exports = router;
