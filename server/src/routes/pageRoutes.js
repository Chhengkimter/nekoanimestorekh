const express        = require('express');
const router         = express.Router();
const PageController = require('../controllers/PageController');

// Public — no auth needed
router.get('/',      PageController.getAll);    // GET /api/pages
router.get('/:slug', PageController.getPage);  // GET /api/pages/:slug

module.exports = router;