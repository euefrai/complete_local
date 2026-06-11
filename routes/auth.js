const express = require('express');
const router = express.Router();
const { generateToken, DEFAULT_USER, DEFAULT_PASS } = require('../lib/auth');

router.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  if (username === DEFAULT_USER && password === DEFAULT_PASS) {
    const token = generateToken({ username });
    return res.json({ success: true, token, user: { username } });
  }

  return res.status(401).json({ error: 'Credenciais inválidas.' });
});

router.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Nenhum token fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'vexx_local_secret_key_98765';

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token expirado ou inválido.' });
    }
    return res.json({ success: true, user: decoded });
  });
});

module.exports = router;
