const Quest = require('../models/Quest');

class QuestController {

  // ── ADMIN: List all quests ──────────────────────────────────
  static async getAll(req, res) {
    try {
      const quests = await Quest.findAll();
      res.json(quests);
    } catch (err) {
      console.error('QuestController.getAll:', err);
      res.status(500).json({ error: 'Failed to load quests' });
    }
  }

  // ── ADMIN: Get single quest ────────────────────────────────
  static async getOne(req, res) {
    try {
      const quest = await Quest.findById(req.params.id);
      if (!quest) return res.status(404).json({ error: 'Quest not found' });
      res.json(quest);
    } catch (err) {
      console.error('QuestController.getOne:', err);
      res.status(500).json({ error: 'Failed to load quest' });
    }
  }

  // ── ADMIN: Create quest ────────────────────────────────────
  static async create(req, res) {
    try {
      const quest = await Quest.create(req.body);
      res.status(201).json(quest);
    } catch (err) {
      console.error('QuestController.create:', err);
      res.status(500).json({ error: 'Failed to create quest' });
    }
  }

  // ── ADMIN: Update quest ────────────────────────────────────
  static async update(req, res) {
    try {
      const quest = await Quest.update(req.params.id, req.body);
      if (!quest) return res.status(404).json({ error: 'Quest not found' });
      res.json(quest);
    } catch (err) {
      console.error('QuestController.update:', err);
      res.status(500).json({ error: 'Failed to update quest' });
    }
  }

  // ── ADMIN: Delete quest ────────────────────────────────────
  static async remove(req, res) {
    try {
      await Quest.delete(req.params.id);
      res.json({ message: 'Quest deleted' });
    } catch (err) {
      console.error('QuestController.remove:', err);
      res.status(500).json({ error: 'Failed to delete quest' });
    }
  }

  // ── ADMIN: Get quest progress ──────────────────────────────
  static async getProgress(req, res) {
    try {
      const progress = await Quest.getProgress(req.params.id);
      res.json(progress);
    } catch (err) {
      console.error('QuestController.getProgress:', err);
      res.status(500).json({ error: 'Failed to load progress' });
    }
  }

  // ── CUSTOMER: Get my quests ────────────────────────────────
  static async getMine(req, res) {
    try {
      // Refresh progress first
      await Quest.refreshUserProgress(req.user.id);
      
      const progress = await Quest.getUserProgress(req.user.id);
      res.json(progress);
    } catch (err) {
      console.error('QuestController.getMine:', err);
      res.status(500).json({ error: 'Failed to load your quests' });
    }
  }

  // ── CUSTOMER: Claim reward ─────────────────────────────────
  static async claimReward(req, res) {
    try {
      const result = await Quest.claimReward(req.params.id, req.user.id);
      res.json(result);
    } catch (err) {
      console.error('QuestController.claimReward:', err);
      res.status(400).json({ error: err.message || 'Failed to claim reward' });
    }
  }
}

module.exports = QuestController;
