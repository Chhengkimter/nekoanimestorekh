const express        = require('express');
const router         = express.Router();
const UserController = require('../controllers/UserController');
const { requireAuth } = require('../middleware/auth');

// All routes here require a logged-in customer
router.use(requireAuth);

// ─── Profile ─────────────────────────────────────────────────
// GET  /api/users/me          → view profile
// PUT  /api/users/me          → update email or phone number
router.get('/me',  UserController.getMe);
router.put('/me',  UserController.updateMe);

// ─── Order address edit (customer-facing) ────────────────────
// PATCH /api/orders/:id/address → update address/phone on unshipped order
// NOTE: this is mounted on userRoutes so it goes through customer auth,
//       not admin auth. If you already have /api/orders mounted elsewhere,
//       add this line to orderRoutes.js instead (see comment below).
router.patch('/orders/:id/address', UserController.updateOrderAddress);

module.exports = router;

/*
  ── HOW TO MOUNT IN app.js / server.js ──────────────────────────

  const userRoutes = require('./routes/userRoutes');
  app.use('/api/users', userRoutes);

  This gives you:
    GET    /api/users/me
    PUT    /api/users/me
    PATCH  /api/orders/:id/address   ← also works if you move it to orderRoutes

  ── CHANGE PASSWORD ─────────────────────────────────────────────
  Change password lives in authRoutes.js since it touches auth logic.
  Add this line inside your existing authRoutes.js:

    const UserController = require('../controllers/UserController');
    router.post('/change-password', authMiddleware, UserController.changePassword);

  That gives you:  POST /api/auth/change-password
*/