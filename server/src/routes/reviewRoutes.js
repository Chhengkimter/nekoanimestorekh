const express = require('express');
const router  = express.Router();
const ReviewController = require('../controllers/ReviewController');
const { requireAuth } = require('../middleware/auth');

const multer = require('multer');

// Standard multer memory storage setup, same as in other routes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  }
});

// Customer route to get all their reviews
router.get('/my', requireAuth, ReviewController.getMyReviews);

// Customer route to get their own review for a product (to allow editing)
router.get('/my/:productId', requireAuth, ReviewController.getMyReview);

// Public route to get reviews for a product
router.get('/:productId', ReviewController.getForProduct);

// Customer route to submit a review
router.post('/', requireAuth, upload.array('reviewImage', 5), ReviewController.create);

// Customer route to edit a pending review
router.put('/:id', requireAuth, upload.array('reviewImage', 5), ReviewController.customerUpdate);

module.exports = router;
