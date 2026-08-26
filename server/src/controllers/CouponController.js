const Coupon = require('../models/Coupon');

class CouponController {

  // ── ADMIN: List all coupons ─────────────────────────────────
  static async getAll(req, res) {
    try {
      const coupons = await Coupon.findAll();
      res.json(coupons);
    } catch (err) {
      console.error('CouponController.getAll:', err);
      res.status(500).json({ error: 'Failed to load coupons' });
    }
  }

  // ── ADMIN: Get single coupon ───────────────────────────────
  static async getOne(req, res) {
    try {
      const coupon = await Coupon.findById(req.params.id);
      if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
      res.json(coupon);
    } catch (err) {
      console.error('CouponController.getOne:', err);
      res.status(500).json({ error: 'Failed to load coupon' });
    }
  }

  // ── ADMIN: Create coupon ───────────────────────────────────
  static async create(req, res) {
    try {
      const coupon = await Coupon.create(req.body);
      res.status(201).json(coupon);
    } catch (err) {
      console.error('CouponController.create:', err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Coupon code already exists' });
      }
      res.status(500).json({ error: 'Failed to create coupon' });
    }
  }

  // ── ADMIN: Update coupon ───────────────────────────────────
  static async update(req, res) {
    try {
      const coupon = await Coupon.update(req.params.id, req.body);
      if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
      res.json(coupon);
    } catch (err) {
      console.error('CouponController.update:', err);
      res.status(500).json({ error: 'Failed to update coupon' });
    }
  }

  // ── ADMIN: Delete coupon ───────────────────────────────────
  static async remove(req, res) {
    try {
      await Coupon.delete(req.params.id);
      res.json({ message: 'Coupon deleted' });
    } catch (err) {
      console.error('CouponController.remove:', err);
      res.status(500).json({ error: 'Failed to delete coupon' });
    }
  }

  // ── ADMIN: Get coupon claims ───────────────────────────────
  static async getClaims(req, res) {
    try {
      const claims = await Coupon.getClaims(req.params.id);
      res.json(claims);
    } catch (err) {
      console.error('CouponController.getClaims:', err);
      res.status(500).json({ error: 'Failed to load claims' });
    }
  }

  // ── CUSTOMER: List available coupons ───────────────────────
  static async getAvailable(req, res) {
    try {
      const coupons = await Coupon.getAvailable();
      res.json(coupons);
    } catch (err) {
      console.error('CouponController.getAvailable:', err);
      res.status(500).json({ error: 'Failed to load coupons' });
    }
  }

  // ── CUSTOMER: Get my claimed coupons ───────────────────────
  static async getMine(req, res) {
    try {
      const coupons = await Coupon.getUserCoupons(req.user.id);
      res.json(coupons);
    } catch (err) {
      console.error('CouponController.getMine:', err);
      res.status(500).json({ error: 'Failed to load your coupons' });
    }
  }

  // ── CUSTOMER: Claim a coupon ───────────────────────────────
  static async claim(req, res) {
    try {
      const claim = await Coupon.claimCoupon(req.params.id, req.user.id);
      res.status(201).json(claim);
    } catch (err) {
      console.error('CouponController.claim:', err);
      res.status(400).json({ error: err.message || 'Failed to claim coupon' });
    }
  }

  // ── CUSTOMER: Validate coupon at checkout ──────────────────
  static async validate(req, res) {
    try {
      const { code, cartTotal, categoryIds } = req.body;
      if (!code) return res.status(400).json({ error: 'Coupon code required' });
      const result = await Coupon.validateCoupon(code, req.user.id, cartTotal || 0, categoryIds || []);
      res.json(result);
    } catch (err) {
      console.error('CouponController.validate:', err);
      res.status(500).json({ error: 'Failed to validate coupon' });
    }
  }
}

module.exports = CouponController;
