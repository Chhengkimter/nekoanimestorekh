const User        = require('../models/User');
const Admin       = require('../models/Admin');
const AuthService = require('../services/AuthService');

class AuthController {

  // ─── POST /api/auth/register ────────────────────────────────
  static async register(req, res) {
    try {
      const { firstName, lastName, email, password, phoneNumber } = req.body;

      // 1. Validate required fields
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // 2. Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // 3. Validate password length
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // 4. Check if email already exists
      const existing = await User.findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // 5. Hash password
      const hashedPw = await AuthService.hashPassword(password);

      // 6. Save user to DB
      const newUser = await User.create({ firstName, lastName, email, hashedPw, phoneNumber });

      // 7. Generate token
      const token = AuthService.generateUserToken(newUser);

      res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id:        newUser.user_id,
          firstName: newUser.first_name,
          lastName:  newUser.last_name,
          email:     newUser.email,
          role:      newUser.role
        }
      });

    } catch (err) {
      console.error('Register error:', err.message);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }


  // ─── POST /api/auth/login ───────────────────────────────────
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // 1. Validate fields
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // 2. Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // 3. Check password
      const match = await AuthService.comparePassword(password, user.hashed_pw);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // 4. Update last login
      await User.updateLastLogin(user.user_id);

      // 5. Generate token
      const token = AuthService.generateUserToken(user);

      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id:        user.user_id,
          firstName: user.first_name,
          lastName:  user.last_name,
          email:     user.email,
          role:      user.role
        }
      });

    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ error: 'Server error during login' });
    }
  }


  // ─── POST /api/auth/admin/login ─────────────────────────────
  static async adminLogin(req, res) {
    try {
      const { email, password } = req.body;

      // 1. Validate fields
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // 2. Find admin
      const admin = await Admin.findByEmail(email);
      if (!admin) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // 3. Check password
      const match = await AuthService.comparePassword(password, admin.hashed_pw);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // 4. Update last login
      await Admin.updateLastLogin(admin.admin_id);

      // 5. Generate token
      const token = AuthService.generateAdminToken(admin);

      res.status(200).json({
        message: 'Admin login successful',
        token,
        admin: {
          id:        admin.admin_id,
          firstName: admin.first_name,
          lastName:  admin.last_name,
          email:     admin.email,
          adminRole: admin.admin_role
        }
      });

    } catch (err) {
      console.error('Admin login error:', err.message);
      res.status(500).json({ error: 'Server error during login' });
    }
  }

}

module.exports = AuthController;