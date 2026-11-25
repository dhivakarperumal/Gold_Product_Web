const jwt = require('jsonwebtoken');
const { getUserByUserId } = require('../modules/authModule');
const { getAccountPlanForOwner } = require('../modules/shopSubscriptionModule');

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
    if (user.role === 'admin') {
      const accountPlan = await getAccountPlanForOwner(user.user_id);
      if (['expired', 'pending'].includes(accountPlan?.account_plan_type)) {
        return res.status(403).json({
          code: accountPlan.account_plan_type === 'expired' ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
          message: accountPlan.account_plan_type === 'expired'
            ? 'Your free trial has ended. Subscribe to continue using this shop account.'
            : 'A paid subscription is required to use this shop account.'
        });
      }
    }

    req.adminUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireAdmin;
