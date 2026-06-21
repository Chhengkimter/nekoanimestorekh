// src/middleware/auth.js  –  Server-side middleware (Node.js / Express)
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/* ─── Verify JWT from Authorization header ─────────────────── */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;   // { id, email, role, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/* ─── Admin gate (use AFTER requireAuth) ───────────────────── */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { requireAuth, adminOnly };

