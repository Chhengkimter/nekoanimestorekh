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
app.use('/api/users',    require('./src/routes/userRoutes')); 
app.use('/api/wishlist', require('./src/routes/wishlistRoutes'));
app.use('/api/coupons',  require('./src/routes/couponRoutes'));
app.use('/api/quests',   require('./src/routes/questRoutes'));
app.use('/api/reviews',  require('./src/routes/reviewRoutes'));

// ─── Product Views Tracking ──────────────────────────────────
app.post('/api/products/:id/view', async (req, res) => {
  try {
    const db = require('./src/config/db');
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (e) { /* ignore */ }
    }
    const ip = req.ip || req.connection.remoteAddress;
    await db.query(
      `INSERT INTO product_views (product_id, user_id, ip_address) VALUES ($1, $2, $3)`,
      [req.params.id, userId, ip]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to track view' });
  }
});

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