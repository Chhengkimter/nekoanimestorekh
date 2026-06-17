const Order = require('../models/Order');
const Cart  = require('../models/Cart');

class OrderController {

  // ─── POST /api/orders ─────────────────────────────────────────
  // Place order from cart → wires to address.js / checkout page
  static async placeOrder(req, res) {
    try {
      const userId = req.user.id;

      const {
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail,
        phone1, phone2,
        shippingMethod, shippingCost,
        orderNote
      } = req.body;

      // 1. Validate required fields
      if (!phone1) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      if (addrType === 'manual' && !addrLine1) {
        return res.status(400).json({ error: 'Address is required' });
      }

      if (addrType === 'maps' && !mapsLink) {
        return res.status(400).json({ error: 'Maps link is required' });
      }

      // 2. Check cart has items
      const cartItems = await Cart.getByUser(userId);
      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      // 3. Generate unique order code
      const orderCode = Order.generateOrderCode();

      // 4. Place order via stored procedure
      // (handles: create order, create order items,
      //  deduct stock, log inventory, clear cart)
      await Order.place({
        userId, orderCode,
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail,
        phone1, phone2,
        shippingMethod, shippingCost,
        orderNote
      });

      // 5. Fetch the created order to return
      const order = await Order.findByCode(orderCode, userId);

      res.status(201).json({
        message:   'Order placed successfully',
        orderCode,
        order
      });

    } catch (err) {
      console.error('placeOrder error:', err.message);

      // Handle specific DB errors from stored procedure
      if (err.message.includes('Insufficient stock')) {
        return res.status(400).json({ error: err.message });
      }
      if (err.message.includes('No cart')) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      res.status(500).json({ error: 'Failed to place order' });
    }
  }


  // ─── GET /api/orders/history ──────────────────────────────────
  // Customer order history → wires to account/user.html
  // NOTE: must be defined BEFORE /:id to avoid route conflict
  static async getHistory(req, res) {
    try {
      const orders = await Order.findByUser(req.user.id);
      res.status(200).json(orders);
    } catch (err) {
      console.error('getHistory error:', err.message);
      res.status(500).json({ error: 'Failed to fetch order history' });
    }
  }


  // ─── GET /api/orders/:id ──────────────────────────────────────
  // Get one order by ID → wires to confirmation.html
  static async getOrder(req, res) {
    try {
      const userId = req.user.id;

      // Support both order ID (number) and order code (NK-xxx)
      const param = req.params.id;
      let order;

      if (param.startsWith('NK-')) {
        order = await Order.findByCode(param, userId);
      } else {
        order = await Order.findById(parseInt(param), userId);
      }

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json(order);

    } catch (err) {
      console.error('getOrder error:', err.message);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  }

}

module.exports = OrderController;