const jwt = require('jsonwebtoken');
const { getUserByUserId } = require('../modules/authModule');
const { getAccountPlanForOwner } = require('../modules/shopSubscriptionModule');

async function requireSubscriptionAccount(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  if (!token) return res.status(401).json({ message: 'Subscription account access is required' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return next(new Error('JWT_SECRET is required to verify subscription checkout access'));

  let claims;
  try {
    claims = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ message: 'Your subscription session is invalid or expired' });
  }
  if (claims.purpose !== 'subscription_checkout' && claims.role !== 'admin') {
    return res.status(403).json({ message: 'Shop admin access is required for subscription actions' });
  }

  try {
    const user = await getUserByUserId(claims.user_id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'A shop admin account is required' });
    }
    if (user.status !== 'Active') {
      const accountPlan = claims.purpose === 'subscription_checkout'
        ? await getAccountPlanForOwner(user.user_id)
        : null;
      if (user.status !== 'Inactive' || !['expired', 'pending'].includes(accountPlan?.account_plan_type)) {
        return res.status(403).json({ message: 'An active shop admin account is required' });
      }
    }
    req.subscriptionUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireSubscriptionAccount;
