const express = require('express');
const router  = express.Router();
const ReviewController = require('../controllers/ReviewController');
const { requireAuth } = require('../middleware/auth');

// Public route to get reviews for a product
router.get('/:productId', ReviewController.getForProduct);

// Customer route to submit a review
router.post('/', requireAuth, ReviewController.create);

module.exports = router;
