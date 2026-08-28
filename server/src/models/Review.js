const db = require('../config/db');

class Review {

  // ─── Get all reviews (admin) ─────────────────────────────────
  static async findAll() {
    const result = await db.query(`
      SELECT r.*,
             u.first_name, u.last_name, u.email,
             p.product_name, p.primary_image
      FROM reviews r
      JOIN users u ON u.user_id = r.user_id
      JOIN vw_product_catalogue p ON p.product_id = r.product_id
      ORDER BY r.created_at DESC
    `);
    
    // Also attach linked products (if a review is linked to multiple products)
    const reviews = result.rows;
    if (reviews.length > 0) {
      const reviewIds = reviews.map(r => r.review_id);
      const linkedRes = await db.query(`
        SELECT rp.review_id, rp.product_id, p.product_name
        FROM review_products rp
        JOIN vw_product_catalogue p ON p.product_id = rp.product_id
        WHERE rp.review_id = ANY($1)
      `, [reviewIds]);
      
      const linkedMap = {};
      linkedRes.rows.forEach(row => {
        if (!linkedMap[row.review_id]) linkedMap[row.review_id] = [];
        linkedMap[row.review_id].push({ product_id: row.product_id, product_name: row.product_name });
      });

      reviews.forEach(r => {
        r.linked_products = linkedMap[r.review_id] || [];
      });
    }

    return reviews;
  }

  // ─── Get reviews for a specific product (public) ─────────────
  static async getForProduct(productId) {
    // We want reviews where the product is the original target OR it's linked
    const result = await db.query(
      `SELECT r.review_id, r.rating, r.review_text, r.image_url, r.created_at, r.admin_note,
              u.first_name, u.last_name
       FROM reviews r
       JOIN users u ON u.user_id = r.user_id
       WHERE (r.product_id = $1 OR r.review_id IN (SELECT review_id FROM review_products WHERE product_id = $1))
         AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [productId]
    );
    return result.rows;
  }

  // ─── Get review by user and product ──────────────────────────
  static async findByUserAndProduct(userId, productId) {
    const result = await db.query(
      `SELECT * FROM reviews WHERE user_id = $1 AND product_id = $2 ORDER BY CASE WHEN status = 'pending' THEN 1 ELSE 0 END DESC, created_at DESC`,
      [userId, productId]
    );
    return result.rows[0] || null;
  }

  // ─── Get all reviews by user ─────────────────────────────────
  static async findByUser(userId) {
    const result = await db.query(
      `SELECT r.*, p.product_name, p.primary_image 
       FROM reviews r 
       JOIN vw_product_catalogue p ON p.product_id = r.product_id 
       WHERE r.user_id = $1 
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  // ─── Create a review (customer) ──────────────────────────────
  static async create(userId, productId, rating, reviewText, imageUrl = null) {
    // Removed purchase requirement constraint as requested
    // (Users can now review any product regardless of purchase history)

    // Multiple reviews are allowed.

    const result = await db.query(
      `INSERT INTO reviews (user_id, product_id, rating, review_text, image_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, productId, rating, reviewText, imageUrl]
    );
    return result.rows[0];
  }

  // ─── Update a pending review (customer) ────────────────────────
  static async update(reviewId, userId, rating, reviewText, imageUrl = null) {
    // Only allow updating if it belongs to the user and is 'pending' or 'rejected'
    const result = await db.query(
      `UPDATE reviews SET
         rating = $1,
         review_text = $2,
         image_url = COALESCE($3, image_url),
         status = 'pending',
         admin_note = NULL
       WHERE review_id = $4 AND user_id = $5 AND status IN ('pending', 'rejected')
       RETURNING *`,
      [rating, reviewText, imageUrl, reviewId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Review not found or cannot be edited (already approved).');
    }
    return result.rows[0];
  }

  // ─── Update review status (admin) ────────────────────────────
  static async updateStatus(reviewId, status, adminNote) {
    const result = await db.query(
      `UPDATE reviews SET
         status = $2,
         admin_note = COALESCE($3, admin_note),
         reviewed_at = NOW()
       WHERE review_id = $1 RETURNING *`,
      [reviewId, status, adminNote]
    );

    if (result.rows[0] && status === 'approved') {
      // Trigger quest progress update for the user
      const Quest = require('./Quest');
      await Quest.refreshUserProgress(result.rows[0].user_id);
    }

    return result.rows[0];
  }

  // ─── Link review to other products (admin) ───────────────────
  static async linkToProducts(reviewId, productIds) {
    await db.query(`DELETE FROM review_products WHERE review_id = $1`, [reviewId]);
    if (productIds && productIds.length > 0) {
      for (let pid of productIds) {
        await db.query(
          `INSERT INTO review_products (review_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [reviewId, pid]
        );
      }
    }
  }

  // ─── Delete review (admin) ───────────────────────────────────
  static async delete(reviewId) {
    await db.query(`DELETE FROM reviews WHERE review_id = $1`, [reviewId]);
  }
}

module.exports = Review;
