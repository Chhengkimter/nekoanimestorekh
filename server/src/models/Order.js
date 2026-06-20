const db = require('../config/db');

class Order {

  // ─── Place order using stored procedure ───────────────────────
  static async place({
    userId, orderCode,
    addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
    mapsLink, mapsDetail,
    phone1, phone2,
    shippingMethod, shippingCost,
    orderNote
  }) {
    await db.query(
      `CALL sp_place_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        userId, orderCode,
        addrType        || 'manual',
        addrLine1       || null,
        addrDistrict    || null,
        addrCity        || null,
        addrLandmark    || null,
        mapsLink        || null,
        mapsDetail      || null,
        phone1,
        phone2          || null,
        shippingMethod  || 'express',
        shippingCost    || null,
        orderNote       || null
      ]
    );
  }

  // ─── Get one order by code (confirmation page) ────────────────
  static async findByCode(orderCode, userId) {
    // Order summary
    const orderResult = await db.query(
      `SELECT * FROM vw_order_summary
       WHERE order_code = $1 AND user_id = $2`,
      [orderCode, userId]
    );
    if (!orderResult.rows[0]) return null;

    const order = orderResult.rows[0];

    // Order items
    const itemsResult = await db.query(
      `SELECT
         oi.order_item_id,
         oi.product_id,
         p.product_name,
         p.product_code,
         oi.selected_option,
         oi.product_quantity,
         oi.price_at_purchase,
         oi.item_note,
         img.image_url AS image
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       LEFT JOIN product_images img
              ON img.product_id = p.product_id AND img.is_primary = TRUE
       WHERE oi.order_id = $1`,
      [order.order_id]
    );
    order.items = itemsResult.rows;

    return order;
  }

  // ─── Get one order by ID ──────────────────────────────────────
  static async findById(orderId, userId) {
    const orderResult = await db.query(
      `SELECT * FROM vw_order_summary
       WHERE order_id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (!orderResult.rows[0]) return null;

    const order = orderResult.rows[0];

    const itemsResult = await db.query(
      `SELECT
         oi.order_item_id,
         oi.product_id,
         p.product_name,
         p.product_code,
         oi.selected_option,
         oi.product_quantity,
         oi.price_at_purchase,
         oi.item_note,
         img.image_url AS image
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       LEFT JOIN product_images img
              ON img.product_id = p.product_id AND img.is_primary = TRUE
       WHERE oi.order_id = $1`,
      [orderId]
    );
    order.items = itemsResult.rows;

    return order;
  }

  // ─── Get order history for a user ────────────────────────────
  static async findByUser(userId) {
    const result = await db.query(
      `SELECT
         o.order_id,
         o.order_code,
         o.order_status,
         o.order_date,
         o.total,
         o.shipping_method,
         COUNT(oi.order_item_id)  AS total_lines,
         SUM(oi.product_quantity) AS total_units
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE o.user_id = $1
       GROUP BY o.order_id, o.order_code, o.order_status,
                o.order_date, o.total, o.shipping_method
       ORDER BY o.order_date DESC`,
      [userId]
    );
    return result.rows;
  }

  // ─── Generate unique order code (NK-YYMMDD-XXXX) ─────────────
  static generateOrderCode() {
    const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const suffix = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, ''); 
    return `NK-${date}-${suffix}`;
  }
}

module.exports = Order;