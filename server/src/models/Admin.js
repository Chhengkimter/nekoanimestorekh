const db = require('../config/db');

class Admin {

  // Find admin by email (used during admin login)
  static async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM admins WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  // Find admin by ID (used to verify JWT token)
  static async findById(adminId) {
    const result = await db.query(
      'SELECT admin_id, first_name, last_name, email, admin_role FROM admins WHERE admin_id = $1',
      [adminId]
    );
    return result.rows[0] || null;
  }

  // Update last login timestamp
  static async updateLastLogin(adminId) {
    await db.query(
      'UPDATE admins SET last_login = NOW() WHERE admin_id = $1',
      [adminId]
    );
  }

}

module.exports = Admin;