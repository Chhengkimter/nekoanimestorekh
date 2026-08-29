const db = require('../config/db');

class Order {

  // ─── Place order using stored procedure ───────────────────────
  static async place({
    userId, orderCode,
    addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
    mapsLink, mapsDetail,
    phone1, phone2,
    shippingMethod, shippingCost,
    orderNote,
    paymentMethod, isPhnomPenh,
    couponCode
  }) {
    const Coupon = require('./Coupon');
    const Quest  = require('./Quest');
    const Cart   = require('./Cart');

    let discountAmount = 0;
    let couponId = null;

    if (couponCode) {
      const cartItems = await Cart.getByUser(userId);
      const cartTotal = cartItems.reduce((sum, i) => sum + (parseFloat(i.price_snapshot) * i.quantity), 0);
      
      const catIdsRes = await db.query(
        `SELECT DISTINCT category_id FROM product_categories WHERE product_id IN (
           SELECT product_id FROM cart_items WHERE cart_id = (SELECT cart_id FROM cart WHERE user_id = $1)
         )`,
        [userId]
      );
      const categoryIds = catIdsRes.rows.map(r => r.category_id);

      const val = await Coupon.validateCoupon(couponCode, userId, cartTotal, categoryIds);
      if (val.valid) {
        discountAmount = val.discount;
        couponId = val.coupon.coupon_id;
      }
    }

    await db.query(
      `CALL sp_place_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
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
        orderNote       || null,
        paymentMethod   || 'full',
        isPhnomPenh     || false,
        couponCode      || null,
        discountAmount  || 0,
        couponId        || null
      ]
    );

    // Record coupon usage
    if (couponId) {
      const orderRes = await db.query(`SELECT order_id, total FROM orders WHERE order_code = $1`, [orderCode]);
      if (orderRes.rows[0]) {
        await Coupon.useCoupon({
          couponId,
          userId,
          orderId: orderRes.rows[0].order_id,
          orderTotal: orderRes.rows[0].total,
          savedAmount: discountAmount
        });
      }
    }

    // Refresh quest progress after placing order
    await Quest.refreshUserProgress(userId);
  }

  // ─── Update Order Profit (Admin) ──────────────────────────────────
  static async updateProfit(orderId, profit) {
    const result = await db.query(
      `UPDATE orders SET profit = $1 WHERE order_id = $2 RETURNING *`,
      [profit, orderId]
    );
    return result.rows[0] || null;
  }

  // ─── Central Change Status (Handles stock return on refund/cancel & re-deduct on reactivate) ──
  static async changeStatus(orderId, newStatus, performerId = null) {
    const orderCheck = await db.query(
      `SELECT order_id, order_status FROM orders WHERE order_id = $1`,
      [orderId]
    );
    if (!orderCheck.rows[0]) return null;

    const oldStatus = orderCheck.rows[0].order_status;
    if (oldStatus === newStatus) {
      return orderCheck.rows[0];
    }

    const inactiveStatuses = ['cancelled', 'refunded'];
    const isOldInactive = inactiveStatuses.includes(oldStatus);
    const isNewInactive = inactiveStatuses.includes(newStatus);

    const itemsResult = await db.query(
      `SELECT product_id, selected_option, product_quantity FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const items = itemsResult.rows;

    const Coupon = require('./Coupon');
    const Quest  = require('./Quest');

    // Transition: Active -> Inactive (Cancelled or Refunded) => Restore coupon claim & add back stock
    if (!isOldInactive && isNewInactive) {
      await Coupon.restoreCoupon(orderId);

      for (const item of items) {
        const qty = parseInt(item.product_quantity, 10);
        if (isNaN(qty) || qty <= 0) continue;

        // Restore main product stock
        await db.query(
          `UPDATE products SET product_stock = product_stock + $1 WHERE product_id = $2`,
          [qty, item.product_id]
        );

        // Restore variant stock if option exists
        if (item.selected_option && item.selected_option !== '—') {
          await db.query(
            `UPDATE product_variants SET variant_stock = variant_stock + $1
             WHERE product_id = $2 AND TRIM(variant_name) ILIKE TRIM($3)`,
            [qty, item.product_id, item.selected_option]
          );
        }

        const afterResult = await db.query(
          `SELECT product_stock FROM products WHERE product_id = $1`,
          [item.product_id]
        );
        const stockAfter = afterResult.rows[0]?.product_stock || 0;
        const movementType = newStatus === 'refunded' ? 'refund' : 'return';

        await db.query(
          `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [item.product_id, movementType, qty, stockAfter, `Order #${orderId} changed to ${newStatus}`, performerId]
        );
      }
    }

    // Transition: Inactive -> Active => Re-deduct stock
    if (isOldInactive && !isNewInactive) {
      const orderData = await db.query(`SELECT coupon_id, user_id, total, discount_amount FROM orders WHERE order_id = $1`, [orderId]);
      if (orderData.rows[0]?.coupon_id && orderData.rows[0]?.user_id) {
        await Coupon.useCoupon({
          couponId: orderData.rows[0].coupon_id,
          userId: orderData.rows[0].user_id,
          orderId: orderId,
          orderTotal: orderData.rows[0].total,
          savedAmount: orderData.rows[0].discount_amount
        });
      }

      for (const item of items) {
        const qty = parseInt(item.product_quantity, 10);
        if (isNaN(qty) || qty <= 0) continue;

        // Deduct main product stock
        await db.query(
          `UPDATE products SET product_stock = product_stock - $1 WHERE product_id = $2`,
          [qty, item.product_id]
        );

        // Deduct variant stock if option exists
        if (item.selected_option && item.selected_option !== '—') {
          await db.query(
            `UPDATE product_variants SET variant_stock = variant_stock - $1
             WHERE product_id = $2 AND TRIM(variant_name) ILIKE TRIM($3)`,
            [qty, item.product_id, item.selected_option]
          );
        }

        const afterResult = await db.query(
          `SELECT product_stock FROM products WHERE product_id = $1`,
          [item.product_id]
        );
        const stockAfter = afterResult.rows[0]?.product_stock || 0;

        await db.query(
          `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
           VALUES ($1, 'sale', $2, $3, $4, $5)`,
          [item.product_id, -qty, stockAfter, `Order #${orderId} reopened to ${newStatus}`, performerId]
        );
      }
    }

    const updateResult = await db.query(
      `UPDATE orders SET order_status = $1 WHERE order_id = $2 RETURNING *`,
      [newStatus, orderId]
    );

    const targetUserId = updateResult.rows[0]?.user_id;
    if (targetUserId) {
      await Quest.refreshUserProgress(targetUserId);
    }

    return updateResult.rows[0] || null;
  }

  // ─── Update Order Status (Customer or Admin) ─────────────────────
  static async updateStatus(orderId, userId, status) {
    if (userId) {
      const check = await db.query(`SELECT user_id FROM orders WHERE order_id = $1`, [orderId]);
      if (!check.rows[0] || check.rows[0].user_id !== userId) return null;
    }
    return await Order.changeStatus(orderId, status, userId);
  }

  // ─── Pay Remaining Balance ──────────────────────────────────────────
  static async payBalance(orderId, userId) {
    const result = await db.query(
      `UPDATE orders SET payment_status = 'full_paid' WHERE order_id = $1 AND user_id = $2 RETURNING *`,
      [orderId, userId]
    );
    return result.rows[0] || null;
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
         o.subtotal,
         o.discount_amount,
         o.coupon_code,
         o.total,
         o.shipping_method,
         o.shipping_company,
         o.tracking_number,
         o.shipping_date,
         o.shipping_image,
         o.refund_date,
         o.refund_image,
         o.addr_type,
         o.addr_line1,
         o.addr_district,
         o.addr_city,
         o.addr_landmark,
         o.maps_link,
         o.maps_detail,
         o.phone1,
         o.phone2,
         COUNT(oi.order_item_id)  AS total_lines,
         COALESCE(SUM(oi.product_quantity), 0) AS total_units
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.order_id
       WHERE o.user_id = $1
       GROUP BY o.order_id, o.order_code, o.order_status,
                o.order_date, o.subtotal, o.discount_amount, o.coupon_code, o.total, o.shipping_method,
                o.shipping_company, o.tracking_number,
                o.shipping_date, o.shipping_image,
                o.refund_date, o.refund_image,
                o.addr_type, o.addr_line1, o.addr_district, o.addr_city, o.addr_landmark,
                o.maps_link, o.maps_detail, o.phone1, o.phone2
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
      shippingMethod, shippingCost, orderNote, adminNote, customerNote
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
         admin_note       = COALESCE($13, admin_note),
         customer_note    = COALESCE($14, customer_note)
       WHERE order_id = $15
       RETURNING *`,
      [addrType ?? null, addrLine1 ?? null, addrDistrict ?? null, addrCity ?? null, addrLandmark ?? null,
       mapsLink ?? null, mapsDetail ?? null, phone1 ?? null, phone2 ?? null,
       shippingMethod ?? null, shippingCost ?? null, orderNote ?? null, adminNote ?? null, customerNote ?? null,
       orderId]
    );
    return result.rows[0] || null;
  }

  // ─── Admin: replace order items entirely ──────────────────────
  static async adminUpdateItems(orderId, newItems, adminId) {
    // 1. Get current items for this order
    const currentResult = await db.query(
      `SELECT order_item_id, product_id, selected_option, product_quantity
       FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const currentItems = currentResult.rows;

    const orderCheck = await db.query(
      `SELECT order_status FROM orders WHERE order_id = $1`,
      [orderId]
    );
    if (!orderCheck.rows[0]) throw new Error('Order not found');

    const orderStatus = orderCheck.rows[0].order_status;
    const isInactive = ['cancelled', 'refunded'].includes(orderStatus);

    // 2. Build lookup keyed by product_id + selected_option
    const key = (productId, opt) => `${productId}::${(opt || '').trim().toLowerCase()}`;
    const currentMap = new Map(currentItems.map(it => [key(it.product_id, it.selected_option), it]));
    const newMap     = new Map(newItems.map(it => [key(it.productId, it.selectedOption), it]));

    // 3. Removed items — restore stock if order is active
    for (const [k, oldItem] of currentMap) {
      if (!newMap.has(k)) {
        if (!isInactive) {
          const qty = parseInt(oldItem.product_quantity, 10);
          await db.query(
            `UPDATE products SET product_stock = product_stock + $1 WHERE product_id = $2`,
            [qty, oldItem.product_id]
          );
          if (oldItem.selected_option && oldItem.selected_option !== '—') {
            await db.query(
              `UPDATE product_variants SET variant_stock = variant_stock + $1
               WHERE product_id = $2 AND TRIM(variant_name) ILIKE TRIM($3)`,
              [qty, oldItem.product_id, oldItem.selected_option]
            );
          }
          const afterResult = await db.query(
            `SELECT product_stock FROM products WHERE product_id = $1`, [oldItem.product_id]
          );
          await db.query(
            `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
             VALUES ($1, 'return', $2, $3, 'Removed from order by admin', $4)`,
            [oldItem.product_id, qty, afterResult.rows[0]?.product_stock || 0, adminId]
          );
        }
        await db.query(`DELETE FROM order_items WHERE order_item_id = $1`, [oldItem.order_item_id]);
      }
    }

    // 4. New + changed items
    for (const [k, item] of newMap) {
      const existing = currentMap.get(k);

      if (!existing) {
        // brand new line item — deduct stock if order is active
        const qty = parseInt(item.quantity, 10);
        if (!isInactive) {
          await db.query(
            `UPDATE products SET product_stock = product_stock - $1 WHERE product_id = $2`,
            [qty, item.productId]
          );
          if (item.selectedOption && item.selectedOption !== '—') {
            await db.query(
              `UPDATE product_variants SET variant_stock = variant_stock - $1
               WHERE product_id = $2 AND TRIM(variant_name) ILIKE TRIM($3)`,
              [qty, item.productId, item.selectedOption]
            );
          }
          const afterResult = await db.query(
            `SELECT product_stock FROM products WHERE product_id = $1`, [item.productId]
          );
          await db.query(
            `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
             VALUES ($1, 'sale', $2, $3, 'Added to order by admin', $4)`,
            [item.productId, -qty, afterResult.rows[0]?.product_stock || 0, adminId]
          );
        }
        await db.query(
          `INSERT INTO order_items (order_id, product_id, selected_option, product_quantity, price_at_purchase, item_note)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, item.productId, item.selectedOption || null, qty, item.priceAtPurchase, item.itemNote || null]
        );
      } else if (parseInt(existing.product_quantity, 10) !== parseInt(item.quantity, 10)) {
        // quantity changed — adjust stock by delta if order is active
        const oldQty = parseInt(existing.product_quantity, 10);
        const newQty = parseInt(item.quantity, 10);
        const delta = newQty - oldQty; // +ve = more taken from stock

        if (!isInactive && delta !== 0) {
          await db.query(
            `UPDATE products SET product_stock = product_stock - $1 WHERE product_id = $2`,
            [delta, item.productId]
          );
          if (item.selectedOption && item.selectedOption !== '—') {
            await db.query(
              `UPDATE product_variants SET variant_stock = variant_stock - $1
               WHERE product_id = $2 AND TRIM(variant_name) ILIKE TRIM($3)`,
              [delta, item.productId, item.selectedOption]
            );
          }
          const afterResult = await db.query(
            `SELECT product_stock FROM products WHERE product_id = $1`, [item.productId]
          );
          await db.query(
            `INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note, performed_by)
             VALUES ($1, 'adjustment', $2, $3, 'Order quantity changed by admin', $4)`,
            [item.productId, -delta, afterResult.rows[0]?.product_stock || 0, adminId]
          );
        }
        await db.query(
          `UPDATE order_items SET product_quantity = $1, item_note = COALESCE($2, item_note)
           WHERE order_item_id = $3`,
          [newQty, item.itemNote, existing.order_item_id]
        );
      } else if (item.itemNote !== undefined) {
        // only note changed, no stock impact
        await db.query(
          `UPDATE order_items SET item_note = $1 WHERE order_item_id = $2`,
          [item.itemNote, existing.order_item_id]
        );
      }
    }

    // 5. Recalculate subtotal/total preserving coupon discounts
    const subtotalResult = await db.query(
      `SELECT COALESCE(SUM(price_at_purchase * product_quantity), 0) AS subtotal
       FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const subtotal = parseFloat(subtotalResult.rows[0].subtotal);

    const orderResult = await db.query(
      `SELECT shipping_cost, discount_amount, coupon_id FROM orders WHERE order_id = $1`,
      [orderId]
    );
    const shippingCost = orderResult.rows[0]?.shipping_cost !== null && orderResult.rows[0]?.shipping_cost !== undefined
      ? parseFloat(orderResult.rows[0].shipping_cost)
      : null;

    let discountAmount = parseFloat(orderResult.rows[0]?.discount_amount || 0);
    if (orderResult.rows[0]?.coupon_id) {
      const Coupon = require('./Coupon');
      const coupon = await Coupon.findById(orderResult.rows[0].coupon_id);
      if (coupon && coupon.discount_type === 'percent') {
        let d = subtotal * (parseFloat(coupon.discount_value) / 100);
        if (coupon.max_discount && d > parseFloat(coupon.max_discount)) {
          d = parseFloat(coupon.max_discount);
        }
        discountAmount = Math.round(d * 100) / 100;
      }
    }
    discountAmount = Math.min(discountAmount, subtotal);

    const total = shippingCost !== null
      ? Math.max(0, (subtotal - discountAmount) + shippingCost)
      : Math.max(0, subtotal - discountAmount);

    await db.query(
      `UPDATE orders SET subtotal = $1, discount_amount = $2, total = $3 WHERE order_id = $4`,
      [subtotal, discountAmount, total, orderId]
    );

    return { subtotal, discountAmount, total };
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