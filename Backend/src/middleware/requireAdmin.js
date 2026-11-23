const jwt = require('jsonwebtoken');
const { getUserByUserId } = require('../modules/authModule');

async function requireAdmin(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) {
    return res.status(401).json({ message: 'Authentication is required' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new Error('JWT_SECRET is required to verify admin sessions'));
  }

  let claims;
  try {
    claims = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or expired' });
  }

  try {
    const user = await getUserByUserId(claims.user_id);
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ message: 'Your account is unavailable' });
    }
    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Administrator access is required' });
    }

    req.adminUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireAdmin;
