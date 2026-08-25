const express         = require('express');
const router          = express.Router();
const OrderController = require('../controllers/OrderController');
const UserController  = require('../controllers/UserController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/',       OrderController.placeOrder);  // POST /api/orders
router.get('/history', OrderController.getHistory);  // GET  /api/orders/history
router.get('/:id',     OrderController.getOrder);    // GET  /api/orders/:id
router.post('/:id/confirm', OrderController.confirmModification);
router.post('/:id/cancel',  OrderController.cancelModification);
router.post('/:id/pay-balance', OrderController.payBalance);
router.post('/:id/received', OrderController.markReceived);
router.patch('/:id/address', UserController.updateOrderAddress);

module.exports = router;