const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const {
  register,
  verifyEmail,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const router = express.Router();

// Slow down brute-force attempts on login/forgot-password specifically
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', register);
router.post('/login', authLimiter, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/verify-email', protect, verifyEmail);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;
