const db = require('../config/db');

class Quest {

  // ─── Get all quests (admin) ────────────────────────────────
  static async findAll() {
    const result = await db.query(`
      SELECT q.*,
        c.coupon_code AS reward_coupon_code,
        c.discount_type AS reward_discount_type,
        c.discount_value AS reward_discount_value,
        (SELECT COUNT(*) FROM quest_progress qp WHERE qp.quest_id = q.quest_id AND qp.completed = true) AS completions
      FROM quests q
      LEFT JOIN coupons c ON c.coupon_id = q.reward_coupon_id
      ORDER BY q.created_at DESC
    `);
    return result.rows;
  }

  // ─── Get single quest ──────────────────────────────────────
  static async findById(questId) {
    const result = await db.query(
      `SELECT q.*, c.coupon_code AS reward_coupon_code
       FROM quests q
       LEFT JOIN coupons c ON c.coupon_id = q.reward_coupon_id
       WHERE q.quest_id = $1`,
      [questId]
    );
    return result.rows[0] || null;
  }

  // ─── Create quest ──────────────────────────────────────────
  static async create({ questName, description, questType, targetValue, rewardType, rewardCouponId, startsAt, expiresAt }) {
    const result = await db.query(
      `INSERT INTO quests
        (quest_name, description, quest_type, target_value, reward_type, reward_coupon_id, starts_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        questName, description || null,
        questType, targetValue || 1,
        rewardType || 'coupon', rewardCouponId || null,
        startsAt || new Date(), expiresAt || null
      ]
    );
    return result.rows[0];
  }

  // ─── Update quest ──────────────────────────────────────────
  static async update(questId, fields) {
    const {
      questName, description, questType, targetValue,
      rewardType, rewardCouponId, isActive, startsAt, expiresAt
    } = fields;

    const result = await db.query(
      `UPDATE quests SET
         quest_name       = COALESCE($1, quest_name),
         description      = COALESCE($2, description),
         quest_type       = COALESCE($3, quest_type),
         target_value     = COALESCE($4, target_value),
         reward_type      = COALESCE($5, reward_type),
         reward_coupon_id = $6,
         is_active        = COALESCE($7, is_active),
         starts_at        = COALESCE($8, starts_at),
         expires_at       = $9
       WHERE quest_id = $10
       RETURNING *`,
      [
        questName, description, questType, targetValue,
        rewardType, rewardCouponId || null, isActive,
        startsAt, expiresAt || null,
        questId
      ]
    );
    return result.rows[0];
  }

  // ─── Delete quest ──────────────────────────────────────────
  static async delete(questId) {
    await db.query(`DELETE FROM quests WHERE quest_id = $1`, [questId]);
  }

  // ─── Get progress for all users on a quest (admin) ─────────
  static async getProgress(questId) {
    const result = await db.query(
      `SELECT qp.*, u.first_name, u.last_name, u.email
       FROM quest_progress qp
       JOIN users u ON u.user_id = qp.user_id
       WHERE qp.quest_id = $1
       ORDER BY qp.completed DESC, qp.current_value DESC`,
      [questId]
    );
    return result.rows;
  }

  // ─── Get active quests for customer ────────────────────────
  static async getActiveQuests() {
    const result = await db.query(
      `SELECT q.*,
        c.coupon_code AS reward_coupon_code,
        c.discount_type AS reward_discount_type,
        c.discount_value AS reward_discount_value
       FROM quests q
       LEFT JOIN coupons c ON c.coupon_id = q.reward_coupon_id
       WHERE q.is_active = true
         AND (q.expires_at IS NULL OR q.expires_at > NOW())
         AND (q.starts_at IS NULL OR q.starts_at <= NOW())
       ORDER BY q.created_at DESC`
    );
    return result.rows;
  }

  // ─── Get user's quest progress ─────────────────────────────
  static async getUserProgress(userId) {
    const result = await db.query(
      `SELECT qp.*, q.quest_name, q.description, q.quest_type, q.target_value,
              q.reward_type, q.reward_coupon_id, q.is_active, q.expires_at,
              c.coupon_code AS reward_coupon_code,
              c.discount_type AS reward_discount_type,
              c.discount_value AS reward_discount_value
       FROM quest_progress qp
       JOIN quests q ON q.quest_id = qp.quest_id
       LEFT JOIN coupons c ON c.coupon_id = q.reward_coupon_id
       WHERE qp.user_id = $1
       ORDER BY qp.completed ASC, q.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  // ─── Calculate current progress for a user on a quest type ─
  static async calculateProgress(userId, questType) {
    let value = 0;

    switch (questType) {
      case 'review_count': {
        const r = await db.query(
          `SELECT COUNT(*) FROM reviews WHERE user_id = $1 AND status = 'approved'`,
          [userId]
        );
        value = parseInt(r.rows[0].count);
        break;
      }
      case 'purchase_count': {
        const r = await db.query(
          `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND order_status NOT IN ('cancelled')`,
          [userId]
        );
        value = parseInt(r.rows[0].count);
        break;
      }
      case 'wishlist_count': {
        const r = await db.query(
          `SELECT COUNT(*) FROM wishlist WHERE user_id = $1`,
          [userId]
        );
        value = parseInt(r.rows[0].count);
        break;
      }
      case 'order_items_count': {
        // Max items in a single order
        const r = await db.query(
          `SELECT COALESCE(MAX(item_count), 0) AS max_items FROM (
             SELECT order_id, SUM(quantity) AS item_count
             FROM order_items
             WHERE order_id IN (SELECT order_id FROM orders WHERE user_id = $1 AND order_status NOT IN ('cancelled'))
             GROUP BY order_id
           ) sub`,
          [userId]
        );
        value = parseInt(r.rows[0].max_items);
        break;
      }
      case 'spend_amount': {
        const r = await db.query(
          `SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders
           WHERE user_id = $1 AND order_status NOT IN ('cancelled')`,
          [userId]
        );
        value = Math.floor(parseFloat(r.rows[0].total));
        break;
      }
      default:
        value = 0;
    }

    return value;
  }

  // ─── Refresh progress for a user across all active quests ──
  static async refreshUserProgress(userId) {
    const quests = await this.getActiveQuests();
    const results = [];

    for (const quest of quests) {
      const currentValue = await this.calculateProgress(userId, quest.quest_type);
      const completed = currentValue >= quest.target_value;

      // Upsert progress
      const result = await db.query(
        `INSERT INTO quest_progress (quest_id, user_id, current_value, completed, completed_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (quest_id, user_id)
         DO UPDATE SET
           current_value = $3,
           completed = CASE WHEN quest_progress.completed = true THEN true ELSE $4 END,
           completed_at = CASE WHEN quest_progress.completed = true THEN quest_progress.completed_at ELSE $5 END
         RETURNING *`,
        [quest.quest_id, userId, currentValue, completed, completed ? new Date() : null]
      );
      results.push({ ...result.rows[0], quest });
    }

    return results;
  }

  // ─── Claim reward for completed quest ──────────────────────
  static async claimReward(questId, userId) {
    // Check quest progress
    const progress = await db.query(
      `SELECT * FROM quest_progress WHERE quest_id = $1 AND user_id = $2`,
      [questId, userId]
    );
    if (!progress.rows[0]) throw new Error('Quest progress not found');
    if (!progress.rows[0].completed) throw new Error('Quest not completed yet');
    if (progress.rows[0].reward_claimed) throw new Error('Reward already claimed');

    // Get quest details
    const quest = await this.findById(questId);
    if (!quest) throw new Error('Quest not found');

    // If reward is a coupon, auto-claim it
    if (quest.reward_type === 'coupon' && quest.reward_coupon_id) {
      const Coupon = require('./Coupon');
      try {
        await Coupon.claimCoupon(quest.reward_coupon_id, userId);
      } catch (e) {
        // If already claimed, that's ok
        if (!e.message.includes('already claimed')) throw e;
      }
    }

    // Mark reward as claimed
    await db.query(
      `UPDATE quest_progress SET reward_claimed = true WHERE quest_id = $1 AND user_id = $2`,
      [questId, userId]
    );

    return { message: 'Reward claimed!' };
  }
}

module.exports = Quest;
