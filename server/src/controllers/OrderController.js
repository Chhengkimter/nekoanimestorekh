const Order = require('../models/Order');
const Cart  = require('../models/Cart');

class OrderController {

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

      if (!phone1) return res.status(400).json({ error: 'Phone number is required' });
      if (addrType === 'manual' && !addrLine1) return res.status(400).json({ error: 'Address is required' });
      if (addrType === 'maps'   && !mapsLink)  return res.status(400).json({ error: 'Maps link is required' });

      const cartItems = await Cart.getByUser(userId);
      if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

      const orderCode = Order.generateOrderCode();

      await Order.place({
        userId, orderCode,
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail,
        phone1, phone2,
        shippingMethod, shippingCost,
        orderNote
      });

      const order = await Order.findByCode(orderCode, userId);

      res.status(201).json({ message: 'Order placed successfully', orderCode, order });

    } catch (err) {
      console.error('placeOrder error:', err.message);
      if (err.message.includes('Insufficient stock')) return res.status(400).json({ error: err.message });
      if (err.message.includes('No cart'))            return res.status(400).json({ error: 'Cart is empty' });
      res.status(500).json({ error: 'Failed to place order' });
    }
  }

  static async getHistory(req, res) {
    try {
      const orders = await Order.findByUser(req.user.id);
      res.status(200).json(orders);
    } catch (err) {
      console.error('getHistory error:', err.message);
      res.status(500).json({ error: 'Failed to fetch order history' });
    }
  }

  static async getOrder(req, res) {
    try {
      const userId = req.user.id;
      const param  = req.params.id;
      const order  = param.startsWith('NK-')
        ? await Order.findByCode(param, userId)
        : await Order.findById(parseInt(param), userId);

      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.status(200).json(order);

    } catch (err) {
      console.error('getOrder error:', err.message);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  }
}

module.exports = OrderController;