const db = require('../config/db');

class User {

  // Find user by email (used during login)
  static async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  // Find user by ID (used to verify JWT token)
  static async findById(userId) {
    const result = await db.query(
      'SELECT user_id, first_name, last_name, email, role, phone_number FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  // Create new user (used during register)
  static async create({ firstName, lastName, email, hashedPw, phoneNumber }) {
    const result = await db.query(
      `INSERT INTO users (first_name, last_name, email, hashed_pw, phone_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, first_name, last_name, email, role, created_at`,
      [firstName, lastName, email, hashedPw, phoneNumber || null]
    );
    return result.rows[0];
  }

  // Update last login timestamp
  static async updateLastLogin(userId) {
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [userId]
    );
  }

}

module.exports = User;