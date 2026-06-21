const express = require('express');
const cors    = require('cors');
const path    = require('path');

const db = require('./src/config/db');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/pages', require('./src/routes/pageRoutes'));

// ─── Serve Frontend Static Files ─────────────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth',     require('./src/routes/authRoutes'));
app.use('/api/products', require('./src/routes/productRoutes'));
app.use('/api/cart',     require('./src/routes/cartRoutes'));
app.use('/api/orders',   require('./src/routes/orderRoutes'));
app.use('/api/admin',    require('./src/routes/adminRoutes'));
app.use('/api/users',    require('./src/routes/userRoutes'));  // ← correct path

// ─── Newsletter ───────────────────────────────────────────────
app.post('/api/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await db.query(
      'INSERT INTO newsletter (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email]
    );
    res.json({ message: 'Subscribed!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ─── 404 ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;