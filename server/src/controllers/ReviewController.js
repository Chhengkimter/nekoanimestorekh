const Review = require('../models/Review');

class ReviewController {

  // ── ADMIN: Get all reviews ────────────────────────────────────
  static async getAll(req, res) {
    try {
      const reviews = await Review.findAll();
      res.json(reviews);
    } catch (err) {
      console.error('ReviewController.getAll:', err);
      res.status(500).json({ error: 'Failed to load reviews' });
    }
  }

  // ── ADMIN: Update review status & link products ────────────────
  static async update(req, res) {
    try {
      const { status, adminNote, linkedProductIds } = req.body;
      const review = await Review.updateStatus(req.params.id, status, adminNote);
      
      if (linkedProductIds !== undefined) {
        await Review.linkToProducts(req.params.id, linkedProductIds);
      }
      
      res.json(review);
    } catch (err) {
      console.error('ReviewController.update:', err);
      res.status(500).json({ error: 'Failed to update review' });
    }
  }

  // ── ADMIN: Delete review ───────────────────────────────────────
  static async remove(req, res) {
    try {
      await Review.delete(req.params.id);
      res.json({ message: 'Review deleted' });
    } catch (err) {
      console.error('ReviewController.remove:', err);
      res.status(500).json({ error: 'Failed to delete review' });
    }
  }

  // ── PUBLIC: Get reviews for product ───────────────────────────
  static async getForProduct(req, res) {
    try {
      const reviews = await Review.getForProduct(req.params.productId);
      res.json(reviews);
    } catch (err) {
      console.error('ReviewController.getForProduct:', err);
      res.status(500).json({ error: 'Failed to load reviews' });
    }
  }

  // ── CUSTOMER: Submit review ────────────────────────────────────
  static async create(req, res) {
    try {
      const { productId, rating, reviewText } = req.body;
      if (!productId || !rating) {
        return res.status(400).json({ error: 'Product ID and rating are required' });
      }
      
      const review = await Review.create(req.user.id, productId, rating, reviewText);
      res.status(201).json({ message: 'Review submitted successfully and is pending approval', review });
    } catch (err) {
      console.error('ReviewController.create:', err);
      res.status(400).json({ error: err.message || 'Failed to submit review' });
    }
  }
}

module.exports = ReviewController;
