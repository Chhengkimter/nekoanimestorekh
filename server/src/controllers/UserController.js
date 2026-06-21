const bcrypt = require('bcrypt');
const User   = require('../models/User');

class UserController {

  // ─── GET /api/users/me ────────────────────────────────────────
  // Returns the logged-in user's profile
  static async getMe(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err) {
      console.error('getMe error:', err.message);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  }


  // ─── PUT /api/users/me ────────────────────────────────────────
  // Update email OR phone number (one field at a time).
  // Updating email requires currentPassword for safety.
  static async updateMe(req, res) {
    try {
      const userId = req.user.id;
      const { email, phoneNumber, currentPassword } = req.body;

      // ── Update email ──────────────────────────────────────────
      if (email !== undefined) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to change email' });
        }

        // Verify password
        const hashedPw = await User.getHashedPw(userId);
        const valid = await bcrypt.compare(currentPassword, hashedPw);
        if (!valid) {
          return res.status(401).json({ error: 'Incorrect password' });
        }

        // Check email not already taken
        const taken = await User.emailExists(email.trim().toLowerCase(), userId);
        if (taken) {
          return res.status(409).json({ error: 'That email is already in use' });
        }

        const updated = await User.updateEmail(userId, email.trim().toLowerCase());
        return res.json({ message: 'Email updated', user: updated });
      }

      // ── Update phone ──────────────────────────────────────────
      if (phoneNumber !== undefined) {
        const updated = await User.updatePhone(userId, phoneNumber.trim() || null);
        return res.json({ message: 'Phone number updated', user: updated });
      }

      return res.status(400).json({ error: 'Nothing to update. Send email or phoneNumber.' });

    } catch (err) {
      console.error('updateMe error:', err.message);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }


  // ─── POST /api/auth/change-password ──────────────────────────
  // Change password using old password verification
  static async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'oldPassword and newPassword are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }

      // Verify old password
      const hashedPw = await User.getHashedPw(userId);
      const valid = await bcrypt.compare(oldPassword, hashedPw);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash and save new password
      const newHashed = await bcrypt.hash(newPassword, 12);
      await User.updatePassword(userId, newHashed);

      res.json({ message: 'Password changed successfully' });

    } catch (err) {
      console.error('changePassword error:', err.message);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }


  // ─── PATCH /api/orders/:id/address ───────────────────────────
  // Let a customer update address/phone on their own unshipped order.
  // Must be called with the customer auth middleware (not admin).
  static async updateOrderAddress(req, res) {
    try {
      const db      = require('../config/db');
      const userId  = req.user.id;
      const orderId = req.params.id;

      // 1. Confirm order belongs to this user and is still editable
      const check = await db.query(
        `SELECT order_id, order_status FROM orders
         WHERE order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      if (!check.rows[0]) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const { order_status } = check.rows[0];
      const locked = ['shipped', 'delivered', 'cancelled', 'refunded'];
      if (locked.includes(order_status)) {
        return res.status(400).json({
          error: `Order is already ${order_status} and cannot be edited`
        });
      }

      // 2. Build update from allowed fields only
      const { phone1, addrLine1, addrDistrict, addrCity, addrLandmark } = req.body;

      const result = await db.query(
        `UPDATE orders SET
           phone1        = COALESCE($1, phone1),
           addr_line1    = COALESCE($2, addr_line1),
           addr_district = COALESCE($3, addr_district),
           addr_city     = COALESCE($4, addr_city),
           addr_landmark = COALESCE($5, addr_landmark)
         WHERE order_id = $6
         RETURNING order_id, order_code, phone1, addr_line1, addr_district, addr_city, addr_landmark`,
        [
          phone1       || null,
          addrLine1    || null,
          addrDistrict || null,
          addrCity     || null,
          addrLandmark || null,
          orderId
        ]
      );

      res.json({ message: 'Delivery info updated', order: result.rows[0] });

    } catch (err) {
      console.error('updateOrderAddress error:', err.message);
      res.status(500).json({ error: 'Failed to update order' });
    }
  }

}

module.exports = UserController;