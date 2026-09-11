const express         = require('express');
const router          = express.Router();
const OrderController = require('../controllers/OrderController');
const UserController  = require('../controllers/UserController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Allow guest & logged-in orders
router.post('/',        optionalAuth, OrderController.placeOrder);        // POST /api/orders
router.post('/service',  optionalAuth, OrderController.placeOrderService); // POST /api/orders/service

// Require authentication for user account actions
router.use(requireAuth);

router.get('/history', OrderController.getHistory);        // GET  /api/orders/history
router.get('/:id',     OrderController.getOrder);         // GET  /api/orders/:id
router.post('/:id/confirm', OrderController.confirmModification);
router.post('/:id/cancel',  OrderController.cancelModification);
router.post('/:id/pay-balance', OrderController.payBalance);
router.post('/:id/received', OrderController.markReceived);
router.patch('/:id/address', UserController.updateOrderAddress);

module.exports = router;