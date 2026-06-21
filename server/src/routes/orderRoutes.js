const express         = require('express');
const router          = express.Router();
const OrderController = require('../controllers/OrderController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/',       OrderController.placeOrder);  // POST /api/orders
router.get('/history', OrderController.getHistory);  // GET  /api/orders/history
router.get('/:id',     OrderController.getOrder);    // GET  /api/orders/:id

module.exports = router;