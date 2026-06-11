const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'vexx_local_secret_key_98765';
const DEFAULT_USER = process.env.AUTH_USERNAME || 'admin';
const DEFAULT_PASS = process.env.AUTH_PASSWORD || 'vexx_admin_123';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido. Acesso não autorizado.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token inválido ou malformado.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = decoded;
    next();
  });
}

module.exports = {
  generateToken,
  verifyToken,
  DEFAULT_USER,
  DEFAULT_PASS
};
