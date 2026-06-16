const express = require('express');
const router = express.Router();
const memory = require('../lib/memory/index');

/**
 * @route POST /api/memory/remember
 * @description Salva uma informação na memória hierárquica.
 */
router.post('/api/memory/remember', (req, res) => {
  try {
    const { content, category, priority, tags, source, ttlMs } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, error: 'Parâmetro content é obrigatório.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, error: 'Parâmetro category é obrigatório.' });
    }

    const entry = memory.remember(content, category, priority, tags, source, ttlMs);
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/memory/recall
 * @description Recupera memórias relevantes por busca semântica e filtros.
 */
router.post('/api/memory/recall', (req, res) => {
  try {
    const { query, limit, filters } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Parâmetro query é obrigatório.' });
    }

    const results = memory.recall(query, limit, filters);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/memory/context
 * @description Monta e retorna um ContextPacket estruturado para alimentar o prompt dos agentes.
 */
router.get('/api/memory/context', (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Parâmetro query na URL é obrigatório.' });
    }

    const context = memory.getContext(query);
    res.json({ success: true, context });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/memory/stats
 * @description Retorna estatísticas completas e estado do sistema de memória.
 */
router.get('/api/memory/stats', (req, res) => {
  try {
    const stats = memory.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/memory/consolidate
 * @description Executa ciclo de consolidação manual das memórias.
 */
router.post('/api/memory/consolidate', (req, res) => {
  try {
    const result = memory.consolidate();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
