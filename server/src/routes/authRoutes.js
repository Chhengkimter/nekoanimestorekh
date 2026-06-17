const express        = require('express');
const router         = express.Router();
const AuthController = require('../controllers/AuthController');

// Customer routes
router.post('/register',     AuthController.register);
router.post('/login',        AuthController.login);

// Admin route
router.post('/admin/login',  AuthController.adminLogin);

module.exports = router;