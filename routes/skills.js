const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

// Helper to ensure skills directory exists
function ensureSkillsDir() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

router.get('/api/skills', (req, res) => {
  ensureSkillsDir();
  fs.readdir(SKILLS_DIR, (err, files) => {
    if (err) {
      console.error('[Skills] List error:', err.message);
      return res.status(500).json({ error: 'Falha ao listar habilidades.', details: err.message });
    }

    const skills = files.map(name => {
      const stats = fs.statSync(path.join(SKILLS_DIR, name));
      return {
        name,
        size: stats.size,
        mtime: stats.mtime
      };
    });

    res.json({ success: true, path: SKILLS_DIR, skills });
  });
});

router.post('/api/skills/write', (req, res) => {
  const { filename, content } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Parâmetro filename é obrigatório.' });
  }

  ensureSkillsDir();
  const filePath = path.join(SKILLS_DIR, filename);

  fs.writeFile(filePath, content || '', 'utf8', (err) => {
    if (err) {
      console.error('[Skills] Write error:', err.message);
      return res.status(500).json({ error: 'Falha ao criar/atualizar habilidade.', details: err.message });
    }
    res.json({ success: true, filename, path: filePath });
  });
});

router.post('/api/skills/delete', (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Parâmetro filename é obrigatório.' });
  }

  ensureSkillsDir();
  const filePath = path.join(SKILLS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Habilidade não encontrada.', path: filePath });
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('[Skills] Delete error:', err.message);
      return res.status(500).json({ error: 'Falha ao excluir habilidade.', details: err.message });
    }
    res.json({ success: true, filename });
  });
});

module.exports = router;
