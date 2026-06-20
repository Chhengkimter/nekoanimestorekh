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

  // ── ADD THESE METHODS TO YOUR EXISTING Order.js MODEL ──────────
// (paste inside the Order class, alongside place/findByCode/findById/findByUser)

  // ─── Admin: update order-level fields (address, phone, shipping, admin_note) ──
  static async adminUpdateFields(orderId, fields) {
    const {
      addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
      mapsLink, mapsDetail, phone1, phone2,
      shippingMethod, shippingCost, orderNote, adminNote
    } = fields;

    const result = await db.query(
      `UPDATE orders SET
         addr_type        = COALESCE($1, addr_type),
         addr_line1       = COALESCE($2, addr_line1),
         addr_district    = COALESCE($3, addr_district),
         addr_city        = COALESCE($4, addr_city),
         addr_landmark    = COALESCE($5, addr_landmark),
         maps_link        = COALESCE($6, maps_link),
         maps_detail      = COALESCE($7, maps_detail),
         phone1           = COALESCE($8, phone1),
         phone2           = COALESCE($9, phone2),
         shipping_method  = COALESCE($10, shipping_method),
         shipping_cost    = COALESCE($11, shipping_cost),
         order_note       = COALESCE($12, order_note),
         admin_note       = COALESCE($13, admin_note)
       WHERE order_id = $14
       RETURNING *`,
      [addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
       mapsLink, mapsDetail, phone1, phone2,
       shippingMethod, shippingCost, orderNote, adminNote,
       orderId]
    );
    return result.rows[0] || null;
  }

  // ─── Admin: replace order items entirely ──────────────────────
  // newItems: [{ productId, selectedOption, quantity, priceAtPurchase, itemNote }]
  // Diffs against existing items, adjusts product stock by the delta for
  // each product, logs every movement to Inventory, recalculates subtotal/total.
  static async adminUpdateItems(orderId, newItems, adminId) {
    // 1. Get current items for this order
    const currentResult = await db.query(
      `SELECT order_item_id, product_id, selected_option, product_quantity
       FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const currentItems = currentResult.rows;

    // 2. Build lookup keyed by product_id + selected_option
    const key = (productId, opt) => `${productId}::${opt || ''}`;
    const currentMap = new Map(currentItems.map(it => [key(it.product_id, it.selected_option), it]));
    const newMap     = new Map(newItems.map(it => [key(it.productId, it.selectedOption), it]));

    // 3. Removed items — restore stock, delete row
    for (const [k, oldItem] of currentMap) {
      if (!newMap.has(k)) {
        await db.query(
          `UPDATE products SET product_stock = product_stock + $1 WHERE product_id = $2`,
          [oldItem.product_quantity, oldItem.product_id]
        );
        const afterResult = await db.query(
          `SELECT product_stock FROM products WHERE product_id = $1`, [oldItem.product_id]
        );
        await db.query(
          `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
           VALUES ($1, 'return', $2, $3, 'Removed from order by admin', $4)`,
          [oldItem.product_id, oldItem.product_quantity, afterResult.rows[0].product_stock, adminId]
        );
        await db.query(`DELETE FROM order_items WHERE order_item_id = $1`, [oldItem.order_item_id]);
      }
    }

    // 4. New + changed items
    for (const [k, item] of newMap) {
      const existing = currentMap.get(k);

      if (!existing) {
        // brand new line item — deduct stock
        await db.query(
          `UPDATE products SET product_stock = product_stock - $1 WHERE product_id = $2`,
          [item.quantity, item.productId]
        );
        const afterResult = await db.query(
          `SELECT product_stock FROM products WHERE product_id = $1`, [item.productId]
        );
        await db.query(
          `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
           VALUES ($1, 'sale', $2, $3, 'Added to order by admin', $4)`,
          [item.productId, -item.quantity, afterResult.rows[0].product_stock, adminId]
        );
        await db.query(
          `INSERT INTO order_items (order_id, product_id, selected_option, product_quantity, price_at_purchase, item_note)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, item.productId, item.selectedOption || null, item.quantity, item.priceAtPurchase, item.itemNote || null]
        );
      } else if (existing.product_quantity !== item.quantity) {
        // quantity changed — adjust stock by delta
        const delta = item.quantity - existing.product_quantity; // +ve = more taken from stock
        await db.query(
          `UPDATE products SET product_stock = product_stock - $1 WHERE product_id = $2`,
          [delta, item.productId]
        );
        const afterResult = await db.query(
          `SELECT product_stock FROM products WHERE product_id = $1`, [item.productId]
        );
        await db.query(
          `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
           VALUES ($1, 'adjustment', $2, $3, 'Order quantity changed by admin', $4)`,
          [item.productId, -delta, afterResult.rows[0].product_stock, adminId]
        );
        await db.query(
          `UPDATE order_items SET product_quantity = $1, item_note = COALESCE($2, item_note)
           WHERE order_item_id = $3`,
          [item.quantity, item.itemNote, existing.order_item_id]
        );
      } else if (item.itemNote !== undefined) {
        // only note changed, no stock impact
        await db.query(
          `UPDATE order_items SET item_note = $1 WHERE order_item_id = $2`,
          [item.itemNote, existing.order_item_id]
        );
      }
    }

    // 5. Recalculate subtotal/total
    const subtotalResult = await db.query(
      `SELECT COALESCE(SUM(price_at_purchase * product_quantity), 0) AS subtotal
       FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const subtotal = parseFloat(subtotalResult.rows[0].subtotal);

    const orderResult = await db.query(`SELECT shipping_cost FROM orders WHERE order_id = $1`, [orderId]);
    const shippingCost = orderResult.rows[0]?.shipping_cost;
    const total = shippingCost !== null ? subtotal + parseFloat(shippingCost) : null;

    await db.query(
      `UPDATE orders SET subtotal = $1, total = $2 WHERE order_id = $3`,
      [subtotal, total, orderId]
    );

    return { subtotal, total };
  }

  // ─── Admin: record a payment entry ─────────────────────────────
  static async addPayment(orderId, amount, note, adminId) {
    const result = await db.query(
      `INSERT INTO order_payments (order_id, amount, note, recorded_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [orderId, amount, note || null, adminId]
    );
    return result.rows[0];
  }

  // ─── Get all payments for an order ──────────────────────────────
  static async getPayments(orderId) {
    const result = await db.query(
      `SELECT op.*,
              a.first_name || ' ' || a.last_name AS recorded_by_name
      FROM order_payments op
      LEFT JOIN admins a ON a.admin_id = op.recorded_by
      WHERE op.order_id = $1
      ORDER BY op.paid_at DESC`,
      [orderId]
    );
    return result.rows;
  }

  // ─── Delete a payment entry (correcting a mistake) ─────────────
  static async deletePayment(paymentId) {
    const result = await db.query(
      `DELETE FROM order_payments WHERE payment_id = $1 RETURNING *`,
      [paymentId]
    );
    return result.rows[0] || null;
  }

  // ── ADD TO Order.js MODEL (alongside place/findByCode/etc) ─────

  // ─── Admin: create a new order directly (no cart) ──────────────
  static async adminPlace({
    userId, guestName, guestEmail, orderCode,
    addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
    mapsLink, mapsDetail, phone1, phone2,
    shippingMethod, shippingCost, orderNote, adminNote,
    items, adminId
  }) {
    await db.query(
      `CALL sp_admin_place_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        userId || null, guestName || null, guestEmail || null, orderCode,
        addrType || 'manual', addrLine1 || null, addrDistrict || null, addrCity || null, addrLandmark || null,
        mapsLink || null, mapsDetail || null, phone1, phone2 || null,
        shippingMethod || 'express', shippingCost ?? null, orderNote || null, adminNote || null,
        JSON.stringify(items), adminId
      ]
    );
  }

  // ─── Search users by name/email for admin order creation ──────
  static async searchUsers(query) {
    const result = await db.query(
      `SELECT user_id, first_name, last_name, email, phone_number
       FROM users
       WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1
       ORDER BY first_name
       LIMIT 10`,
      [`%${query}%`]
    );
    return result.rows;
  }
}


module.exports = Order;