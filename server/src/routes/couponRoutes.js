const express = require('express');
const router  = express.Router();
const CouponController = require('../controllers/CouponController');
const { requireAuth } = require('../middleware/auth');

// Public — list available coupons
router.get('/',          CouponController.getAvailable);

// Auth required
router.get('/mine',      requireAuth, CouponController.getMine);
router.post('/claim/:id', requireAuth, CouponController.claim);
router.post('/validate', requireAuth, CouponController.validate);

module.exports = router;
