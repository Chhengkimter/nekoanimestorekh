const db = require('../config/db');
const Order = require('../models/Order');
const ImageUploader = require('../services/ImageUploader');

class AdminController {

  static getAdminId(req) {
    return req.admin?.admin_id ?? req.user?.id ?? null;
  }

  static async getAllOrders(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = `SELECT * FROM vw_order_summary WHERE 1=1`;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND order_status = $${params.length}`;
      }

      query += ` ORDER BY order_date DESC`;
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;

      const result = await db.query(query, params);
      res.status(200).json(result.rows);

    } catch (err) {
      console.error('getAllOrders error:', err.message);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }


  // ─── GET /api/admin/orders/:id ────────────────────────────────
  // Get one order with full items (admin can see any order)
  static async getOrder(req, res) {
    try {
      const orderResult = await db.query(
        `SELECT * FROM vw_order_summary WHERE order_id = $1`,
        [req.params.id]
      );

      if (!orderResult.rows[0]) {
        return res.status(404).json({ error: 'Order not found' });
      }

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
        [order.order_id]
      );
      order.items = itemsResult.rows;

      res.status(200).json(order);

    } catch (err) {
      console.error('getOrder error:', err.message);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  }


  // ─── PATCH /api/admin/orders/:id/status ──────────────────────
  // Update order status (pending → confirmed → shipped → delivered)
  static async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      const validStatuses = ['pending','confirmed','shipped','delivered','cancelled','refunded'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const adminId = AdminController.getAdminId(req);
      const updated = await Order.changeStatus(req.params.id, status, adminId);

      if (!updated) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json({
        message: 'Order status updated',
        order:   updated
      });

    } catch (err) {
      console.error('updateOrderStatus error:', err.message);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  }


  // ─── POST /api/admin/orders/:id/ship ──────────────────────────
  static async shipOrder(req, res) {
    try {
      const { shippingCompany, trackingNumber, shippingDate } = req.body;
      const orderId = req.params.id;
      const adminId = AdminController.getAdminId(req);

      let shippingImage = null;
      if (req.file) {
        shippingImage = await ImageUploader.upload(req.file);
      }

      await Order.changeStatus(orderId, 'shipped', adminId);

      const result = await db.query(
        `UPDATE orders SET 
          shipping_company = $1,
          tracking_number = $2,
          shipping_date = $3,
          shipping_image = COALESCE($4, shipping_image)
         WHERE order_id = $5 RETURNING *`,
        [shippingCompany, trackingNumber, shippingDate || new Date().toISOString(), shippingImage, orderId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json({ message: 'Order shipped', order: result.rows[0] });
    } catch (err) {
      console.error('shipOrder error:', err.message);
      res.status(500).json({ error: 'Failed to ship order' });
    }
  }

  // ─── POST /api/admin/orders/:id/refund ────────────────────────
  static async refundOrder(req, res) {
    try {
      const { refundDate } = req.body;
      const orderId = req.params.id;
      const adminId = AdminController.getAdminId(req);

      let refundImage = null;
      if (req.file) {
        refundImage = await ImageUploader.upload(req.file);
      }

      await Order.changeStatus(orderId, 'refunded', adminId);

      const result = await db.query(
        `UPDATE orders SET 
          refund_date = $1,
          refund_image = COALESCE($2, refund_image)
         WHERE order_id = $3 RETURNING *`,
        [refundDate || new Date().toISOString(), refundImage, orderId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json({ message: 'Order refunded', order: result.rows[0] });
    } catch (err) {
      console.error('refundOrder error:', err.message);
      res.status(500).json({ error: 'Failed to refund order' });
    }
  }


  // ─── GET /api/admin/customers ─────────────────────────────────
  // Get all customers
  static async getAllCustomers(req, res) {
    try {
      const result = await db.query(
        `SELECT
           user_id, first_name, last_name, email,
           phone_number, created_at, last_login
         FROM users
         ORDER BY created_at DESC`
      );
      res.status(200).json(result.rows);

    } catch (err) {
      console.error('getAllCustomers error:', err.message);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  }


  // ─── GET /api/admin/dashboard ─────────────────────────────────
  // Stats for admin dashboard cards
  static async getDashboard(req, res) {
    try {
      const [orders, revenue, customers, lowStock] = await Promise.all([

        // Total orders + breakdown by status
        db.query(
          `SELECT
             COUNT(*)                                         AS total_orders,
             COUNT(*) FILTER (WHERE order_status = 'pending')   AS pending,
             COUNT(*) FILTER (WHERE order_status = 'confirmed') AS confirmed,
             COUNT(*) FILTER (WHERE order_status = 'shipped')   AS shipped,
             COUNT(*) FILTER (WHERE order_status = 'delivered') AS delivered
           FROM orders`
        ),

        // Total revenue from delivered orders
        db.query(
          `SELECT COALESCE(SUM(total), 0) AS total_revenue
           FROM orders WHERE order_status = 'delivered'`
        ),

        // Total customers
        db.query(`SELECT COUNT(*) AS total_customers FROM users`),

        // Low stock products
        db.query(`SELECT * FROM vw_low_stock LIMIT 5`)
      ]);

      res.status(200).json({
        orders:    orders.rows[0],
        revenue:   revenue.rows[0],
        customers: customers.rows[0],
        lowStock:  lowStock.rows
      });

    } catch (err) {
      console.error('getDashboard error:', err.message);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }


  // ─── GET /api/admin/inventory ─────────────────────────────────
  // Inventory movement log
  static async getInventoryLog(req, res) {
    try {
      const result = await db.query(
        `SELECT * FROM vw_inventory_log LIMIT 100`
      );
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('getInventoryLog error:', err.message);
      res.status(500).json({ error: 'Failed to fetch inventory log' });
    }
  }


  // ─── POST /api/admin/inventory/restock ───────────────────────
  // Restock a product
  static async restockProduct(req, res) {
    try {
      const { productId, quantity, note } = req.body;
      const adminId = req.admin?.admin_id ?? null;

      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'productId and quantity required' });
      }

      await db.query(
        `CALL sp_restock_product($1, $2, $3, $4)`,
        [productId, quantity, adminId, note || null]
      );

      res.status(200).json({ message: `Restocked product ${productId} by ${quantity} units` });

    } catch (err) {
      console.error('restockProduct error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to restock product' });
    }
  }


  // ─── POST /api/admin/inventory/adjust ────────────────────────
  // Manually set stock level
  static async adjustStock(req, res) {
    try {
      const { productId, newQty, note } = req.body;
      const adminId = req.admin?.admin_id ?? null;  // ← safe

      if (productId === undefined || newQty === undefined) {
        return res.status(400).json({ error: 'productId and newQty required' });
      }

      await db.query(
        `CALL sp_adjust_stock($1, $2, $3, $4)`,
        [productId, newQty, adminId, note || 'Manual adjustment']
      );

      res.status(200).json({ message: `Stock for product ${productId} set to ${newQty}` });
    } catch (err) {
      console.error('adjustStock error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to adjust stock' });
    }
  }

  // ── ADD THESE METHODS TO YOUR EXISTING AdminController.js ──────
  // (paste inside the AdminController class)
  // Make sure to add this require at the top of the file:
  //   const Order = require('../models/Order');

    // ─── PATCH /api/admin/orders/:id/edit ──────────────────────────
    // Update order-level fields: address, phone, shipping, notes
    static async updateOrderFields(req, res) {
      try {
        const orderCheck = await db.query(`SELECT order_status FROM orders WHERE order_id = $1`, [req.params.id]);
        if (!orderCheck.rows[0]) return res.status(404).json({ error: 'Order not found' });
        const currentStatus = orderCheck.rows[0].order_status;
        if (currentStatus !== 'pending' && currentStatus !== 'confirmed' && currentStatus !== 'modified') {
          return res.status(400).json({ error: 'Cannot modify an order that has already been shipped or delivered.' });
        }

        const updated = await Order.adminUpdateFields(req.params.id, req.body);
        
        res.status(200).json({ message: 'Order updated', order: updated });
      } catch (err) {
        console.error('updateOrderFields error:', err.message);
        res.status(500).json({ error: 'Failed to update order' });
      }
    }


    // ─── PUT /api/admin/orders/:id/items ───────────────────────────
    // Replace order items: handles add/remove/quantity changes,
    // adjusts stock accordingly, recalculates totals
    static async updateOrderItems(req, res) {
      try {
        const orderCheck = await db.query(`SELECT order_status FROM orders WHERE order_id = $1`, [req.params.id]);
        if (!orderCheck.rows[0]) return res.status(404).json({ error: 'Order not found' });
        const currentStatus = orderCheck.rows[0].order_status;
        if (currentStatus !== 'pending' && currentStatus !== 'confirmed' && currentStatus !== 'modified') {
          return res.status(400).json({ error: 'Cannot modify an order that has already been shipped or delivered.' });
        }

        const { items } = req.body;
        if (!Array.isArray(items)) {
          return res.status(400).json({ error: 'items must be an array' });
        }

        const adminId = req.admin?.admin_id || req.user?.id;
        const result = await Order.adminUpdateItems(req.params.id, items, adminId);

        res.status(200).json({ message: 'Order items updated', ...result });
      } catch (err) {
        console.error('updateOrderItems error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to update order items' });
      }
    }

    // ─── POST /api/admin/orders/:id/request-payment ─────────────────
    static async requestFinalPayment(req, res) {
      try {
        const orderId = req.params.id;
        const orderCheck = await db.query(`SELECT order_status, payment_method, payment_status FROM orders WHERE order_id = $1`, [orderId]);
        if (!orderCheck.rows[0]) return res.status(404).json({ error: 'Order not found' });
        
        await db.query(`UPDATE orders SET order_status = 'awaiting_final_payment' WHERE order_id = $1`, [orderId]);
        res.status(200).json({ message: 'Final payment requested' });
      } catch (err) {
        console.error('requestFinalPayment error:', err.message);
        res.status(500).json({ error: 'Failed to request final payment' });
      }
    }


  // ─── POST /api/admin/orders/:id/payments ───────────────────────
  // Record a payment entry for this order
  static async addOrderPayment(req, res) {
    try {
      const { amount, note } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const adminId = req.admin?.admin_id || req.user?.id;
      const payment = await Order.addPayment(req.params.id, amount, note, adminId);

      res.status(201).json({ message: 'Payment recorded', payment });
    } catch (err) {
      console.error('addOrderPayment error:', err.message);
      res.status(500).json({ error: 'Failed to record payment' });
    }
  }


  // ─── GET /api/admin/orders/:id/payments ────────────────────────
  static async getOrderPayments(req, res) {
    try {
      const payments = await Order.getPayments(req.params.id);
      res.status(200).json(payments);
    } catch (err) {
      console.error('getOrderPayments error:', err.message);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }


  // ─── DELETE /api/admin/orders/:id/payments/:paymentId ──────────
  static async deleteOrderPayment(req, res) {
    try {
      const deleted = await Order.deletePayment(req.params.paymentId);
      if (!deleted) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      res.status(200).json({ message: 'Payment deleted' });
    } catch (err) {
      console.error('deleteOrderPayment error:', err.message);
      res.status(500).json({ error: 'Failed to delete payment' });
    }
  }

  // ── ADD TO AdminController.js ───────────────────────────────────

  // ─── POST /api/admin/orders ─────────────────────────────────────
  // Admin creates a new order directly (no cart involved)
  static async createOrder(req, res) {
    try {
      const {
        userId, guestName, guestEmail,
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail, phone1, phone2,
        shippingMethod, shippingCost, orderNote, adminNote,
        items
      } = req.body;

      if (!userId && !guestName) {
        return res.status(400).json({ error: 'Either an existing customer or a guest name is required' });
      }
      if (!phone1) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      const adminId = req.admin?.admin_id || req.user?.id;
      const orderCode = Order.generateOrderCode();

      await Order.adminPlace({
        userId: userId || null, guestName, guestEmail, orderCode,
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail, phone1, phone2,
        shippingMethod, shippingCost, orderNote, adminNote,
        items, adminId
      });

      const orderResult = await db.query(
        `SELECT * FROM vw_order_summary WHERE order_code = $1`,
        [orderCode]
      );

      res.status(201).json({ message: 'Order created', order: orderResult.rows[0] });

    } catch (err) {
      console.error('createOrder error:', err.message);
      if (err.message.includes('Insufficient stock')) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: err.message || 'Failed to create order' });
    }
  }


  // ─── GET /api/admin/customers/search?q=... ──────────────────────
  // Search existing customers for admin order creation
  static async searchCustomers(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.trim().length < 2) {
        return res.status(200).json([]);
      }
      const users = await Order.searchUsers(q.trim());
      res.status(200).json(users);
    } catch (err) {
      console.error('searchCustomers error:', err.message);
      res.status(500).json({ error: 'Failed to search customers' });
    }
  }
}

module.exports = AdminController;