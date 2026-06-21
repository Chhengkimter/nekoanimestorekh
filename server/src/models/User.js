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
      `SELECT user_id, first_name, last_name, email, role, phone_number, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  // ─── Create new user (register) ──────────────────────────────
  static async create({ firstName, lastName, email, hashedPw, phoneNumber }) {
    const result = await db.query(
      `INSERT INTO users (first_name, last_name, email, hashed_pw, phone_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, first_name, last_name, email, role, created_at`,
      [firstName, lastName, email, hashedPw, phoneNumber || null]
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
    const result = excludeUserId
      ? await db.query(
          'SELECT 1 FROM users WHERE email = $1 AND user_id != $2',
          [email, excludeUserId]
        )
      : await db.query(
          'SELECT 1 FROM users WHERE email = $1',
          [email]
        );
    return result.rows.length > 0;
  }

}

module.exports = User;