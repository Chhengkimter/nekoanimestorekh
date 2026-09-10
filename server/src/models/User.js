const db = require('../config/db');

class User {

  // ─── Find user by email (login) ──────────────────────────────
  static async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  // ─── Find user by ID (JWT verify) ────────────────────────────
  static async findById(userId) {
    const result = await db.query(
      `SELECT user_id, first_name, last_name, email, pending_email, role, phone_number, email_verified, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  // ─── Create new user (register) ──────────────────────────────
  static async create({ firstName, lastName, email, hashedPw, phoneNumber, verificationToken, verificationExpires }) {
    const result = await db.query(
      `INSERT INTO users (first_name, last_name, email, hashed_pw, phone_number, verification_token, verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, first_name, last_name, email, role, created_at`,
      [firstName, lastName, email, hashedPw, phoneNumber || null, verificationToken || null, verificationExpires || null]
    );
    return result.rows[0];
  }

  // ─── Update last login timestamp ─────────────────────────────
  static async updateLastLogin(userId) {
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [userId]
    );
  }

  // ─── Update email (requires password check in controller) ────
  static async updateEmail(userId, newEmail) {
    const result = await db.query(
      `UPDATE users SET email = $1
       WHERE user_id = $2
       RETURNING user_id, first_name, last_name, email, phone_number`,
      [newEmail, userId]
    );
    return result.rows[0] || null;
  }

  // ─── Update phone number ─────────────────────────────────────
  static async updatePhone(userId, phoneNumber) {
    const result = await db.query(
      `UPDATE users SET phone_number = $1
       WHERE user_id = $2
       RETURNING user_id, first_name, last_name, email, phone_number`,
      [phoneNumber, userId]
    );
    return result.rows[0] || null;
  }

  // ─── Update hashed password ───────────────────────────────────
  static async updatePassword(userId, hashedPw) {
    await db.query(
      'UPDATE users SET hashed_pw = $1 WHERE user_id = $2',
      [hashedPw, userId]
    );
  }

  // ─── Get hashed_pw for password verification ─────────────────
  static async getHashedPw(userId) {
    const result = await db.query(
      'SELECT hashed_pw FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.hashed_pw || null;
  }

  // ─── Check if email already in use (by another user) ─────────
  static async emailExists(email, excludeUserId = null) {
    const cleanEmail = email.trim().toLowerCase();
    const result = excludeUserId
      ? await db.query(
          'SELECT 1 FROM users WHERE (LOWER(email) = $1 OR LOWER(pending_email) = $1) AND user_id != $2',
          [cleanEmail, excludeUserId]
        )
      : await db.query(
          'SELECT 1 FROM users WHERE LOWER(email) = $1 OR LOWER(pending_email) = $1',
          [cleanEmail]
        );
    return result.rows.length > 0;
  }

  // ─── Set pending email address (awaiting email verification) ──
  static async setPendingEmail(userId, pendingEmail, token, expires) {
    const result = await db.query(
      `UPDATE users
       SET pending_email = $1, verification_token = $2, verification_expires = $3
       WHERE user_id = $4
       RETURNING user_id, first_name, last_name, email, pending_email, phone_number, email_verified`,
      [pendingEmail, token, expires, userId]
    );
    return result.rows[0] || null;
  }

  // ─── Find user by verification token (valid and not expired) ─
  static async findByVerificationToken(token) {
    const result = await db.query(
      `SELECT * FROM users WHERE verification_token = $1 AND verification_expires > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  }

  // ─── Mark email as verified and clear token ──────────────────
  static async verifyEmail(userId) {
    const userRes = await db.query('SELECT pending_email FROM users WHERE user_id = $1', [userId]);
    const pending = userRes.rows[0]?.pending_email;
    if (pending) {
      await db.query(
        `UPDATE users
         SET email = pending_email, pending_email = NULL, email_verified = TRUE, verification_token = NULL, verification_expires = NULL
         WHERE user_id = $1`,
        [userId]
      );
    } else {
      await db.query(
        `UPDATE users
         SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL
         WHERE user_id = $1`,
        [userId]
      );
    }
  }

  // ─── Set verification token on user ──────────────────────────
  static async setVerificationToken(userId, token, expires) {
    await db.query(
      `UPDATE users SET verification_token = $1, verification_expires = $2 WHERE user_id = $3`,
      [token, expires, userId]
    );
  }

  // ─── Create password reset token ─────────────────────────────
  static async createResetToken(userId, token, expiresAt) {
    // Invalidate any existing tokens for this user
    await db.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
      [userId]
    );
    const result = await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *`,
      [userId, token, expiresAt]
    );
    return result.rows[0];
  }

  // ─── Find valid (unused, not expired) reset token ────────────
  static async findValidResetToken(token) {
    const result = await db.query(
      `SELECT prt.*, u.email, u.first_name FROM password_reset_tokens prt JOIN users u ON u.user_id = prt.user_id WHERE prt.token = $1 AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  }

  // ─── Mark reset token as used ────────────────────────────────
  static async markResetTokenUsed(tokenId) {
    await db.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
      [tokenId]
    );
  }

}

module.exports = User;