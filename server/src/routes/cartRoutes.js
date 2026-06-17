const express        = require('express');
const router         = express.Router();
const CartController = require('../controllers/CartController');
const { requireAuth } = require('../middleware/auth');

// All cart routes require login
router.use(requireAuth);

router.get('/',                        CartController.getCart);       // GET  /api/cart
router.get('/count',                   CartController.getCount);      // GET  /api/cart/count
router.post('/add',                    CartController.addItem);       // POST /api/cart/add
router.patch('/:cartItemId',           CartController.updateQuantity);// PATCH /api/cart/:id
router.delete('/clear',                CartController.clearCart);     // DELETE /api/cart/clear
router.delete('/:cartItemId',          CartController.removeItem);    // DELETE /api/cart/:id

module.exports = router;