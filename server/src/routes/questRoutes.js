const express = require('express');
const router  = express.Router();
const QuestController = require('../controllers/QuestController');
const { requireAuth } = require('../middleware/auth');

// Auth required for all quest customer routes
router.get('/mine',      requireAuth, QuestController.getMine);
router.post('/:id/claim', requireAuth, QuestController.claimReward);

module.exports = router;
