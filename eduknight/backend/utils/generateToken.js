const jwt = require('jsonwebtoken');

/**
 * Signs a JWT for a given user id and sets it as an httpOnly cookie
 * on the response. httpOnly + sameSite keeps the token out of reach
 * of client-side JS (mitigates XSS token theft).
 */
const generateTokenAndSetCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  const cookieDays = Number(process.env.JWT_COOKIE_EXPIRES_DAYS || 7);

  res.cookie('eduknight_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieDays * 24 * 60 * 60 * 1000,
  });

  return token;
};

module.exports = generateTokenAndSetCookie;
