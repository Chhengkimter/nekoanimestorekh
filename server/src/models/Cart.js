const db = require('../config/db');

class Cart {

  // ─── Get full cart for a user ─────────────────────────────────
  static async getByUser(userId) {
    // Get cart + all items with product info
    const result = await db.query(
      `SELECT
         ci.cart_item_id,
         ci.product_id,
         p.product_name,
         p.product_code,
         ci.selected_option,
         ci.price_snapshot,
         ci.quantity,
         ci.note,
         ci.added_at,
         img.image_url   AS image,
         -- recalculate current price for display
         CASE
           WHEN p.discount = 0   THEN p.product_price
           WHEN p.discount_flat  THEN GREATEST(0, p.product_price - p.discount)
           ELSE GREATEST(0, p.product_price - (p.product_price * p.discount / 100))
         END             AS current_price,
         COALESCE(v.variant_stock, p.product_stock) AS product_stock,
         p.stock_status
       FROM cart c
       JOIN cart_items ci ON ci.cart_id    = c.cart_id
       JOIN products p    ON p.product_id  = ci.product_id
       LEFT JOIN product_images img
              ON img.product_id = p.product_id AND img.is_primary = TRUE
       LEFT JOIN product_variants v
              ON v.product_id = p.product_id AND TRIM(v.variant_name) ILIKE TRIM(ci.selected_option)
       WHERE c.user_id = $1
       ORDER BY ci.added_at DESC`,
      [userId]
    );
    return result.rows;
  }

  // ─── Add or update item in cart ───────────────────────────────
  static async upsertItem(userId, { productId, selectedOption, quantity, priceSnapshot, note }) {
    await db.query(
      `CALL sp_upsert_cart_item($1, $2, $3, $4, $5, $6)`,
      [userId, productId, selectedOption || null,
       quantity, priceSnapshot, note || '']
    );
  }

  // ─── Update quantity of a specific cart item ──────────────────
  static async updateQuantity(cartItemId, userId, quantity) {
    const result = await db.query(
      `UPDATE cart_items ci
       SET quantity = $1
       FROM cart c
       WHERE ci.cart_id     = c.cart_id
         AND c.user_id      = $2
         AND ci.cart_item_id = $3
       RETURNING ci.*`,
      [quantity, userId, cartItemId]
    );
    return result.rows[0] || null;
  }

  // ─── Remove one item from cart ────────────────────────────────
  static async removeItem(cartItemId, userId) {
    const result = await db.query(
      `DELETE FROM cart_items ci
       USING cart c
       WHERE ci.cart_id      = c.cart_id
         AND c.user_id       = $1
         AND ci.cart_item_id = $2
       RETURNING ci.cart_item_id`,
      [userId, cartItemId]
    );
    return result.rows[0] || null;
  }

  // ─── Clear entire cart ────────────────────────────────────────
  static async clear(userId) {
    await db.query(
      `DELETE FROM cart_items ci
       USING cart c
       WHERE ci.cart_id = c.cart_id
         AND c.user_id  = $1`,
      [userId]
    );
  }

  // ─── Get cart item count (for navbar badge) ───────────────────
  static async getCount(userId) {
    const result = await db.query(
      `SELECT COALESCE(SUM(ci.quantity), 0) AS total
       FROM cart c
       JOIN cart_items ci ON ci.cart_id = c.cart_id
       WHERE c.user_id = $1`,
      [userId]
    );
    return parseInt(result.rows[0].total);
  }

}

module.exports = Cart;