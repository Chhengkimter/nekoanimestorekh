const db = require('../config/db');

class Coupon {

  // ─── Get all coupons (admin) ────────────────────────────────
  static async findAll() {
    const result = await db.query(`
      SELECT c.*,
        COALESCE(
          (SELECT string_agg(cat.category_name, ', ')
           FROM coupon_categories cc
           JOIN categories cat ON cat.category_id = cc.category_id
           WHERE cc.coupon_id = c.coupon_id), 'All categories'
        ) AS applicable_categories,
        COALESCE(
          (SELECT json_agg(cc.category_id)
           FROM coupon_categories cc
           WHERE cc.coupon_id = c.coupon_id), '[]'
        ) AS category_ids
      FROM coupons c
      ORDER BY c.created_at DESC
    `);
    return result.rows;
  }

  // ─── Get single coupon by ID ───────────────────────────────
  static async findById(couponId) {
    const result = await db.query(
      `SELECT * FROM coupons WHERE coupon_id = $1`,
      [couponId]
    );
    if (!result.rows[0]) return null;
    const coupon = result.rows[0];

    const cats = await db.query(
      `SELECT cc.category_id, cat.category_name
       FROM coupon_categories cc
       JOIN categories cat ON cat.category_id = cc.category_id
       WHERE cc.coupon_id = $1`,
      [couponId]
    );
    coupon.categories = cats.rows;
    return coupon;
  }

  // ─── Find by coupon code ───────────────────────────────────
  static async findByCode(code) {
    const result = await db.query(
      `SELECT * FROM coupons WHERE coupon_code = $1`,
      [code.toUpperCase()]
    );
    return result.rows[0] || null;
  }

  // ─── Create coupon ─────────────────────────────────────────
  static async create({
    couponCode, description, discountType, discountValue,
    minSpent, maxDiscount, maxUsesTotal, maxUsesPerUser,
    startsAt, expiresAt, categoryIds
  }) {
    const result = await db.query(
      `INSERT INTO coupons
        (coupon_code, description, discount_type, discount_value,
         min_spent, max_discount, max_uses_total, max_uses_per_user,
         starts_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        couponCode.toUpperCase(), description || null,
        discountType || 'percent', discountValue,
        minSpent || 0, maxDiscount || null,
        maxUsesTotal || null, maxUsesPerUser || 1,
        startsAt || new Date(), expiresAt || null
      ]
    );
    const coupon = result.rows[0];

    // Set category restrictions
    if (categoryIds && categoryIds.length > 0) {
      for (const catId of categoryIds) {
        await db.query(
          `INSERT INTO coupon_categories (coupon_id, category_id) VALUES ($1, $2)`,
          [coupon.coupon_id, catId]
        );
      }
    }

    return coupon;
  }

  // ─── Update coupon ─────────────────────────────────────────
  static async update(couponId, fields) {
    const {
      couponCode, description, discountType, discountValue,
      minSpent, maxDiscount, maxUsesTotal, maxUsesPerUser,
      startsAt, expiresAt, isActive, categoryIds
    } = fields;

    const result = await db.query(
      `UPDATE coupons SET
         coupon_code      = COALESCE($1, coupon_code),
         description      = COALESCE($2, description),
         discount_type    = COALESCE($3, discount_type),
         discount_value   = COALESCE($4, discount_value),
         min_spent        = COALESCE($5, min_spent),
         max_discount     = $6,
         max_uses_total   = $7,
         max_uses_per_user = COALESCE($8, max_uses_per_user),
         starts_at        = COALESCE($9, starts_at),
         expires_at       = $10,
         is_active        = COALESCE($11, is_active)
       WHERE coupon_id = $12
       RETURNING *`,
      [
        couponCode ? couponCode.toUpperCase() : null,
        description, discountType, discountValue,
        minSpent, maxDiscount, maxUsesTotal, maxUsesPerUser,
        startsAt, expiresAt, isActive,
        couponId
      ]
    );

    // Update category restrictions
    if (categoryIds !== undefined) {
      await db.query(`DELETE FROM coupon_categories WHERE coupon_id = $1`, [couponId]);
      if (categoryIds && categoryIds.length > 0) {
        for (const catId of categoryIds) {
          await db.query(
            `INSERT INTO coupon_categories (coupon_id, category_id) VALUES ($1, $2)`,
            [couponId, catId]
          );
        }
      }
    }

    return result.rows[0];
  }

  // ─── Delete coupon ─────────────────────────────────────────
  static async delete(couponId) {
    await db.query(`DELETE FROM coupons WHERE coupon_id = $1`, [couponId]);
  }

  // ─── Get claims for a coupon (admin) ───────────────────────
  static async getClaims(couponId) {
    const result = await db.query(
      `SELECT cl.*,
              u.first_name, u.last_name, u.email,
              o.order_code
       FROM coupon_claims cl
       LEFT JOIN users u ON u.user_id = cl.user_id
       LEFT JOIN orders o ON o.order_id = cl.order_id
       WHERE cl.coupon_id = $1
       ORDER BY cl.claimed_at DESC`,
      [couponId]
    );
    return result.rows;
  }

  // ─── Claim a coupon (customer) ─────────────────────────────
  static async claimCoupon(couponId, userId) {
    // Check if already claimed max times
    const existing = await db.query(
      `SELECT COUNT(*) FROM coupon_claims WHERE coupon_id = $1 AND user_id = $2`,
      [couponId, userId]
    );
    const coupon = await db.query(`SELECT * FROM coupons WHERE coupon_id = $1`, [couponId]);
    if (!coupon.rows[0]) throw new Error('Coupon not found');

    const c = coupon.rows[0];
    const claimCount = parseInt(existing.rows[0].count);

    if (claimCount >= c.max_uses_per_user) throw new Error('You have already claimed this coupon the maximum number of times');
    if (c.max_uses_total && c.times_used >= c.max_uses_total) throw new Error('This coupon has reached its usage limit');
    if (!c.is_active) throw new Error('This coupon is no longer active');
    if (c.expires_at && new Date(c.expires_at) < new Date()) throw new Error('This coupon has expired');
    if (c.starts_at && new Date(c.starts_at) > new Date()) throw new Error('This coupon is not yet available');

    const result = await db.query(
      `INSERT INTO coupon_claims (coupon_id, user_id)
       VALUES ($1, $2) RETURNING *`,
      [couponId, userId]
    );
    return result.rows[0];
  }

  // ─── Use a coupon (mark as used when order is placed) ──────
  static async useCoupon(claimId, orderId, orderTotal, savedAmount) {
    const result = await db.query(
      `UPDATE coupon_claims SET
         used_at = NOW(),
         order_id = $2,
         order_total = $3,
         saved_amount = $4
       WHERE claim_id = $1 RETURNING *`,
      [claimId, orderId, orderTotal, savedAmount]
    );

    // Increment times_used on the coupon
    if (result.rows[0]) {
      await db.query(
        `UPDATE coupons SET times_used = times_used + 1 WHERE coupon_id = $1`,
        [result.rows[0].coupon_id]
      );
    }

    return result.rows[0];
  }

  // ─── Get user's claimed coupons ────────────────────────────
  static async getUserCoupons(userId) {
    const result = await db.query(
      `SELECT cl.*, c.coupon_code, c.description, c.discount_type,
              c.discount_value, c.min_spent, c.max_discount, c.expires_at,
              c.is_active,
              COALESCE(
                (SELECT string_agg(cat.category_name, ', ')
                 FROM coupon_categories cc
                 JOIN categories cat ON cat.category_id = cc.category_id
                 WHERE cc.coupon_id = c.coupon_id), 'All categories'
              ) AS applicable_categories
       FROM coupon_claims cl
       JOIN coupons c ON c.coupon_id = cl.coupon_id
       WHERE cl.user_id = $1
       ORDER BY cl.claimed_at DESC`,
      [userId]
    );
    return result.rows;
  }

  // ─── Get available coupons (customer listing) ──────────────
  static async getAvailable() {
    const result = await db.query(
      `SELECT c.*,
        COALESCE(
          (SELECT string_agg(cat.category_name, ', ')
           FROM coupon_categories cc
           JOIN categories cat ON cat.category_id = cc.category_id
           WHERE cc.coupon_id = c.coupon_id), 'All categories'
        ) AS applicable_categories
       FROM coupons c
       WHERE c.is_active = true
         AND (c.expires_at IS NULL OR c.expires_at > NOW())
         AND (c.starts_at IS NULL OR c.starts_at <= NOW())
         AND (c.max_uses_total IS NULL OR c.times_used < c.max_uses_total)
       ORDER BY c.created_at DESC`
    );
    return result.rows;
  }

  // ─── Validate coupon at checkout ───────────────────────────
  static async validateCoupon(code, userId, cartTotal, categoryIds) {
    const coupon = await this.findByCode(code);
    if (!coupon) return { valid: false, error: 'Coupon not found' };
    if (!coupon.is_active) return { valid: false, error: 'Coupon is inactive' };
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
      return { valid: false, error: 'Coupon has expired' };
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date())
      return { valid: false, error: 'Coupon is not yet available' };
    if (coupon.max_uses_total && coupon.times_used >= coupon.max_uses_total)
      return { valid: false, error: 'Coupon usage limit reached' };
    if (cartTotal < coupon.min_spent)
      return { valid: false, error: `Minimum spend of $${coupon.min_spent} required` };

    // Check per-user limit — count unused claims
    const userClaims = await db.query(
      `SELECT COUNT(*) FROM coupon_claims
       WHERE coupon_id = $1 AND user_id = $2 AND used_at IS NOT NULL`,
      [coupon.coupon_id, userId]
    );
    if (parseInt(userClaims.rows[0].count) >= coupon.max_uses_per_user)
      return { valid: false, error: 'You have already used this coupon the maximum number of times' };

    // Check category restrictions
    const catRestrictions = await db.query(
      `SELECT category_id FROM coupon_categories WHERE coupon_id = $1`,
      [coupon.coupon_id]
    );
    if (catRestrictions.rows.length > 0 && categoryIds && categoryIds.length > 0) {
      const allowedCats = catRestrictions.rows.map(r => r.category_id);
      const hasValidCat = categoryIds.some(id => allowedCats.includes(id));
      if (!hasValidCat)
        return { valid: false, error: 'This coupon cannot be used with the items in your cart' };
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === 'percent') {
      discount = cartTotal * (coupon.discount_value / 100);
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = parseFloat(coupon.max_discount);
      }
    } else {
      discount = parseFloat(coupon.discount_value);
    }

    return {
      valid: true,
      coupon,
      discount: Math.round(discount * 100) / 100
    };
  }
}

module.exports = Coupon;
