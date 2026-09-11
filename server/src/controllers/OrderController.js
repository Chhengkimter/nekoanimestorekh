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
        orderNote,
        paymentMethod, isPhnomPenh,
        couponCode
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
        orderNote,
        paymentMethod, isPhnomPenh,
        couponCode
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

  // ─── POST /api/orders/service ──────────────────────────────
  // Place custom proxy order service request
  static async placeOrderService(req, res) {
    try {
      const userId = req.user?.id || null;

      const {
        serviceTier, preferredContact,
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail,
        phone1, phone2,
        orderNote,
        subtotal, shippingCost, total,
        items
      } = req.body;

      if (!phone1) return res.status(400).json({ error: 'Phone number is required' });
      if (!serviceTier) return res.status(400).json({ error: 'Service tier is required' });
      if (!items || !items.length) return res.status(400).json({ error: 'At least one item link is required' });

      const orderCode = 'NK-SVC-' + Order.generateOrderCode().replace('NK-', '');

      const order = await Order.placeCustomService({
        userId, orderCode,
        serviceTier, preferredContact: preferredContact || 'telegram',
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail,
        phone1, phone2,
        orderNote,
        subtotal: subtotal || 0,
        shippingCost: shippingCost || 0,
        total: total || 0,
        items
      });

      // Construct direct social channel URL with prefilled text
      let redirectUrl = '';
      const text = encodeURIComponent(`Hi Neko Animestore! I just submitted custom Order Service request #${orderCode}. Please check my order details.`);
      if (preferredContact === 'facebook') {
        redirectUrl = `https://m.me/Nekoanimestore.kh`;
      } else if (preferredContact === 'instagram') {
        redirectUrl = `https://ig.me/m/nekoanimestore.kh`;
      } else {
        redirectUrl = `https://t.me/rizeisok?text=${text}`;
      }

      res.status(201).json({
        message: 'Order Service request submitted successfully!',
        orderCode,
        redirectUrl,
        order
      });

    } catch (err) {
      console.error('placeOrderService error:', err.message);
      res.status(500).json({ error: 'Failed to submit Order Service request' });
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
  static async confirmModification(req, res) {
    try {
      const order = await Order.updateStatus(req.params.id, req.user.id, 'confirmed');
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.status(200).json({ message: 'Order confirmed successfully', order });
    } catch (err) {
      console.error('confirmModification error:', err.message);
      res.status(500).json({ error: 'Failed to confirm order' });
    }
  }

  static async cancelModification(req, res) {
    try {
      const order = await Order.updateStatus(req.params.id, req.user.id, 'cancelled');
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.status(200).json({ message: 'Order cancelled successfully', order });
    } catch (err) {
      console.error('cancelModification error:', err.message);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  }

  static async payBalance(req, res) {
    try {
      const order = await Order.payBalance(req.params.id, req.user.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.status(200).json({ message: 'Balance paid successfully', order });
    } catch (err) {
      console.error('payBalance error:', err.message);
      res.status(500).json({ error: 'Failed to pay balance' });
    }
  }

  static async markReceived(req, res) {
    try {
      const order = await Order.updateStatus(req.params.id, req.user.id, 'delivered');
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.status(200).json({ message: 'Order marked as received', order });
    } catch (err) {
      console.error('markReceived error:', err.message);
      res.status(500).json({ error: 'Failed to mark order as received' });
    }
  }
  static async updateProfit(req, res) {
    try {
      const { profit } = req.body;
      const orderId = req.params.id;
      // Admins only (enforced by route middleware)
      const profitVal = (profit === '' || profit === null || profit === undefined) ? null : parseFloat(profit);
      const finalProfit = (profitVal !== null && !isNaN(profitVal)) ? profitVal : null;
      const order = await Order.updateProfit(orderId, finalProfit);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.status(200).json({ message: 'Order profit updated successfully', order });
    } catch (err) {
      console.error('updateProfit error:', err.message);
      res.status(500).json({ error: 'Failed to update order profit' });
    }
  }
}

module.exports = OrderController;