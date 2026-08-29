const Cart    = require('../models/Cart');
const Product = require('../models/Product');

class CartController {

  // ─── GET /api/cart ────────────────────────────────────────────
  // Get all items in the logged-in user's cart
  static async getCart(req, res) {
    try {
      const userId = req.user.id;
      const items  = await Cart.getByUser(userId);

      // Calculate totals
      const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price_snapshot) * item.quantity);
      }, 0);

      res.status(200).json({
        items,
        subtotal: parseFloat(subtotal.toFixed(2)),
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
      });

    } catch (err) {
      console.error('getCart error:', err.message);
      res.status(500).json({ error: 'Failed to fetch cart' });
    }
  }


  // ─── POST /api/cart/add ───────────────────────────────────────
  // Add item to cart (or increase qty if already there)
  static async addItem(req, res) {
    try {
      const userId = req.user.id;
      const { productId, selectedOption, quantity = 1, note } = req.body;

      // 1. Validate
      if (!productId) {
        return res.status(400).json({ error: 'productId is required' });
      }

      // 2. Check product exists and has stock
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product.product_status === 'archived' ||
          product.product_status === 'inactive') {
        return res.status(400).json({ error: 'Product is not available' });
      }

      // Check stock limits dynamically
      if (product.stock_status === 'instock') {
        let maxStock = parseInt(product.product_stock, 10) || 0;
        if (selectedOption && product.variants?.length > 0) {
          const variant = product.variants.find(v => (v.variant_name || '').trim().toLowerCase() === (selectedOption || '').trim().toLowerCase());
          if (variant) maxStock = parseInt(variant.variant_stock, 10) || 0;
        }

        const items = await Cart.getByUser(userId);
        const existingItem = items.find(i => String(i.product_id) === String(productId) && i.selected_option === (selectedOption || null));
        const existingQty = existingItem ? parseInt(existingItem.quantity, 10) : 0;
        const requestedQty = parseInt(quantity, 10) || 1;

        if (existingQty + requestedQty > maxStock) {
          return res.status(400).json({ error: 'Not enough stock available' });
        }
      }

      // 3. Use current sale price as snapshot
      const priceSnapshot = parseFloat(product.sale_price);

      // 4. Add to cart
      await Cart.upsertItem(userId, {
        productId,
        selectedOption: selectedOption || null,
        quantity:       parseInt(quantity),
        priceSnapshot,
        note:           note || ''
      });

      // 5. Return updated cart count
      const count = await Cart.getCount(userId);

      res.status(200).json({
        message:   'Item added to cart',
        cartCount: count
      });

    } catch (err) {
      console.error('addItem error:', err.message);
      res.status(500).json({ error: 'Failed to add item to cart' });
    }
  }


  // ─── PATCH /api/cart/:cartItemId ──────────────────────────────
  // Update quantity of a cart item
  static async updateQuantity(req, res) {
    try {
      const userId     = req.user.id;
      const cartItemId = req.params.cartItemId;
      const { quantity } = req.body;
      
      if (!quantity || quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be at least 1' });
      }

      // Fetch the cart item to check its stock
      const items = await Cart.getByUser(userId);
      const cartItem = items.find(i => String(i.cart_item_id) === String(cartItemId));
      
      if (!cartItem) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      // Validate stock (only enforce if increasing)
      if (cartItem.stock_status === 'instock') {
        const maxStock = parseInt(cartItem.product_stock, 10) || 0; // product_stock is already COALESCE'd in getByUser
        const requestedQuantity = parseInt(quantity, 10);
        const currentQuantity = parseInt(cartItem.quantity, 10);
        
        if (requestedQuantity > maxStock && requestedQuantity > currentQuantity) {
          return res.status(400).json({ error: 'Not enough stock available' });
        }
      }

      const updated = await Cart.updateQuantity(cartItemId, userId, quantity);
      if (!updated) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      res.status(200).json({ message: 'Quantity updated', item: updated });

    } catch (err) {
      console.error('updateQuantity error:', err.message);
      res.status(500).json({ error: 'Failed to update quantity' });
    }
  }


  // ─── DELETE /api/cart/:cartItemId ─────────────────────────────
  // Remove one item from cart
  static async removeItem(req, res) {
    try {
      const userId     = req.user.id;
      const cartItemId = req.params.cartItemId;

      const deleted = await Cart.removeItem(cartItemId, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      const count = await Cart.getCount(userId);
      res.status(200).json({ message: 'Item removed', cartCount: count });

    } catch (err) {
      console.error('removeItem error:', err.message);
      res.status(500).json({ error: 'Failed to remove item' });
    }
  }


  // ─── DELETE /api/cart ─────────────────────────────────────────
  // Clear entire cart
  static async clearCart(req, res) {
    try {
      await Cart.clear(req.user.id);
      res.status(200).json({ message: 'Cart cleared' });
    } catch (err) {
      console.error('clearCart error:', err.message);
      res.status(500).json({ error: 'Failed to clear cart' });
    }
  }


  // ─── GET /api/cart/count ──────────────────────────────────────
  // Get item count for navbar badge
  static async getCount(req, res) {
    try {
      const count = await Cart.getCount(req.user.id);
      res.status(200).json({ count });
    } catch (err) {
      console.error('getCount error:', err.message);
      res.status(500).json({ error: 'Failed to get cart count' });
    }
  }

}

module.exports = CartController;