const express        = require('express');
const router         = express.Router();
const AuthController = require('../controllers/AuthController');
const UserController = require('../controllers/UserController');
const { requireAuth } = require('../middleware/auth');  // ← correct import

// Customer routes
router.post('/register',         AuthController.register);
router.post('/login',            AuthController.login);
router.get('/verify-email',          AuthController.verifyEmail);
router.post('/resend-verification',  AuthController.resendVerification);
router.post('/forgot-password',      AuthController.forgotPassword);
router.post('/reset-password',       AuthController.resetPassword);

router.post('/admin/login',      AuthController.adminLogin);
router.post('/change-password',  requireAuth, UserController.changePassword);

module.exports = router;