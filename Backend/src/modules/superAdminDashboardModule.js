const { pool } = require('../config/db');

function percentageChange(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (previousValue === 0) return currentValue === 0 ? 0 : 100;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

function buildMonthBuckets(currentMonth) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(currentMonth || ''));
  if (!match) throw new Error('Database returned an invalid current month');

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Database returned an invalid current month');

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - 11 + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: date.toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC'
      })
    };
  });
}

async function getDashboardStats() {
  const [shopRows, userRows, subscriptionRows, revenueRows] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*) AS total_shops,
        COUNT(CASE WHEN status = 'active' AND approval_status = 'approved' THEN 1 END) AS active_shops,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) AS pending_shops,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) AS rejected_shops,
        COUNT(CASE WHEN created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
          AND created_at < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) THEN 1 END) AS current_month_shops,
        COUNT(CASE WHEN created_at >= DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), '%Y-%m-01')
          AND created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 END) AS previous_month_shops
      FROM gold_shops
      WHERE deleted_at IS NULL
    `),
    pool.execute(`
      SELECT
        COUNT(*) AS total_users,
        COUNT(CASE WHEN created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
          AND created_at < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) THEN 1 END) AS current_month_users,
        COUNT(CASE WHEN created_at >= DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), '%Y-%m-01')
          AND created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 END) AS previous_month_users
      FROM users
      WHERE role <> 'superadmin'
    `),
    pool.execute(`
      SELECT
        COUNT(CASE WHEN subscription_status = 'active' AND payment_status = 'paid'
          AND end_date > CURRENT_DATE() THEN 1 END) AS active_subscriptions,
        COUNT(CASE WHEN subscription_status = 'expired' OR end_date <= CURRENT_DATE() THEN 1 END) AS expired_subscriptions,
        COUNT(CASE WHEN s.created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
          AND s.created_at < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) THEN 1 END) AS current_month_subscriptions,
        COUNT(CASE WHEN s.created_at >= DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), '%Y-%m-01')
          AND s.created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 END) AS previous_month_subscriptions
      FROM subscriptions s
      JOIN gold_shops gs ON gs.id = s.gold_shop_id AND gs.deleted_at IS NULL
    `),
    pool.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN p.payment_status = 'paid'
          THEN GREATEST(p.amount - COALESCE(p.refund_amount, 0), 0) ELSE 0 END), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN p.payment_status = 'paid'
          AND COALESCE(p.payment_date, p.created_at) >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
          AND COALESCE(p.payment_date, p.created_at) < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
          THEN GREATEST(p.amount - COALESCE(p.refund_amount, 0), 0) ELSE 0 END), 0) AS current_month_revenue,
        COALESCE(SUM(CASE WHEN p.payment_status = 'paid'
          AND COALESCE(p.payment_date, p.created_at) >= DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), '%Y-%m-01')
          AND COALESCE(p.payment_date, p.created_at) < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
          THEN GREATEST(p.amount - COALESCE(p.refund_amount, 0), 0) ELSE 0 END), 0) AS previous_month_revenue
      FROM payments p
      JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
    `)
  ]);

  const shops = shopRows[0][0] || {};
  const users = userRows[0][0] || {};
  const subscriptions = subscriptionRows[0][0] || {};
  const revenue = revenueRows[0][0] || {};

  return {
    totalGoldShops: Number(shops.total_shops || 0),
    activeGoldShops: Number(shops.active_shops || 0),
    pendingGoldShops: Number(shops.pending_shops || 0),
    rejectedGoldShops: Number(shops.rejected_shops || 0),
    totalUsers: Number(users.total_users || 0),
    activeSubscriptions: Number(subscriptions.active_subscriptions || 0),
    expiredSubscriptions: Number(subscriptions.expired_subscriptions || 0),
    totalRevenue: Number(revenue.total_revenue || 0),
    changes: {
      totalGoldShops: percentageChange(shops.current_month_shops, shops.previous_month_shops),
      totalUsers: percentageChange(users.current_month_users, users.previous_month_users),
      activeSubscriptions: percentageChange(
        subscriptions.current_month_subscriptions,
        subscriptions.previous_month_subscriptions
      ),
      totalRevenue: percentageChange(revenue.current_month_revenue, revenue.previous_month_revenue)
    }
  };
}

async function getDashboardAnalytics() {
  const [monthRows] = await pool.execute(
    "SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m') AS current_month"
  );
  const months = buildMonthBuckets(monthRows[0]?.current_month);
  const firstMonthDate = `${months[0].key}-01`;
  const monthParams = [firstMonthDate, firstMonthDate];

  const [
    revenueRows,
    registrationRows,
    subscriptionGrowthRows,
    shopStatusRows,
    recentShopRows,
    recentPaymentRows
  ] = await Promise.all([
    pool.execute(`
      SELECT DATE_FORMAT(COALESCE(p.payment_date, p.created_at), '%Y-%m') AS month,
        SUM(GREATEST(p.amount - COALESCE(p.refund_amount, 0), 0)) AS revenue,
        COUNT(*) AS transactions
      FROM payments p
      JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
      WHERE p.payment_status = 'paid'
        AND COALESCE(p.payment_date, p.created_at) >= ?
        AND COALESCE(p.payment_date, p.created_at) < DATE_ADD(?, INTERVAL 12 MONTH)
      GROUP BY month
    `, monthParams),
    pool.execute(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS registrations
      FROM gold_shops
      WHERE deleted_at IS NULL AND created_at >= ?
        AND created_at < DATE_ADD(?, INTERVAL 12 MONTH)
      GROUP BY month
    `, monthParams),
    pool.execute(`
      SELECT DATE_FORMAT(s.created_at, '%Y-%m') AS month, COUNT(*) AS subscriptions
      FROM subscriptions s
      JOIN gold_shops gs ON gs.id = s.gold_shop_id AND gs.deleted_at IS NULL
      WHERE s.created_at >= ? AND s.created_at < DATE_ADD(?, INTERVAL 12 MONTH)
      GROUP BY month
    `, monthParams),
    pool.execute(`
      SELECT
        COUNT(CASE WHEN gs.status = 'active' AND gs.approval_status = 'approved'
          AND latest.subscription_status = 'active' AND latest.payment_status = 'paid'
          AND latest.end_date > CURRENT_DATE() THEN 1 END) AS active_shops,
        COUNT(CASE WHEN gs.approval_status = 'approved' AND latest.id IS NOT NULL
          AND (latest.subscription_status = 'expired' OR latest.end_date <= CURRENT_DATE()) THEN 1 END) AS expired_shops
      FROM gold_shops gs
      LEFT JOIN (
        SELECT s.*
        FROM subscriptions s
        JOIN (
          SELECT gold_shop_id, MAX(id) AS latest_id
          FROM subscriptions
          GROUP BY gold_shop_id
        ) newest ON newest.latest_id = s.id
      ) latest ON latest.gold_shop_id = gs.id
      WHERE gs.deleted_at IS NULL
    `),
    pool.execute(`
      SELECT gs.id, gs.shop_code, gs.shop_name, gs.owner_name,
        COALESCE(owner.email, gs.email) AS email,
        COALESCE(owner.phone, gs.mobile) AS mobile,
        gs.approval_status, gs.created_at, COALESCE(sp.plan_name, 'No plan') AS plan_name
      FROM gold_shops gs
      LEFT JOIN users owner ON owner.user_id = gs.owner_user_id
      LEFT JOIN (
        SELECT s.gold_shop_id, s.plan_id
        FROM subscriptions s
        JOIN (
          SELECT gold_shop_id, MAX(id) AS latest_id
          FROM subscriptions
          GROUP BY gold_shop_id
        ) newest ON newest.latest_id = s.id
      ) latest ON latest.gold_shop_id = gs.id
      LEFT JOIN subscription_plans sp ON sp.id = latest.plan_id
      WHERE gs.deleted_at IS NULL
      ORDER BY gs.created_at DESC, gs.id DESC
      LIMIT 8
    `),
    pool.execute(`
      SELECT p.id, p.transaction_id, p.amount, p.payment_method, p.payment_status,
        COALESCE(p.payment_date, p.created_at) AS payment_date,
        gs.shop_name, COALESCE(sp.plan_name, 'No plan') AS plan_name
      FROM payments p
      JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      ORDER BY COALESCE(p.payment_date, p.created_at) DESC, p.id DESC
      LIMIT 8
    `)
  ]);

  const makeSeries = (rows, field) => {
    const valuesByMonth = new Map(rows.map((row) => [row.month, Number(row[field] || 0)]));
    return months.map((month) => ({
      ...month,
      [field]: valuesByMonth.get(month.key) || 0
    }));
  };
  const shopStatus = shopStatusRows[0][0] || {};

  return {
    monthlyRevenue: makeSeries(revenueRows[0], 'revenue').map((item) => ({
      ...item,
      transactions: Number(revenueRows[0].find((row) => row.month === item.key)?.transactions || 0)
    })),
    shopRegistrations: makeSeries(registrationRows[0], 'registrations'),
    subscriptionGrowth: makeSeries(subscriptionGrowthRows[0], 'subscriptions'),
    shopStatus: {
      active: Number(shopStatus.active_shops || 0),
      expired: Number(shopStatus.expired_shops || 0)
    },
    recentShops: recentShopRows[0].map((shop) => ({
      ...shop,
      id: Number(shop.id)
    })),
    recentPayments: recentPaymentRows[0].map((payment) => ({
      ...payment,
      id: Number(payment.id),
      paymentId: payment.transaction_id || `PAY-${payment.id}`,
      amount: Number(payment.amount || 0)
    }))
  };
}

module.exports = {
  buildMonthBuckets,
  getDashboardAnalytics,
  getDashboardStats,
  percentageChange
};
