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
      JOIN products p ON p.product_id = r.product_id
      ORDER BY r.created_at DESC
    `);
    
    // Also attach linked products (if a review is linked to multiple products)
    const reviews = result.rows;
    if (reviews.length > 0) {
      const reviewIds = reviews.map(r => r.review_id);
      const linkedRes = await db.query(`
        SELECT rp.review_id, rp.product_id, p.product_name
        FROM review_products rp
        JOIN products p ON p.product_id = rp.product_id
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
      `SELECT r.review_id, r.rating, r.review_text, r.created_at, r.admin_note,
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

  // ─── Create a review (customer) ──────────────────────────────
  static async create(userId, productId, rating, reviewText) {
    // Check if user actually bought the product
    const boughtRes = await db.query(
      `SELECT COUNT(*) FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE o.user_id = $1 AND oi.product_id = $2 AND o.order_status NOT IN ('cancelled')`,
      [userId, productId]
    );
    
    if (parseInt(boughtRes.rows[0].count) === 0) {
      throw new Error('You can only review products you have purchased.');
    }

    // Check if already reviewed
    const existing = await db.query(
      `SELECT review_id FROM reviews WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );
    if (existing.rows.length > 0) {
      throw new Error('You have already submitted a review for this product.');
    }

    const result = await db.query(
      `INSERT INTO reviews (user_id, product_id, rating, review_text)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, productId, rating, reviewText]
    );
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
