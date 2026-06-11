const express = require('express');
const router = express.Router();
const instagramGraph = require('../lib/instagram_graph');
const { verifyToken } = require('../lib/auth');

// 1. Get Instagram Profile
router.get('/api/instagram/profile', verifyToken, async (req, res) => {
  const forceSimulated = req.query.mock === 'true';
  try {
    const profile = await instagramGraph.getProfile(forceSimulated);
    res.json({
      ...profile,
      isSimulated: instagramGraph.isSimulated || forceSimulated,
      error: null
    });
  } catch (e) {
    console.error('[Profile API error, falling back to simulated]', e.message);
    try {
      const profile = await instagramGraph.getProfile(true);
      res.json({
        ...profile,
        isSimulated: true,
        error: e.message
      });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Falha ao buscar perfil do Instagram', details: e.message });
    }
  }
});

// 2. Get Recent Media List
router.get('/api/instagram/media', verifyToken, async (req, res) => {
  const forceSimulated = req.query.mock === 'true';
  try {
    const media = await instagramGraph.getMedia(forceSimulated);
    res.json(media);
  } catch (e) {
    console.error('[Media API error, falling back to simulated]', e.message);
    try {
      const media = await instagramGraph.getMedia(true);
      res.json(media);
    } catch (fallbackError) {
      res.status(500).json({ error: 'Falha ao buscar publicações', details: e.message });
    }
  }
});

// 3. Get Aggregated Insights
router.get('/api/instagram/insights', verifyToken, async (req, res) => {
  const forceSimulated = req.query.mock === 'true';
  try {
    const insights = await instagramGraph.getInsights(forceSimulated);
    res.json({
      ...insights,
      isSimulated: instagramGraph.isSimulated || forceSimulated,
      error: null
    });
  } catch (e) {
    console.error('[Insights API error, falling back to simulated]', e.message);
    try {
      const insights = await instagramGraph.getInsights(true);
      res.json({
        ...insights,
        isSimulated: true,
        error: e.message
      });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Falha ao buscar métricas de insights', details: e.message });
    }
  }
});

// 4. Get Comments of a specific Post
router.get('/api/instagram/comments/:mediaId', verifyToken, async (req, res) => {
  try {
    const comments = await instagramGraph.getComments(req.params.mediaId);
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: 'Falha ao buscar comentários', details: e.message });
  }
});

// 5. Reply to a specific Comment
router.post('/api/instagram/reply', verifyToken, async (req, res) => {
  const { commentId, message } = req.body || {};
  if (!commentId || !message) {
    return res.status(400).json({ error: 'Parâmetros commentId e message são obrigatórios.' });
  }

  try {
    const result = await instagramGraph.replyComment(commentId, message);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Falha ao responder comentário', details: e.message });
  }
});

// 6. Publish an Image/Post
router.post('/api/instagram/publish', verifyToken, async (req, res) => {
  const { imageUrl, caption } = req.body || {};
  if (!caption) {
    return res.status(400).json({ error: 'O parâmetro caption é obrigatório.' });
  }

  try {
    const result = await instagramGraph.publishPost(imageUrl, caption);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Falha ao publicar conteúdo', details: e.message });
  }
});

// 7. Schedule a Post
router.post('/api/instagram/schedule', verifyToken, async (req, res) => {
  const { imageUrl, caption, scheduledTime } = req.body || {};
  if (!caption || !scheduledTime) {
    return res.status(400).json({ error: 'Parâmetros caption e scheduledTime são obrigatórios.' });
  }

  try {
    const result = await instagramGraph.schedulePost(imageUrl, caption, scheduledTime);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Falha ao agendar publicação', details: e.message });
  }
});

// 8. Get DMs
router.get('/api/instagram/messages', verifyToken, async (req, res) => {
  try {
    const messages = await instagramGraph.getMessages();
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: 'Falha ao buscar mensagens DMs', details: e.message });
  }
});

// 9. Send direct message (DM)
router.post('/api/instagram/send-message', verifyToken, async (req, res) => {
  const { username, text } = req.body || {};
  if (!username || !text) {
    return res.status(400).json({ error: 'Parâmetros username e text são obrigatórios.' });
  }

  try {
    const result = await instagramGraph.sendDM(username, text);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Falha ao enviar DM', details: e.message });
  }
});

// 10. Get Instagram API Status
router.get('/api/instagram/status', verifyToken, async (req, res) => {
  res.json({
    isSimulated: instagramGraph.isSimulated,
    businessAccountId: instagramGraph.businessAccountId,
    hasConnectionError: instagramGraph.hasConnectionError || false,
    lastError: instagramGraph.lastError || null
  });
});

module.exports = router;
