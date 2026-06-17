const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

const SALT_ROUNDS = 12;

class AuthService {

  // Hash a plain password before saving to DB
  static async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  // Compare plain password against stored hash (returns true/false)
  static async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Generate JWT token for a user
  static generateUserToken(user) {
    return jwt.sign(
      {
        id:   user.user_id,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN || '7d' }
    );
  }

  // Generate JWT token for an admin
  static generateAdminToken(admin) {
    return jwt.sign(
      {
        id:        admin.admin_id,
        role:      'admin',
        adminRole: admin.admin_role   // 'superadmin' or 'staff'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN || '7d' }
    );
  }

  // Verify a JWT token (returns decoded payload or throws)
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

}

module.exports = AuthService;