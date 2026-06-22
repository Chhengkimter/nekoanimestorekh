const Wishlist = require('../models/Wishlist');

class WishlistController {

  // GET /api/wishlist — full wishlist with joined product data
  static async getAll(req, res) {
    try {
      const userId = req.user.userId; // set by requireAuth middleware
      const items = await Wishlist.findByUser(userId);
      res.json(items);
    } catch (err) {
      console.error('Wishlist getAll error:', err);
      res.status(500).json({ error: 'Failed to load wishlist' });
    }
  }

  // GET /api/wishlist/ids — lightweight list of product_ids only
  // (frontend uses this to mark hearts active on listing/product pages
  // without fetching full product rows it already has)
  static async getIds(req, res) {
    try {
      const userId = req.user.userId;
      const ids = await Wishlist.findProductIdsByUser(userId);
      res.json(ids);
    } catch (err) {
      console.error('Wishlist getIds error:', err);
      res.status(500).json({ error: 'Failed to load wishlist ids' });
    }
  }

  // POST /api/wishlist/toggle  { productId }
  static async toggle(req, res) {
    try {
      const userId = req.user.id;
      const { productId } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });

      const result = await Wishlist.toggle(userId, productId);
      res.json(result);
    } catch (err) {
      console.error('Wishlist toggle error:', err);
      res.status(500).json({ error: 'Failed to update wishlist' });
    }
  }

  // DELETE /api/wishlist/:productId — explicit remove (used on wishlist page)
  static async remove(req, res) {
    try {
      const userId = req.user.userId;
      const { productId } = req.params;
      await Wishlist.remove(userId, productId);
      res.json({ wishlisted: false });
    } catch (err) {
      console.error('Wishlist remove error:', err);
      res.status(500).json({ error: 'Failed to remove from wishlist' });
    }
  }

}

module.exports = WishlistController;