const db = require('../config/db');

class AdminController {

  // ─── GET /api/admin/orders ────────────────────────────────────
  // Get all orders with optional status filter
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

      const result = await db.query(
        `UPDATE orders SET order_status = $1
         WHERE order_id = $2
         RETURNING order_id, order_code, order_status`,
        [status, req.params.id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json({
        message: 'Order status updated',
        order:   result.rows[0]
      });

    } catch (err) {
      console.error('updateOrderStatus error:', err.message);
      res.status(500).json({ error: 'Failed to update order status' });
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
      const adminId = req.admin?.admin_id || req.user?.id;

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
      const adminId = req.admin.admin_id;

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

}

module.exports = AdminController;