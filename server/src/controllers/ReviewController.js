const Review = require('../models/Review');
const ImageUploader = require('../services/ImageUploader');

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

  // ── CUSTOMER: Get own review for a product ──────────────────────
  static async getMyReview(req, res) {
    try {
      const review = await Review.findByUserAndProduct(req.user.id, req.params.productId);
      res.json(review);
    } catch (err) {
      console.error('ReviewController.getMyReview:', err);
      res.status(500).json({ error: 'Failed to load user review' });
    }
  }

  // ── CUSTOMER: Get all own reviews ───────────────────────────────
  static async getMyReviews(req, res) {
    try {
      const reviews = await Review.findByUser(req.user.id);
      res.json(reviews);
    } catch (err) {
      console.error('ReviewController.getMyReviews:', err);
      res.status(500).json({ error: 'Failed to load user reviews' });
    }
  }

  // ── CUSTOMER: Submit review ────────────────────────────────────
  static async create(req, res) {
    try {
      const { productId, rating, reviewText } = req.body;
      if (!productId || !rating) {
        return res.status(400).json({ error: 'Product ID and rating are required' });
      }
      
      let imageUrl = null;
      if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(file => ImageUploader.upload(file));
        const urls = await Promise.all(uploadPromises);
        imageUrl = urls.join(',');
      } else if (req.file) {
        imageUrl = await ImageUploader.upload(req.file);
      }

      const review = await Review.create(req.user.id, productId, rating, reviewText, imageUrl);
      res.status(201).json({ message: 'Review submitted successfully and is pending approval', review });
    } catch (err) {
      console.error('ReviewController.create:', err);
      res.status(400).json({ error: err.message || 'Failed to submit review' });
    }
  }

  // ── CUSTOMER: Edit pending review ──────────────────────────────
  static async customerUpdate(req, res) {
    try {
      const { rating, reviewText } = req.body;
      if (!rating) {
        return res.status(400).json({ error: 'Rating is required' });
      }

      let imageUrl = null;
      if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(file => ImageUploader.upload(file));
        const urls = await Promise.all(uploadPromises);
        imageUrl = urls.join(',');
      } else if (req.file) {
        imageUrl = await ImageUploader.upload(req.file);
      }

      const review = await Review.update(req.params.id, req.user.id, rating, reviewText, imageUrl);
      res.status(200).json({ message: 'Review updated successfully', review });
    } catch (err) {
      console.error('ReviewController.customerUpdate:', err);
      res.status(400).json({ error: err.message || 'Failed to update review' });
    }
  }
}

module.exports = ReviewController;
