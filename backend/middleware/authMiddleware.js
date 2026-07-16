const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const User = require('../models/User');

/**
 * Protects routes: reads the JWT from the httpOnly cookie (falls back to
 * Authorization: Bearer header for API clients), verifies it, and attaches
 * the user document to req.user.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.eduknight_token;

  if (!token && req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }
});

/**
 * Restricts a route to specific roles, e.g. adminOnly = restrictTo('admin')
 * Used later by the Admin Panel module.
 */
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to do this.' });
  }
  next();
};

module.exports = { protect, restrictTo };