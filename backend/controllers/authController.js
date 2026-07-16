const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const generateTokenAndSetCookie = require('../utils/generateToken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

/**
 * Shape a user document into the safe, frontend-facing shape.
 * Never send password/token hashes back to the client.
 */
const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  targetExam: user.targetExam,
  role: user.role,
  xp: user.xp,
  coins: user.coins,
  level: user.level,
  rankTier: user.rankTier,
  streakCount: user.streakCount,
  isEmailVerified: user.isEmailVerified,
});

// @route  POST /api/auth/register
// @access Public
const register = asyncHandler(async (req, res) => {
  const { name, email, password, targetExam } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  const user = await User.create({ name, email, password, targetExam });

  const code = user.generateEmailVerificationCode();
  await user.save({ validateBeforeSave: false });
  await sendVerificationEmail(user, code);

  generateTokenAndSetCookie(res, user._id);

  res.status(201).json({
    success: true,
    message: 'Account created. Check your email for a verification code.',
    user: toPublicUser(user),
  });
});

// @route  POST /api/auth/verify-email
// @access Private (must be logged in)
const verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const user = await User.findById(req.user.id).select('+emailVerificationCode +emailVerificationExpires');

  if (!user.emailVerificationCode || user.emailVerificationCode !== code) {
    return res.status(400).json({ success: false, message: 'Invalid verification code.' });
  }
  if (user.emailVerificationExpires < Date.now()) {
    return res.status(400).json({ success: false, message: 'This code has expired. Request a new one.' });
  }

  user.isEmailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Email verified.', user: toPublicUser(user) });
});

// @route  POST /api/auth/login
// @access Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
  }

  generateTokenAndSetCookie(res, user._id);

  res.json({ success: true, message: 'Logged in successfully.', user: toPublicUser(user) });
});

// @route  POST /api/auth/logout
// @access Private
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('eduknight_token');
  res.json({ success: true, message: 'Logged out.' });
});

// @route  GET /api/auth/me
// @access Private
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: toPublicUser(req.user) });
});

// @route  POST /api/auth/forgot-password
// @access Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });

  // Always respond with success — never reveal whether an email exists
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  const rawToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password.html?token=${rawToken}`;
  await sendPasswordResetEmail(user, resetUrl);

  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});

// @route  POST /api/auth/reset-password/:token
// @access Public
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  generateTokenAndSetCookie(res, user._id);

  res.json({ success: true, message: 'Password reset successfully.' });
});

module.exports = { register, verifyEmail, login, logout, getMe, forgotPassword, resetPassword };