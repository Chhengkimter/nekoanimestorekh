const db = require('../config/db');

class Wishlist {

  // ─── Get all wishlist items for a user (with product info joined) ──
  static async findByUser(userId) {
    const result = await db.query(
      `SELECT w.wishlist_id, w.product_id, w.added_at,
              p.product_name, p.product_price, p.original_price,
              p.discount, p.discount_flat, p.product_stock, p.stock_status,
              (SELECT image_url FROM product_images
                WHERE product_id = p.product_id
                ORDER BY is_primary DESC LIMIT 1) AS primary_image
       FROM wishlist w
       JOIN products p ON p.product_id = w.product_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [userId]
    );
    return result.rows;
  }

  // ─── Get just the product_ids a user has wishlisted ──────────
  // Used by the frontend to know which hearts to show as "active"
  // without pulling full product data every time.
  static async findProductIdsByUser(userId) {
    const result = await db.query(
      `SELECT product_id FROM wishlist WHERE user_id = $1`,
      [userId]
    );
    return result.rows.map(r => r.product_id);
  }

  // ─── Check if a single product is wishlisted by a user ───────
  static async exists(userId, productId) {
    const result = await db.query(
      `SELECT 1 FROM wishlist WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );
    return result.rows.length > 0;
  }

  // ─── Add to wishlist ───────────────────────────────────────────
  // ON CONFLICT DO NOTHING relies on the UNIQUE(user_id, product_id)
  // constraint — safe to call even if it's already wishlisted.
  static async add(userId, productId) {
    const result = await db.query(
      `INSERT INTO wishlist (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING
       RETURNING *`,
      [userId, productId]
    );
    return result.rows[0] || null;
  }

  // ─── Remove from wishlist ──────────────────────────────────────
  static async remove(userId, productId) {
    const result = await db.query(
      `DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2 RETURNING *`,
      [userId, productId]
    );
    return result.rows[0] || null;
  }

  // ─── Toggle — add if absent, remove if present ────────────────
  // Returns { wishlisted: boolean } so the controller doesn't need
  // two round trips or extra logic to figure out the resulting state.
  static async toggle(userId, productId) {
    const already = await Wishlist.exists(userId, productId);
    if (already) {
      await Wishlist.remove(userId, productId);
      return { wishlisted: false };
    } else {
      await Wishlist.add(userId, productId);
      return { wishlisted: true };
    }
  }

}

module.exports = Wishlist;