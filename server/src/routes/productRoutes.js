const express           = require('express');
const router            = express.Router();
const multer            = require('multer');
const ProductController = require('../controllers/ProductController');
const { requireAuth, adminOnly } = require('../middleware/auth');

// Multer — store files in memory (we send them straight to R2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  }
});

// ─── Public routes (no login needed) ─────────────────────────
router.get('/',    ProductController.getAll);   // GET /api/products
router.get('/:id', ProductController.getOne);   // GET /api/products/:id

// ─── Admin only routes ────────────────────────────────────────
router.post(
  '/',
  requireAuth, adminOnly,
  upload.array('images', 10),           // up to 10 images
  ProductController.create
);

router.put(
  '/:id',
  requireAuth, adminOnly,
  ProductController.update
);

router.delete(
  '/:id',
  requireAuth, adminOnly,
  ProductController.remove
);

router.post(
  '/:id/images',
  requireAuth, adminOnly,
  upload.single('image'),
  ProductController.addImage
);

router.delete(
  '/:id/images/:imageId',
  requireAuth, adminOnly,
  ProductController.deleteImage
);

module.exports = router;