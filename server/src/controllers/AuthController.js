const crypto      = require('crypto');
const User        = require('../models/User');
const Admin       = require('../models/Admin');
const AuthService = require('../services/AuthService');
const EmailService = require('../services/EmailService');

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

      // 7. Generate token and set expiration
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await User.setVerificationToken(newUser.user_id, token, expires);

      // 8. Send verification email
      await EmailService.sendVerificationEmail(email, firstName, token);

      res.status(201).json({
        message: 'Account created! Please check your email to verify your account.'
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

      // Check email verified
      if (!user.email_verified) {
        return res.status(403).json({ error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED', email: user.email });
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

  // ─── GET /api/auth/verify-email ─────────────────────────────
  static async verifyEmail(req, res) {
    try {
      const { token } = req.query;
      const user = await User.findByVerificationToken(token);
      
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired verification link.', expired: true });
      }
      
      await User.verifyEmail(user.user_id);
      res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
    } catch (err) {
      console.error('Verify email error:', err.message);
      res.status(500).json({ error: 'Server error during email verification' });
    }
  }

  // ─── POST /api/auth/resend-verification ─────────────────────
  static async resendVerification(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findByEmail(email);
      
      if (!user || user.email_verified) {
        // Return success to avoid leaking registered emails
        return res.status(200).json({ message: 'If that email is registered, a new verification link has been sent.' });
      }
      
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await User.setVerificationToken(user.user_id, token, expires);
      
      await EmailService.sendVerificationEmail(email, user.first_name, token);
      
      res.status(200).json({ message: 'If that email is registered, a new verification link has been sent.' });
    } catch (err) {
      console.error('Resend verification error:', err.message);
      res.status(500).json({ error: 'Server error during resend verification' });
    }
  }

  // ─── POST /api/auth/forgot-password ─────────────────────────
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findByEmail(email);
      
      if (!user) {
        return res.status(200).json({ message: 'If that email is registered, a password reset link has been sent. The link expires in 20 minutes.' });
      }
      
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes
      
      await User.createResetToken(user.user_id, token, expires);
      await EmailService.sendPasswordResetEmail(email, user.first_name, token);
      
      res.status(200).json({ message: 'If that email is registered, a password reset link has been sent. The link expires in 20 minutes.' });
    } catch (err) {
      console.error('Forgot password error:', err.message);
      res.status(500).json({ error: 'Server error during forgot password' });
    }
  }

  // ─── POST /api/auth/reset-password ──────────────────────────
  static async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      
      const tokenRecord = await User.findValidResetToken(token);
      if (!tokenRecord) {
        return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
      }
      
      const hashedPw = await AuthService.hashPassword(newPassword);
      await User.updatePassword(tokenRecord.user_id, hashedPw);
      await User.markResetTokenUsed(tokenRecord.id);
      
      res.status(200).json({ message: 'Password reset successfully! You can now log in with your new password.' });
    } catch (err) {
      console.error('Reset password error:', err.message);
      res.status(500).json({ error: 'Server error during password reset' });
    }
  }

}

module.exports = AuthController;