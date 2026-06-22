const express             = require('express');
const router              = express.Router();
const WishlistController  = require('../controllers/WishlistController');
const { requireAuth }     = require('../middleware/auth');

// All wishlist routes require login — a wishlist is always tied to a user
router.get('/',            requireAuth, WishlistController.getAll);
router.get('/ids',         requireAuth, WishlistController.getIds);
router.post('/toggle',     requireAuth, WishlistController.toggle);
router.delete('/:productId', requireAuth, WishlistController.remove);

module.exports = router;

// ─── Mount in your main app.js / server.js ─────────────────────
// const wishlistRoutes = require('./routes/wishlist');
// app.use('/api/wishlist', wishlistRoutes);